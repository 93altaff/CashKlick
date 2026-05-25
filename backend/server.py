from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Cookie, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
import uuid
import random
import hashlib
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from questions import QUIZ_QUESTIONS, SURVEY_QUESTIONS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="CashClick API")
api = APIRouter(prefix="/api")

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@cashclick.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "change-me")
POINTS_PER_RUPEE = 100

# -------- Models --------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    points: int = 0
    total_earned: int = 0
    total_tasks_done: int = 0
    streak: int = 0
    last_checkin: Optional[str] = None
    first_withdrawal_done: bool = False
    referral_code: Optional[str] = None
    referred_by: Optional[str] = None
    is_admin: bool = False
    created_at: Optional[str] = None

class GoogleSessionBody(BaseModel):
    session_id: str

class AdminLoginBody(BaseModel):
    email: str
    password: str

class DeviceLoginBody(BaseModel):
    device_id: str

class DeviceRegisterBody(BaseModel):
    device_id: str
    username: str
    platform: Optional[str] = None
    device_name: Optional[str] = None

class BannerModel(BaseModel):
    id: str
    image: str  # base64 data uri
    title: str
    subtitle: str
    url: str
    active: bool = True
    order: int = 0

class TaskModel(BaseModel):
    id: str
    logo: str  # base64
    name: str
    note: str
    points: int
    rules: str
    youtube_url: str
    task_url: str
    telegram_url: str
    require_mobile: bool = True
    require_email: bool = True
    require_screenshot: bool = True
    active: bool = True
    created_at: Optional[str] = None

class TaskSubmission(BaseModel):
    id: str
    user_id: str
    task_id: str
    task_name: str
    points: int
    mobile: Optional[str] = None
    email: Optional[str] = None
    screenshot: Optional[str] = None  # base64
    status: str = "pending"  # pending, approved, rejected
    reject_note: Optional[str] = None
    created_at: str

class WithdrawalModel(BaseModel):
    id: str
    user_id: str
    user_email: str
    amount_rupees: int
    points_deducted: int
    method: str  # upi / bank
    upi_id: Optional[str] = None
    account_no: Optional[str] = None
    ifsc: Optional[str] = None
    account_holder: Optional[str] = None
    status: str = "pending"  # pending, success, rejected
    reject_note: Optional[str] = None
    created_at: str

class TransactionModel(BaseModel):
    id: str
    user_id: str
    kind: str  # earn / withdraw / admin_adjust / referral
    source: str
    points: int  # positive earn, negative spend
    note: Optional[str] = None
    created_at: str

# -------- Auth helpers --------
async def get_current_user(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
) -> Dict[str, Any]:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    elif session_token:
        token = session_token
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = sess.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_admin(user=Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin required")
    return user

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# IST = UTC+5:30. App day rolls over at midnight IST.
IST = timezone(timedelta(hours=5, minutes=30))

def today_str() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")

async def add_transaction(user_id: str, kind: str, source: str, points: int, note: str = None):
    tx = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "kind": kind,
        "source": source,
        "points": points,
        "note": note,
        "created_at": now_iso(),
    }
    await db.transactions.insert_one(tx)
    return tx

async def credit_user(user_id: str, points: int, source: str, note: str = None):
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"points": points, "total_earned": max(points, 0)}}
    )
    await add_transaction(user_id, "earn", source, points, note)

# -------- Auth endpoints --------
@api.post("/auth/session")
async def auth_session(body: GoogleSessionBody):
    # Call Emergent Auth to exchange session_id
    url = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(url, headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()
    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", existing.get("name")), "picture": data.get("picture", existing.get("picture"))}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        ref_code = uuid.uuid4().hex[:6].upper()
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "picture": data.get("picture"),
            "points": 0,
            "total_earned": 0,
            "total_tasks_done": 0,
            "streak": 0,
            "last_checkin": None,
            "first_withdrawal_done": False,
            "referral_code": ref_code,
            "referred_by": None,
            "is_admin": False,
            "created_at": now_iso(),
        })
    token = data.get("session_token") or f"sess_{uuid.uuid4().hex}"
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": expires,
        "created_at": datetime.now(timezone.utc),
    })
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    resp = JSONResponse({"session_token": token, "user": _clean(user_doc)})
    resp.set_cookie("session_token", token, httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60)
    return resp

@api.post("/auth/admin-login")
async def admin_login(body: AdminLoginBody):
    if body.email != ADMIN_EMAIL or body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    user = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    if not user:
        user_id = f"admin_{uuid.uuid4().hex[:10]}"
        doc = {
            "user_id": user_id, "email": ADMIN_EMAIL, "name": "Admin",
            "picture": None, "points": 0, "total_earned": 0, "total_tasks_done": 0,
            "streak": 0, "last_checkin": None, "first_withdrawal_done": False,
            "referral_code": "ADMIN0", "referred_by": None, "is_admin": True,
            "created_at": now_iso(),
        }
        await db.users.insert_one(doc)
        user = doc
    else:
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"is_admin": True}})
        user["is_admin"] = True
    token = f"admin_sess_{uuid.uuid4().hex}"
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": token,
        "expires_at": expires,
        "created_at": datetime.now(timezone.utc),
    })
    return {"session_token": token, "user": _clean(user)}

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.]{3,20}$")

@api.get("/auth/username-available")
async def username_available(u: str):
    u = (u or "").strip().lower()
    if not USERNAME_RE.match(u):
        return {"available": False, "reason": "Use 3-20 letters, numbers, dot or underscore. No spaces."}
    existing = await db.users.find_one({"username": u}, {"_id": 0, "username": 1})
    return {"available": not bool(existing)}

