"""End-to-end backend tests for CashClick API.

Covers auth, config, banners, tasks, earn (spin/scratch/checkin),
quiz/survey/visits/watch, wallet, withdrawals and admin endpoints.
"""

import os
import time
import pytest
import requests

DEMO_TOKEN = "demo_session_token_001"


# ---------- health / config ----------
class TestHealthAndConfig:
    def test_root_health(self, session, base_url):
        r = session.get(f"{base_url}/api/")
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True

    def test_config(self, session, base_url):
        r = session.get(f"{base_url}/api/config")
        assert r.status_code == 200
        cfg = r.json()
        assert cfg["points_per_rupee"] == 100
        assert isinstance(cfg["withdraw_amounts"], list) and len(cfg["withdraw_amounts"]) >= 1
        assert "admob" in cfg and cfg["admob"].get("app_id")
        assert cfg.get("telegram_channel", "").startswith("https://t.me/")
        assert cfg.get("telegram_contact", "").startswith("https://t.me/")


# ---------- auth ----------
class TestAuth:
    def test_admin_login_success(self, session, base_url):
        r = session.post(
            f"{base_url}/api/auth/admin-login",
            json={"email": "93altaff@gmail.com", "password": "9372@Altaf93"},
        )
        assert r.status_code == 200
        data = r.json()
        assert "session_token" in data and data["session_token"]
        assert data["user"]["email"] == "93altaff@gmail.com"
        assert data["user"]["is_admin"] is True

    def test_admin_login_invalid(self, session, base_url):
        r = session.post(
            f"{base_url}/api/auth/admin-login",
            json={"email": "93altaff@gmail.com", "password": "wrong"},
        )
        assert r.status_code == 401

    def test_auth_me_admin(self, session, base_url, admin_headers):
        r = session.get(f"{base_url}/api/auth/me", headers=admin_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["is_admin"] is True
        assert u["email"] == "93altaff@gmail.com"

    def test_auth_me_demo(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/auth/me", headers=demo_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == "demo@cashclick.app"
        assert u["is_admin"] is False
        # Note: points may have changed across runs; just verify field exists
        assert isinstance(u.get("points"), int)

    def test_protected_without_token(self, session, base_url):
        r = session.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_non_admin_forbidden(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/admin/stats", headers=demo_headers)
        assert r.status_code == 403


# ---------- banners ----------
class TestBanners:
    def test_list_banners(self, session, base_url):
        r = session.get(f"{base_url}/api/banners")
        assert r.status_code == 200
        banners = r.json()
        assert isinstance(banners, list)
        assert len(banners) >= 3
        for b in banners:
            assert "id" in b and "title" in b and "image" in b


# ---------- tasks ----------
class TestTasks:
    def test_list_tasks_demo(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/tasks", headers=demo_headers)
        assert r.status_code == 200
        tasks = r.json()
        assert isinstance(tasks, list)
        assert len(tasks) >= 3
        names = [t["name"] for t in tasks]
        for required in ["PhonePe Signup", "Groww Account", "Amazon Pay Cashback"]:
            assert required in names, f"Seeded task missing: {required}"

    def test_get_task_single(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/tasks", headers=demo_headers)
        tid = r.json()[0]["id"]
        r2 = session.get(f"{base_url}/api/tasks/{tid}", headers=demo_headers)
        assert r2.status_code == 200
        t = r2.json()
        assert t["id"] == tid
        # submission field present (may be null or contain prior submission across reruns)
        assert "submission" in t

    def test_get_task_not_found(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/tasks/nonexistent", headers=demo_headers)
        assert r.status_code == 404


# ---------- earn: spin / scratch / checkin ----------
class TestEarnFlows:
    def _wallet_points(self, session, base_url, headers):
        return session.get(f"{base_url}/api/wallet", headers=headers).json()["points"]

    def test_spin(self, session, base_url, demo_headers):
        state = session.get(f"{base_url}/api/earn/spin/state", headers=demo_headers).json()
        if state["remaining"] <= 0:
            pytest.skip("Daily spin limit reached")
        before = self._wallet_points(session, base_url, demo_headers)
        r = session.post(f"{base_url}/api/earn/spin", headers=demo_headers)
        assert r.status_code == 200
        pts = r.json()["points"]
        assert 50 <= pts <= 100
        after = self._wallet_points(session, base_url, demo_headers)
        assert after == before + pts
        state2 = session.get(f"{base_url}/api/earn/spin/state", headers=demo_headers).json()
        assert state2["used"] == state["used"] + 1

    def test_scratch(self, session, base_url, demo_headers):
        state = session.get(f"{base_url}/api/earn/scratch/state", headers=demo_headers).json()
        if state["remaining"] <= 0:
            pytest.skip("Daily scratch limit reached")
        before = self._wallet_points(session, base_url, demo_headers)
        r = session.post(f"{base_url}/api/earn/scratch", headers=demo_headers)
        assert r.status_code == 200
        pts = r.json()["points"]
        assert 50 <= pts <= 100
        after = self._wallet_points(session, base_url, demo_headers)
        assert after == before + pts
        state2 = session.get(f"{base_url}/api/earn/scratch/state", headers=demo_headers).json()
        assert state2["used"] == state["used"] + 1

    def test_checkin(self, session, base_url, demo_headers):
        before = self._wallet_points(session, base_url, demo_headers)
        r = session.post(f"{base_url}/api/earn/checkin", headers=demo_headers)
        if r.status_code == 400 and "Already" in r.text:
            pytest.skip("Already checked in today (idempotent)")
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["points"] in [10, 20, 30, 40, 50, 60, 100]
        assert body["streak"] >= 1
        after = self._wallet_points(session, base_url, demo_headers)
        assert after == before + body["points"]
        # second call should 400
        r2 = session.post(f"{base_url}/api/earn/checkin", headers=demo_headers)
        assert r2.status_code == 400


# ---------- quiz / survey ----------
class TestQuizSurvey:
    def test_quiz_flow(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/quiz/today", headers=demo_headers)
        assert r.status_code == 200
        body = r.json()
        assert body.get("quiz") is not None
        if body.get("completed"):
            pytest.skip("Quiz already completed today")
        before = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()["points"]
        r2 = session.post(f"{base_url}/api/quiz/submit", json={}, headers=demo_headers)
        assert r2.status_code == 200
        assert r2.json()["points"] == 100
        after = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()["points"]
        assert after == before + 100
        # duplicate
        assert session.post(f"{base_url}/api/quiz/submit", json={}, headers=demo_headers).status_code == 400

    def test_survey_flow(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/survey/today", headers=demo_headers)
        assert r.status_code == 200
        body = r.json()
        assert body.get("survey") is not None
        if body.get("completed"):
            pytest.skip("Survey already completed today")
        before = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()["points"]
        r2 = session.post(f"{base_url}/api/survey/submit", json={}, headers=demo_headers)
        assert r2.status_code == 200
        assert r2.json()["points"] == 100
        after = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()["points"]
        assert after == before + 100


# ---------- visits / watch ----------
class TestVisitsWatch:
    def test_visits(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/visits", headers=demo_headers)
        assert r.status_code == 200
        sites = r.json()
        assert isinstance(sites, list) and len(sites) >= 1
        target = next((s for s in sites if not s.get("completed_today")), None)
        if not target:
            pytest.skip("All visit sites completed today")
        before = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()["points"]
        r2 = session.post(f"{base_url}/api/visits/{target['id']}/complete", headers=demo_headers)
        assert r2.status_code == 200
        assert r2.json()["points"] == 100
        after = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()["points"]
        assert after == before + 100
        # duplicate same day
        r3 = session.post(f"{base_url}/api/visits/{target['id']}/complete", headers=demo_headers)
        assert r3.status_code == 400

    def test_watch(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/watch", headers=demo_headers)
        assert r.status_code == 200
        vids = r.json()
        assert isinstance(vids, list) and len(vids) >= 1
        target = next((v for v in vids if not v.get("completed")), None)
        if not target:
            pytest.skip("All videos already watched")
        before = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()["points"]
        r2 = session.post(f"{base_url}/api/watch/{target['id']}/complete", headers=demo_headers)
        assert r2.status_code == 200
        assert r2.json()["points"] == 100
        after = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()["points"]
        assert after == before + 100


# ---------- wallet ----------
class TestWallet:
    def test_wallet_shape(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/wallet", headers=demo_headers)
        assert r.status_code == 200
        w = r.json()
        assert "points" in w and "rupees" in w and "transactions" in w
        assert isinstance(w["transactions"], list)
        assert w["rupees"] == pytest.approx(w["points"] / 100)


# ---------- withdrawals ----------
class TestWithdrawals:
    def test_withdraw_and_refund_flow(self, session, base_url, demo_headers, admin_headers):
        # Ensure at least 100 points (1 rupee). If not, skip (cannot guarantee without earn flows).
        w = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()
        if w["points"] < 100:
            pytest.skip(f"Demo user has insufficient points ({w['points']})")
        before_points = w["points"]
        r = session.post(
            f"{base_url}/api/withdrawals",
            json={"amount_rupees": 1, "method": "upi", "upi_id": "test@upi"},
            headers=demo_headers,
        )
        assert r.status_code == 200, r.text
        wd = r.json()
        assert wd["status"] == "pending"
        assert wd["points_deducted"] == 100
        assert wd["amount_rupees"] == 1
        wid = wd["id"]
        # verify deduction
        w_after = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()
        assert w_after["points"] == before_points - 100

        # list my withdrawals -> pending entry exists
        my = session.get(f"{base_url}/api/withdrawals", headers=demo_headers).json()
        assert any(x["id"] == wid for x in my)

        # admin sees pending
        adm = session.get(f"{base_url}/api/admin/withdrawals?status=pending", headers=admin_headers).json()
        assert any(x["id"] == wid for x in adm)

        # admin reject -> refund
        rj = session.post(
            f"{base_url}/api/admin/withdrawals/{wid}/reject",
            json={"note": "TEST_reject"},
            headers=admin_headers,
        )
        assert rj.status_code == 200
        w_refund = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()
        assert w_refund["points"] == before_points  # refunded back

    def test_withdraw_insufficient(self, session, base_url, demo_headers):
        # Use a huge amount that demo can't afford
        r = session.post(
            f"{base_url}/api/withdrawals",
            json={"amount_rupees": 100000, "method": "upi", "upi_id": "test@upi"},
            headers=demo_headers,
        )
        assert r.status_code == 400

    def test_withdraw_missing_upi(self, session, base_url, demo_headers):
        r = session.post(
            f"{base_url}/api/withdrawals",
            json={"amount_rupees": 1, "method": "upi"},
            headers=demo_headers,
        )
        assert r.status_code == 400


# ---------- admin ----------
class TestAdminEndpoints:
    def test_admin_stats(self, session, base_url, admin_headers):
        r = session.get(f"{base_url}/api/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        s = r.json()
        for k in [
            "total_users", "dau_today", "pending_withdrawal_amount",
            "pending_withdrawal_count", "approved_today_amount", "approved_today_count",
        ]:
            assert k in s

    def test_admin_users(self, session, base_url, admin_headers):
        r = session.get(f"{base_url}/api/admin/users", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        emails = [u["email"] for u in users]
        assert "demo@cashclick.app" in emails

    def test_admin_withdrawals_all(self, session, base_url, admin_headers):
        r = session.get(f"{base_url}/api/admin/withdrawals?status=all", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_submissions(self, session, base_url, admin_headers):
        r = session.get(f"{base_url}/api/admin/submissions?status=all", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_leaderboard(self, session, base_url, admin_headers):
        r = session.get(f"{base_url}/api/admin/leaderboard?period=total", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- task submission approve flow (admin) ----------
class TestTaskSubmissionApproval:
    def test_submit_and_approve(self, session, base_url, demo_headers, admin_headers):
        tasks = session.get(f"{base_url}/api/tasks", headers=demo_headers).json()
        # find a task without prior submission
        target = next((t for t in tasks if not t.get("submission_status")), None)
        if not target:
            pytest.skip("Demo user has submissions on all tasks")
        payload = {"mobile": "9999999999", "email": "TEST_demo@cashclick.app", "screenshot": "data:image/png;base64,iVBORw0KGgo="}
        r = session.post(f"{base_url}/api/tasks/{target['id']}/submit", json=payload, headers=demo_headers)
        assert r.status_code == 200, r.text
        sub = r.json()
        assert sub["status"] == "pending"
        sid = sub["id"]
        # duplicate pending submission rejected
        r_dup = session.post(f"{base_url}/api/tasks/{target['id']}/submit", json=payload, headers=demo_headers)
        assert r_dup.status_code == 400

        before = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()["points"]
        ap = session.post(f"{base_url}/api/admin/submissions/{sid}/approve", headers=admin_headers)
        assert ap.status_code == 200
        after = session.get(f"{base_url}/api/wallet", headers=demo_headers).json()["points"]
        assert after == before + target["points"]
        # cleanup so reruns can submit again
        session.post(f"{base_url}/api/admin/submissions/{sid}/reset", headers=admin_headers)