@api.post("/auth/device-login")
async def device_login(body: DeviceLoginBody):
    """Look up a user by device_id. Returns session if found, else 404."""
    if not body.device_id:
        raise HTTPException(400, "device_id required")
    user = await db.users.find_one({"device_id": body.device_id, "is_admin": {"$ne": True}}, {"_id": 0})
    if not user:
        raise HTTPException(404, "No account on this device")
    token = f"dev_sess_{uuid.uuid4().hex}"
    expires = datetime.now(timezone.utc) + timedelta(days=365)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": token,
        "expires_at": expires,
        "created_at": datetime.now(timezone.utc),
    })
    return {"session_token": token, "user": _clean(user)}

@api.post("/auth/device-register")
async def device_register(body: DeviceRegisterBody):
    """Create a new account tied to device_id. One device = one account."""
    if not body.device_id:
        raise HTTPException(400, "device_id required")
    username = (body.username or "").strip().lower()
    if not USERNAME_RE.match(username):
        raise HTTPException(400, "Invalid username. Use 3-20 letters, numbers, dot or underscore. No spaces.")
    # One device = one account (rejects cloning that shares same Android ID / IDFV).
    existing_device = await db.users.find_one({"device_id": body.device_id}, {"_id": 0, "user_id": 1})
    if existing_device:
        raise HTTPException(409, "An account already exists on this device")
    # Unique username
    existing_user = await db.users.find_one({"username": username}, {"_id": 0, "user_id": 1})
    if existing_user:
        raise HTTPException(409, "Username already taken")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    ref_code = uuid.uuid4().hex[:6].upper()
    doc = {
        "user_id": user_id,
        "email": f"{username}@cashclick.local",
        "username": username,
        "name": username,
        "picture": None,
        "device_id": body.device_id,
        "device_platform": body.platform or "unknown",
        "device_name": body.device_name or None,
        "auth_type": "device",
        "points": 0,
        "total_earned": 0,
        "total_tasks_done": 0,
        "streak": 0,
        "last_checkin": None,
        "first_withdrawal_done": False,
        "referral_code": ref_code,
        "referred_by": None,
        "is_admin": False,
        "created_at": now_iso(),
    }
    try:
        await db.users.insert_one(doc)
    except Exception as e:
        # Duplicate key (username or device_id) — race condition.
        msg = str(e).lower()
        if "device_id" in msg:
            raise HTTPException(409, "An account already exists on this device")
        if "username" in msg:
            raise HTTPException(409, "Username already taken")
        raise HTTPException(500, "Could not create account")
    token = f"dev_sess_{uuid.uuid4().hex}"
    expires = datetime.now(timezone.utc) + timedelta(days=365)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": expires,
        "created_at": datetime.now(timezone.utc),
    })
    return {"session_token": token, "user": _clean(doc)}

@api.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return _clean(user)

@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("session_token")
    return resp

def _clean(doc):
    if not doc:
        return doc
    d = dict(doc)
    d.pop("_id", None)
    for k, v in list(d.items()):
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d

# -------- Public config --------
@api.get("/config")
async def get_config():
    s = await db.settings.find_one({"_id": "global"}, {"_id": 0}) or {}
    amounts = s.get("withdraw_amounts", [1, 100, 300, 500])
    default_admob = {
        # Google official test ad unit IDs.
        "app_id": "ca-app-pub-3940256099942544~3347511713",
        "banner": "ca-app-pub-3940256099942544/6300978111",
        "interstitial": "ca-app-pub-3940256099942544/1033173712",
        "native": "ca-app-pub-3940256099942544/2247696110",
        "rewarded": "ca-app-pub-3940256099942544/5224354917",
    }
    admob_cfg = {**default_admob, **(s.get("admob") or {})}
    return {
        "withdraw_amounts": amounts,
        "points_per_rupee": POINTS_PER_RUPEE,
        "telegram_channel": s.get("telegram_channel", "https://t.me/cashclick"),
        "telegram_contact": s.get("telegram_contact", "https://t.me/cashclick_support"),
        "email_contact": s.get("email_contact", "support@cashclick.app"),
        "privacy_policy_url": s.get("privacy_policy_url", "https://cashclick.app/privacy"),
        "terms_url": s.get("terms_url", "https://cashclick.app/terms"),
        "admob": admob_cfg,
    }

# -------- Banners --------
@api.get("/banners")
async def list_banners():
    cur = db.banners.find({"active": True}).sort("order", 1)
    return [_clean(b) async for b in cur]

@api.post("/admin/banners")
async def admin_create_banner(body: dict, admin=Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "image": body.get("image", ""),
        "title": body.get("title", ""),
        "subtitle": body.get("subtitle", ""),
        "url": body.get("url", ""),
        "active": body.get("active", True),
        "order": body.get("order", 0),
    }
    await db.banners.insert_one(doc)
    return _clean(doc)

@api.put("/admin/banners/{bid}")
async def admin_update_banner(bid: str, body: dict, admin=Depends(require_admin)):
    body.pop("_id", None); body.pop("id", None)
    await db.banners.update_one({"id": bid}, {"$set": body})
    return {"ok": True}

@api.delete("/admin/banners/{bid}")
async def admin_delete_banner(bid: str, admin=Depends(require_admin)):
    await db.banners.delete_one({"id": bid})
    return {"ok": True}

# -------- Tasks --------
@api.get("/tasks")
async def list_tasks(user=Depends(get_current_user)):
    cur = db.tasks.find({"active": True}).sort("created_at", -1).limit(100)
    tasks = [_clean(t) async for t in cur]
    subs_cur = db.task_submissions.find({"user_id": user["user_id"]}, {"_id": 0}).limit(500)
    subs = {}
    async for s in subs_cur:
        subs[s["task_id"]] = s
    result = []
    for t in tasks:
        s = subs.get(t["id"])
        t["submission_status"] = s["status"] if s else None
        t["submission_id"] = s["id"] if s else None
        result.append(t)
    # Sort: recent not-completed at top, rejected bottom
    def rank(x):
        st = x.get("submission_status")
        if st == "rejected": return 2
        if st in ("approved",): return 1
        return 0
    result.sort(key=rank)
    return result

@api.get("/tasks/{tid}")
async def get_task(tid: str, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Not found")
    s = await db.task_submissions.find_one({"user_id": user["user_id"], "task_id": tid}, {"_id": 0})
    t["submission"] = _clean(s) if s else None
    return _clean(t)

@api.post("/tasks/{tid}/submit")
async def submit_task(tid: str, body: dict, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Task not found")
    existing = await db.task_submissions.find_one({"user_id": user["user_id"], "task_id": tid}, {"_id": 0})
    if existing and existing["status"] == "pending":
        raise HTTPException(400, "Already submitted")
    if existing and existing["status"] == "approved":
        raise HTTPException(400, "Already completed")
    sub = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "task_id": tid,
        "task_name": t["name"],
        "points": t["points"],
        "mobile": body.get("mobile"),
        "email": body.get("email"),
        "screenshot": body.get("screenshot"),
        "status": "pending",
        "reject_note": None,
        "created_at": now_iso(),
    }
    if existing:
        await db.task_submissions.update_one({"id": existing["id"]}, {"$set": sub})
        sub["id"] = existing["id"]
    else:
        await db.task_submissions.insert_one(sub)
    return _clean(sub)

@api.post("/tasks/{tid}/payment-received")
async def task_payment_received(tid: str, user=Depends(get_current_user)):
    """For tasks where screenshot is not required — user confirms payment received.
    Creates a success withdrawal record for the task amount but user does NOT earn points for it."""
    t = await db.tasks.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Task not found")
    existing = await db.task_submissions.find_one({"user_id": user["user_id"], "task_id": tid}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Already processed")
    sub = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "task_id": tid,
        "task_name": t["name"],
        "points": t["points"],
        "mobile": None, "email": None, "screenshot": None,
        "status": "payment_received",
        "reject_note": None,
        "created_at": now_iso(),
    }
    await db.task_submissions.insert_one(sub)
    # Create success withdrawal history
    wd = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "user_email": user["email"],
        "amount_rupees": round(t["points"] / POINTS_PER_RUPEE, 2),
        "points_deducted": 0,
        "method": "task_payment",
        "upi_id": None, "account_no": None, "ifsc": None, "account_holder": None,
        "status": "success",
        "reject_note": t["name"],
        "created_at": now_iso(),
    }
    await db.withdrawals.insert_one(wd)
    return {"ok": True, "submission": _clean(sub), "withdrawal": _clean(wd)}

@api.post("/admin/tasks")
async def admin_create_task(body: dict, admin=Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "logo": body.get("logo", ""),
        "name": body.get("name", ""),
        "note": body.get("note", ""),
        "points": int(body.get("points", 0)),
        "rules": body.get("rules", ""),
        "youtube_url": body.get("youtube_url", ""),
        "task_url": body.get("task_url", ""),
        "telegram_url": body.get("telegram_url", ""),
        "require_mobile": body.get("require_mobile", True),
        "require_email": body.get("require_email", True),
        "require_screenshot": body.get("require_screenshot", True),
        "active": body.get("active", True),
        "created_at": now_iso(),
    }
    await db.tasks.insert_one(doc)
    return _clean(doc)

@api.put("/admin/tasks/{tid}")
async def admin_update_task(tid: str, body: dict, admin=Depends(require_admin)):
    body.pop("_id", None); body.pop("id", None)
    await db.tasks.update_one({"id": tid}, {"$set": body})
    return {"ok": True}

@api.delete("/admin/tasks/{tid}")
async def admin_delete_task(tid: str, admin=Depends(require_admin)):
    await db.tasks.delete_one({"id": tid})
    return {"ok": True}

@api.get("/admin/submissions")
async def admin_submissions(status: str = "pending", admin=Depends(require_admin)):
    q = {} if status == "all" else {"status": status}
    cur = db.task_submissions.find(q, {"_id": 0}).sort("created_at", -1).limit(200)
    subs = [_clean(s) async for s in cur]
    # Batch fetch users to avoid N+1
    user_ids = list({s["user_id"] for s in subs})
    users_by_id: Dict[str, Any] = {}
    if user_ids:
        async for u in db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "email": 1, "name": 1, "user_id": 1}):
            users_by_id[u["user_id"]] = u
    for s in subs:
        u = users_by_id.get(s["user_id"])
        s["user_email"] = u.get("email") if u else None
        s["user_name"] = u.get("name") if u else None
    return subs

@api.post("/admin/submissions/{sid}/approve")
async def approve_submission(sid: str, admin=Depends(require_admin)):
    s = await db.task_submissions.find_one({"id": sid}, {"_id": 0})
    if not s: raise HTTPException(404, "Not found")
    if s["status"] == "approved": return {"ok": True}
    await db.task_submissions.update_one({"id": sid}, {"$set": {"status": "approved"}})
    await credit_user(s["user_id"], s["points"], f"task:{s['task_name']}", f"Task approved: {s['task_name']}")
    await db.users.update_one({"user_id": s["user_id"]}, {"$inc": {"total_tasks_done": 1}})
    return {"ok": True}

@api.post("/admin/submissions/{sid}/reject")
async def reject_submission(sid: str, body: dict, admin=Depends(require_admin)):
    await db.task_submissions.update_one({"id": sid}, {"$set": {"status": "rejected", "reject_note": body.get("note", "Rejected")}})
    return {"ok": True}

@api.post("/admin/submissions/{sid}/reset")
async def reset_submission(sid: str, admin=Depends(require_admin)):
    await db.task_submissions.delete_one({"id": sid})
    return {"ok": True}

# -------- Earn: daily checkin --------
@api.post("/earn/checkin")
async def do_checkin(user=Depends(get_current_user)):
    today = today_str()
    if user.get("last_checkin") == today:
        raise HTTPException(400, "Already checked in today")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    new_streak = (user.get("streak", 0) + 1) if user.get("last_checkin") == yesterday else 1
    # reward scale: day index mod 7 (10,20,30,40,50,60,100)
    rewards = [10, 20, 30, 40, 50, 60, 100]
    pts = rewards[(new_streak - 1) % 7]
    await db.users.update_one({"user_id": user["user_id"]},
        {"$set": {"last_checkin": today, "streak": new_streak}})
    await credit_user(user["user_id"], pts, "daily_checkin", f"Day {new_streak} check-in")
    return {"ok": True, "points": pts, "streak": new_streak}

# -------- Earn: spin --------
@api.get("/earn/spin/state")
async def spin_state(user=Depends(get_current_user)):
    today = today_str()
    count = await db.spins.count_documents({"user_id": user["user_id"], "date": today})
    return {"used": count, "limit": 10, "remaining": max(0, 10 - count)}

@api.post("/earn/spin")
async def do_spin(user=Depends(get_current_user)):
    today = today_str()
    count = await db.spins.count_documents({"user_id": user["user_id"], "date": today})
    if count >= 10:
        raise HTTPException(400, "Daily spin limit reached")
    pts = random.randint(50, 100)
    await db.spins.insert_one({"id": str(uuid.uuid4()), "user_id": user["user_id"], "date": today, "points": pts, "created_at": now_iso()})
    await credit_user(user["user_id"], pts, "spin_wheel", "Spin & Win")
    return {"ok": True, "points": pts, "remaining": max(0, 10 - count - 1)}

# -------- Earn: scratch --------
@api.get("/earn/scratch/state")
async def scratch_state(user=Depends(get_current_user)):
    today = today_str()
    count = await db.scratches.count_documents({"user_id": user["user_id"], "date": today})
    return {"used": count, "limit": 10, "remaining": max(0, 10 - count)}

@api.post("/earn/scratch")
async def do_scratch(user=Depends(get_current_user)):
    today = today_str()
    count = await db.scratches.count_documents({"user_id": user["user_id"], "date": today})
    if count >= 10:
        raise HTTPException(400, "Daily scratch limit reached")
    pts = random.randint(50, 100)
    await db.scratches.insert_one({"id": str(uuid.uuid4()), "user_id": user["user_id"], "date": today, "points": pts, "created_at": now_iso()})
    await credit_user(user["user_id"], pts, "scratch_card", "Scratch & Earn")
    return {"ok": True, "points": pts, "remaining": max(0, 10 - count - 1)}

# -------- Earn: visit --------
@api.get("/visits")
async def list_visits(user=Depends(get_current_user)):
    today = today_str()
    cur = db.visit_sites.find({"active": True}, {"_id": 0}).limit(100)
    sites = [s async for s in cur]
    completed_cur = db.visit_completions.find({"user_id": user["user_id"], "date": today}, {"_id": 0}).limit(100)
    done = set()
    async for c in completed_cur:
        done.add(c["site_id"])
    for s in sites:
        s["completed_today"] = s["id"] in done
    return sites

@api.post("/visits/{sid}/complete")
async def visit_complete(sid: str, user=Depends(get_current_user)):
    today = today_str()
    existing = await db.visit_completions.find_one({"user_id": user["user_id"], "site_id": sid, "date": today})
    if existing:
        raise HTTPException(400, "Already completed today")
    site = await db.visit_sites.find_one({"id": sid}, {"_id": 0})
    if not site: raise HTTPException(404, "Not found")
    pts = random.randint(50, 100)
    await db.visit_completions.insert_one({"user_id": user["user_id"], "site_id": sid, "date": today, "points": pts, "created_at": now_iso()})
    await credit_user(user["user_id"], pts, f"visit:{site['name']}", f"Visited {site['name']} (+{pts})")
    return {"ok": True, "points": pts}

@api.post("/admin/visits")
async def admin_add_visit(body: dict, admin=Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), "name": body["name"], "url": body["url"], "active": True}
    await db.visit_sites.insert_one(doc)
    return _clean(doc)

# -------- Earn: watch --------
@api.get("/watch")
async def list_watch(user=Depends(get_current_user)):
    cur = db.watch_videos.find({"active": True}, {"_id": 0}).limit(100)
    vids = [v async for v in cur]
    done_cur = db.watch_completions.find({"user_id": user["user_id"]}, {"_id": 0}).limit(500)
    done = set()
    async for c in done_cur:
        done.add(c["video_id"])
    for v in vids:
        v["completed"] = v["id"] in done
    return vids

@api.post("/watch/{vid}/complete")
async def watch_complete(vid: str, user=Depends(get_current_user)):
    existing = await db.watch_completions.find_one({"user_id": user["user_id"], "video_id": vid})
    if existing: raise HTTPException(400, "Already watched")
    v = await db.watch_videos.find_one({"id": vid}, {"_id": 0})
    if not v: raise HTTPException(404, "Not found")
    await db.watch_completions.insert_one({"user_id": user["user_id"], "video_id": vid, "created_at": now_iso()})
    await credit_user(user["user_id"], 100, f"watch:{v['title']}", f"Watched: {v['title']}")
    return {"ok": True, "points": 100}

@api.post("/admin/watch")
async def admin_add_watch(body: dict, admin=Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), "title": body["title"], "youtube_url": body["youtube_url"], "active": True}
    await db.watch_videos.insert_one(doc)
    return _clean(doc)

# -------- Quiz / Survey --------
def _daily_subset(items: List[dict], user_id: str, salt: str, n: int = 20) -> List[dict]:
    """Pick a deterministic random subset of `n` items for the given user+date+salt."""
    today = today_str()
    seed_src = f"{user_id}|{today}|{salt}".encode()
    seed = int(hashlib.sha256(seed_src).hexdigest(), 16)
    rng = random.Random(seed)
    pool = list(range(len(items)))
    rng.shuffle(pool)
    pick = pool[:min(n, len(pool))]
    return [items[i] for i in pick]


async def _question_bank(kind: str) -> List[dict]:
    """Return the active question bank — admin overrides in DB if present."""
    if kind == "quiz":
        custom = [_clean(q) async for q in db.quiz_bank.find({}, {"_id": 0}).limit(2000)]
        return custom if custom else list(QUIZ_QUESTIONS)
    custom = [_clean(q) async for q in db.survey_bank.find({}, {"_id": 0}).limit(2000)]
    return custom if custom else list(SURVEY_QUESTIONS)


@api.get("/quiz/today")
async def quiz_today(user=Depends(get_current_user)):
    today = today_str()
    done = await db.quiz_completions.find_one({"user_id": user["user_id"], "date": today})
    bank = await _question_bank("quiz")
    questions = _daily_subset(bank, user["user_id"], "quiz", 20)
    return {"questions": questions, "completed": bool(done), "count": len(questions)}


@api.post("/quiz/submit")
async def quiz_submit(body: dict, user=Depends(get_current_user)):
    today = today_str()
    done = await db.quiz_completions.find_one({"user_id": user["user_id"], "date": today})
    if done:
        raise HTTPException(400, "Already done today")
    if not body.get("ad_watched"):
        raise HTTPException(400, "Rewarded ad required to claim points")
    pts = random.randint(50, 200)
    await db.quiz_completions.insert_one({
        "user_id": user["user_id"], "date": today, "points": pts, "created_at": now_iso(),
    })
    await credit_user(user["user_id"], pts, "quiz", f"Daily Quiz (+{pts})")
    return {"ok": True, "points": pts}


@api.get("/survey/today")
async def survey_today(user=Depends(get_current_user)):
    today = today_str()
    done = await db.survey_completions.find_one({"user_id": user["user_id"], "date": today})
    bank = await _question_bank("survey")
    questions = _daily_subset(bank, user["user_id"], "survey", 20)
    return {"questions": questions, "completed": bool(done), "count": len(questions)}


@api.post("/survey/submit")
async def survey_submit(body: dict, user=Depends(get_current_user)):
    today = today_str()
    done = await db.survey_completions.find_one({"user_id": user["user_id"], "date": today})
    if done:
        raise HTTPException(400, "Already done today")
    if not body.get("ad_watched"):
        raise HTTPException(400, "Rewarded ad required to claim points")
    pts = random.randint(50, 200)
    await db.survey_completions.insert_one({
        "user_id": user["user_id"], "date": today, "points": pts, "created_at": now_iso(),
    })
    await credit_user(user["user_id"], pts, "survey", f"Daily Survey (+{pts})")
    return {"ok": True, "points": pts}


# -------- Admin: question bank CRUD --------
@api.get("/admin/quiz-bank")
async def admin_quiz_bank(admin=Depends(require_admin)):
    seeded = [_clean(q) async for q in db.quiz_bank.find({}, {"_id": 0}).limit(2000)]
    return seeded if seeded else QUIZ_QUESTIONS


@api.post("/admin/quiz-bank")
async def admin_add_quiz(body: dict, admin=Depends(require_admin)):
    q = body.get("q", "").strip()
    options = body.get("options") or []
    answer = int(body.get("answer", 0))
    if not q or len(options) < 2:
        raise HTTPException(400, "q and at least 2 options required")
    doc = {"id": str(uuid.uuid4()), "q": q, "options": options, "answer": answer}
    await db.quiz_bank.insert_one(doc)
    return _clean(doc)


@api.delete("/admin/quiz-bank/{qid}")
async def admin_del_quiz(qid: str, admin=Depends(require_admin)):
    await db.quiz_bank.delete_one({"id": qid})
    return {"ok": True}


@api.get("/admin/survey-bank")
async def admin_survey_bank(admin=Depends(require_admin)):
    seeded = [_clean(q) async for q in db.survey_bank.find({}, {"_id": 0}).limit(2000)]
    return seeded if seeded else SURVEY_QUESTIONS


@api.post("/admin/survey-bank")
async def admin_add_survey(body: dict, admin=Depends(require_admin)):
    q = body.get("q", "").strip()
    options = body.get("options") or []
    if not q or len(options) < 2:
        raise HTTPException(400, "q and at least 2 options required")
    doc = {"id": str(uuid.uuid4()), "q": q, "options": options}
    await db.survey_bank.insert_one(doc)
    return _clean(doc)


@api.delete("/admin/survey-bank/{qid}")
async def admin_del_survey(qid: str, admin=Depends(require_admin)):
    await db.survey_bank.delete_one({"id": qid})
    return {"ok": True}


# -------- Admin: ad settings + visit/site CRUD --------
@api.put("/admin/ads")
async def admin_update_ads(body: dict, admin=Depends(require_admin)):
    """Update AdMob app_id, banner, interstitial, native, rewarded IDs."""
    body.pop("_id", None)
    allowed = {k: body.get(k, "") for k in ("app_id", "banner", "interstitial", "native", "rewarded")}
    await db.settings.update_one({"_id": "global"}, {"$set": {"admob": allowed}}, upsert=True)
    return {"ok": True, "admob": allowed}


@api.get("/admin/visits")
async def admin_list_visits(admin=Depends(require_admin)):
    return [_clean(v) async for v in db.visit_sites.find({}, {"_id": 0}).limit(500)]


@api.put("/admin/visits/{vid}")
async def admin_update_visit(vid: str, body: dict, admin=Depends(require_admin)):
    body.pop("_id", None); body.pop("id", None)
    await db.visit_sites.update_one({"id": vid}, {"$set": body})
    return {"ok": True}


@api.delete("/admin/visits/{vid}")
async def admin_delete_visit(vid: str, admin=Depends(require_admin)):
    await db.visit_sites.delete_one({"id": vid})
    return {"ok": True}

# -------- Wallet / transactions --------
@api.get("/wallet")
async def wallet(user=Depends(get_current_user)):
    cur = db.transactions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(100)
    txs = [_clean(t) async for t in cur]
    return {"points": user.get("points", 0), "rupees": user.get("points", 0) / POINTS_PER_RUPEE, "transactions": txs}

# -------- Withdrawals --------
@api.get("/withdrawals")
async def my_withdrawals(user=Depends(get_current_user)):
    cur = db.withdrawals.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(100)
    return [_clean(w) async for w in cur]

@api.post("/withdrawals")
async def create_withdrawal(body: dict, user=Depends(get_current_user)):
    amt = int(body["amount_rupees"])
    points_needed = amt * POINTS_PER_RUPEE
    if user.get("points", 0) < points_needed:
        raise HTTPException(400, "Insufficient points")
    method = body.get("method", "upi")
    if method == "upi":
        if not body.get("upi_id"):
            raise HTTPException(400, "UPI ID required")
    else:
        if not (body.get("account_no") and body.get("ifsc")):
            raise HTTPException(400, "Bank details required")
    # deduct points
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"points": -points_needed}})
    wd = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "user_email": user["email"],
        "amount_rupees": amt,
        "points_deducted": points_needed,
        "method": method,
        "upi_id": body.get("upi_id"),
        "account_no": body.get("account_no"),
        "ifsc": body.get("ifsc"),
        "account_holder": body.get("account_holder"),
        "status": "pending",
        "reject_note": None,
        "created_at": now_iso(),
    }
    await db.withdrawals.insert_one(wd)
    await add_transaction(user["user_id"], "withdraw", f"{method}:₹{amt}", -points_needed, f"Withdrawal ₹{amt} via {method}")
    return _clean(wd)

@api.get("/admin/withdrawals")
async def admin_withdrawals(status: str = "pending", admin=Depends(require_admin)):
    q = {} if status == "all" else {"status": status}
    cur = db.withdrawals.find(q, {"_id": 0}).sort("created_at", -1).limit(500)
    return [_clean(w) async for w in cur]

@api.post("/admin/withdrawals/{wid}/approve")
async def approve_wd(wid: str, admin=Depends(require_admin)):
    w = await db.withdrawals.find_one({"id": wid}, {"_id": 0})
    if not w: raise HTTPException(404, "Not found")
    await db.withdrawals.update_one({"id": wid}, {"$set": {"status": "success"}})
    await db.users.update_one({"user_id": w["user_id"]}, {"$set": {"first_withdrawal_done": True}})
    return {"ok": True}

@api.post("/admin/withdrawals/{wid}/reject")
async def reject_wd(wid: str, body: dict, admin=Depends(require_admin)):
    w = await db.withdrawals.find_one({"id": wid}, {"_id": 0})
    if not w: raise HTTPException(404, "Not found")
    # refund
    await db.users.update_one({"user_id": w["user_id"]}, {"$inc": {"points": w["points_deducted"]}})
    await db.withdrawals.update_one({"id": wid}, {"$set": {"status": "rejected", "reject_note": body.get("note", "Rejected")}})
    await add_transaction(w["user_id"], "refund", f"wd_refund", w["points_deducted"], f"Withdrawal rejected, refunded")
    return {"ok": True}

# -------- Admin: users / stats / leaderboard --------
@api.get("/admin/users")
async def admin_users(search: str = "", admin=Depends(require_admin)):
    q = {}
    if search:
        q = {"$or": [{"email": {"$regex": search, "$options": "i"}}, {"name": {"$regex": search, "$options": "i"}}]}
    cur = db.users.find(q, {"_id": 0}).limit(200)
    return [_clean(u) async for u in cur]

@api.get("/admin/users/{uid}/details")
async def admin_user_details(uid: str, admin=Depends(require_admin)):
    u = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if not u: raise HTTPException(404, "Not found")
    txs = [_clean(t) async for t in db.transactions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(200)]
    wds = [_clean(w) async for w in db.withdrawals.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(200)]
    subs = [_clean(s) async for s in db.task_submissions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(200)]
    return {"user": _clean(u), "transactions": txs, "withdrawals": wds, "submissions": subs}

@api.post("/admin/users/{uid}/adjust")
async def admin_adjust_points(uid: str, body: dict, admin=Depends(require_admin)):
    delta = int(body["points"])
    note = body.get("note", "Admin adjustment")
    await db.users.update_one({"user_id": uid}, {"$inc": {"points": delta}})
    await add_transaction(uid, "admin_adjust", "admin", delta, note)
    return {"ok": True}

@api.get("/admin/stats")
async def admin_stats(admin=Depends(require_admin)):
    today = today_str()
    total_users = await db.users.count_documents({})
    dau = await db.transactions.distinct("user_id", {"created_at": {"$gte": today}})
    pending_wd = await db.withdrawals.aggregate([
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_rupees"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    approved_today = await db.withdrawals.aggregate([
        {"$match": {"status": "success", "created_at": {"$gte": today}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_rupees"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    return {
        "total_users": total_users,
        "dau_today": len(dau),
        "pending_withdrawal_amount": (pending_wd[0]["total"] if pending_wd else 0),
        "pending_withdrawal_count": (pending_wd[0]["count"] if pending_wd else 0),
        "approved_today_amount": (approved_today[0]["total"] if approved_today else 0),
        "approved_today_count": (approved_today[0]["count"] if approved_today else 0),
    }

@api.get("/admin/leaderboard")
async def leaderboard(period: str = "total", admin=Depends(require_admin)):
    # period: daily, weekly, monthly, total
    if period == "total":
        cur = db.users.find({"is_admin": {"$ne": True}}, {"_id": 0, "email": 1, "name": 1, "total_earned": 1, "user_id": 1}).sort("total_earned", -1).limit(50)
        return [_clean(u) async for u in cur]
    # For daily/weekly/monthly: aggregate transactions
    now = datetime.now(timezone.utc)
    if period == "daily":
        since = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    elif period == "weekly":
        since = (now - timedelta(days=7)).isoformat()
    else:
        since = (now - timedelta(days=30)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": since}, "points": {"$gt": 0}}},
        {"$group": {"_id": "$user_id", "total": {"$sum": "$points"}}},
        {"$sort": {"total": -1}},
        {"$limit": 50},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(50)
    user_ids = [r["_id"] for r in results]
    users_by_id: Dict[str, Any] = {}
    if user_ids:
        async for u in db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "email": 1, "name": 1, "user_id": 1}):
            users_by_id[u["user_id"]] = u
    out = []
    for r in results:
        u = users_by_id.get(r["_id"])
        if u:
            out.append({**u, "total_earned": r["total"]})
    return out

@api.put("/admin/settings")
async def update_settings(body: dict, admin=Depends(require_admin)):
    body.pop("_id", None)
    await db.settings.update_one({"_id": "global"}, {"$set": body}, upsert=True)
    return {"ok": True}

# -------- Seed --------
@api.post("/admin/seed")
async def seed_data(admin=Depends(require_admin)):
    await _seed_initial()
    return {"ok": True}

async def _seed_initial():
    # Banners
    if await db.banners.count_documents({}) == 0:
        banners = [
            {"id": str(uuid.uuid4()), "image": "https://images.unsplash.com/photo-1764303017897-16f5009d2bb1?crop=entropy&cs=srgb&fm=jpg&w=800",
             "title": "Earn ₹500 Daily", "subtitle": "Complete high-paying tasks now", "url": "https://cashclick.app", "active": True, "order": 1},
            {"id": str(uuid.uuid4()), "image": "https://images.unsplash.com/photo-1771875797242-77f69f061132?crop=entropy&cs=srgb&fm=jpg&w=800",
             "title": "Refer & Earn ₹10", "subtitle": "7-day streak bonus per referral", "url": "https://cashclick.app/refer", "active": True, "order": 2},
            {"id": str(uuid.uuid4()), "image": "https://images.unsplash.com/photo-1640253621060-5f2225ba80f1?crop=entropy&cs=srgb&fm=jpg&w=800",
             "title": "Daily Check-in Bonus", "subtitle": "Up to 100 points every day", "url": "https://cashclick.app/checkin", "active": True, "order": 3},
        ]
        await db.banners.insert_many(banners)
    # Tasks
    if await db.tasks.count_documents({}) == 0:
        tasks = [
            {"id": str(uuid.uuid4()), "logo": "https://images.unsplash.com/photo-1594405564970-a9f9d8d1b9d0?w=200",
             "name": "PhonePe Signup", "note": "Install & signup to earn", "points": 5000,
             "rules": "1. Install PhonePe using below link\n2. Complete KYC\n3. Submit screenshot of home page",
             "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "task_url": "https://phonepe.com",
             "telegram_url": "https://t.me/cashclick_support",
             "require_mobile": True, "require_email": True, "require_screenshot": True,
             "active": True, "created_at": now_iso()},
            {"id": str(uuid.uuid4()), "logo": "https://images.unsplash.com/photo-1640253621060-5f2225ba80f1?w=200",
             "name": "Groww Account", "note": "Open demat account", "points": 10000,
             "rules": "1. Sign up with referral\n2. Complete KYC with PAN\n3. Submit screenshot",
             "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "task_url": "https://groww.in",
             "telegram_url": "https://t.me/cashclick_support",
             "require_mobile": True, "require_email": True, "require_screenshot": True,
             "active": True, "created_at": now_iso()},
            {"id": str(uuid.uuid4()), "logo": "https://images.unsplash.com/photo-1764303017897-16f5009d2bb1?w=200",
             "name": "Amazon Pay Cashback", "note": "₹30 via payment", "points": 3000,
             "rules": "1. Complete any transaction of ₹100 via Amazon Pay\n2. Click Payment Received below",
             "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "task_url": "https://amazon.in",
             "telegram_url": "https://t.me/cashclick_support",
             "require_mobile": False, "require_email": False, "require_screenshot": False,
             "active": True, "created_at": now_iso()},
        ]
        await db.tasks.insert_many(tasks)
    # Visit sites
    if await db.visit_sites.count_documents({}) == 0:
        await db.visit_sites.insert_many([
            {"id": str(uuid.uuid4()), "name": "Tech News", "url": "https://news.ycombinator.com", "active": True},
            {"id": str(uuid.uuid4()), "name": "Shop Deals", "url": "https://flipkart.com", "active": True},
        ])
    # Watch
    if await db.watch_videos.count_documents({}) == 0:
        await db.watch_videos.insert_many([
            {"id": str(uuid.uuid4()), "title": "How to earn from CashClick", "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "active": True},
        ])
    # Quiz
    if await db.quizzes.count_documents({}) == 0:
        await db.quizzes.insert_one({"id": str(uuid.uuid4()), "title": "Daily GK Quiz", "questions": [
            {"q": "Capital of India?", "options": ["Mumbai", "Delhi", "Kolkata", "Chennai"], "answer": 1},
            {"q": "Currency of India?", "options": ["Dollar", "Rupee", "Euro", "Yen"], "answer": 1},
        ], "active": True, "created_at": now_iso()})
    # Survey
    if await db.surveys.count_documents({}) == 0:
        await db.surveys.insert_one({"id": str(uuid.uuid4()), "title": "User Feedback", "questions": [
            {"q": "How often do you use CashClick?", "options": ["Daily", "Weekly", "Rarely"]},
            {"q": "Favorite earning method?", "options": ["Tasks", "Spin", "Scratch", "Watch"]},
        ], "active": True, "created_at": now_iso()})
    # Settings
    if await db.settings.find_one({"_id": "global"}) is None:
        await db.settings.insert_one({
            "_id": "global",
            "withdraw_amounts": [1, 100, 300, 500],
            "telegram_channel": "https://t.me/cashclick",
            "telegram_contact": "https://t.me/cashclick_support",
            "email_contact": "support@cashclick.app",
            "privacy_policy_url": "https://cashclick.app/privacy",
            "terms_url": "https://cashclick.app/terms",
        })
    # Admin user
    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    if not admin:
        await db.users.insert_one({
            "user_id": f"admin_{uuid.uuid4().hex[:10]}",
            "email": ADMIN_EMAIL, "name": "Admin", "picture": None,
            "points": 0, "total_earned": 0, "total_tasks_done": 0, "streak": 0,
            "last_checkin": None, "first_withdrawal_done": False,
            "referral_code": "ADMIN0", "referred_by": None, "is_admin": True,
            "created_at": now_iso(),
        })
    # Demo user + session for dev testing
    demo = await db.users.find_one({"email": "demo@cashclick.app"})
    if not demo:
        await db.users.insert_one({
            "user_id": "demo_user_001",
            "email": "demo@cashclick.app", "name": "Demo User",
            "picture": None, "points": 500, "total_earned": 500,
            "total_tasks_done": 0, "streak": 1, "last_checkin": None,
            "first_withdrawal_done": False, "referral_code": "DEMO01",
            "referred_by": None, "is_admin": False, "created_at": now_iso(),
        })
    existing_sess = await db.user_sessions.find_one({"session_token": "demo_session_token_001"})
    if not existing_sess:
        await db.user_sessions.insert_one({
            "user_id": "demo_user_001",
            "session_token": "demo_session_token_001",
            "expires_at": datetime.now(timezone.utc) + timedelta(days=365),
            "created_at": datetime.now(timezone.utc),
        })

@api.get("/")
async def root():
    return {"ok": True, "app": "CashClick"}

@api.get("/logo")
async def download_logo():
    """Public download endpoint for the app logo PNG."""
    from fastapi.responses import FileResponse
    path = "/app/frontend/assets/images/cashclick-logo.png"
    if not os.path.exists(path):
        raise HTTPException(404, "Logo not found")
    return FileResponse(path, media_type="image/png", filename="cashclick-logo.png")

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def on_startup():
    # Indexes for device-bound auth and uniqueness.
    try:
        await db.users.create_index("device_id", unique=True, sparse=True)
        await db.users.create_index("username", unique=True, sparse=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
    except Exception as e:
        logger.warning(f"Index creation issue: {e}")
    await _seed_initial()
    logger.info("CashClick seeded")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
