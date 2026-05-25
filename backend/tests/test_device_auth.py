"""Backend tests for device-based auth (replaces Google login) and new admin password.

Covers:
  - /api/auth/admin-login with NEW password (success) and OLD password (401)
  - /api/auth/username-available (regex / spaces / too-short)
  - /api/auth/device-login (not found + login-after-register)
  - /api/auth/device-register (success, dup device 409, dup username 409, space 400)
  - session_token works on /api/auth/me
  - Demo token regression
  - Regression: banners, tasks (with demo), config
  - Admin regression: stats / users / withdrawals / submissions
"""

import uuid
import pytest


NEW_ADMIN_PASSWORD = "9372@Altaf93"
OLD_ADMIN_PASSWORD = "cashclick2026"
ADMIN_EMAIL = "93altaff@gmail.com"
DEMO_TOKEN = "demo_session_token_001"


# ---------------- Admin login (new password) ----------------
class TestAdminLoginNewPassword:
    def test_new_password_success(self, session, base_url):
        r = session.post(
            f"{base_url}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": NEW_ADMIN_PASSWORD},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("session_token")
        assert body["user"]["email"] == ADMIN_EMAIL
        assert body["user"]["is_admin"] is True

    def test_old_password_rejected(self, session, base_url):
        r = session.post(
            f"{base_url}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": OLD_ADMIN_PASSWORD},
        )
        assert r.status_code == 401, r.text


# ---------------- username-available ----------------
class TestUsernameAvailable:
    def test_normal_name(self, session, base_url):
        r = session.get(f"{base_url}/api/auth/username-available", params={"u": "altaf93"})
        assert r.status_code == 200
        body = r.json()
        assert "available" in body and isinstance(body["available"], bool)

    def test_too_short(self, session, base_url):
        r = session.get(f"{base_url}/api/auth/username-available", params={"u": "ab"})
        assert r.status_code == 200
        body = r.json()
        assert body["available"] is False
        assert "reason" in body

    def test_contains_space(self, session, base_url):
        r = session.get(f"{base_url}/api/auth/username-available", params={"u": "has space"})
        assert r.status_code == 200
        body = r.json()
        assert body["available"] is False


# ---------------- device-login / device-register full flow ----------------
class TestDeviceAuthFlow:
    @pytest.fixture(scope="class")
    def state(self):
        return {
            "device_id": f"qa_dev_{uuid.uuid4().hex}",
            "username": f"qa_{uuid.uuid4().hex[:8]}",
            "token": None,
        }

    def test_device_login_new_device_404(self, session, base_url, state):
        r = session.post(
            f"{base_url}/api/auth/device-login",
            json={"device_id": state["device_id"]},
        )
        assert r.status_code == 404
        assert "No account" in r.text

    def test_device_register_success(self, session, base_url, state):
        r = session.post(
            f"{base_url}/api/auth/device-register",
            json={
                "device_id": state["device_id"],
                "username": state["username"],
                "platform": "android",
                "device_name": "qa-test-device",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["session_token"]
        u = body["user"]
        assert u["device_id"] == state["device_id"]
        assert u["username"] == state["username"]
        assert u["auth_type"] == "device"
        state["token"] = body["session_token"]

    def test_session_token_works_on_me(self, session, base_url, state):
        assert state["token"], "previous test should have populated token"
        r = session.get(
            f"{base_url}/api/auth/me",
            headers={"Authorization": f"Bearer {state['token']}"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["username"] == state["username"]
        assert body["device_id"] == state["device_id"]

    def test_duplicate_device_id_rejected(self, session, base_url, state):
        # same device_id, different username -> 409
        r = session.post(
            f"{base_url}/api/auth/device-register",
            json={
                "device_id": state["device_id"],
                "username": f"qa_{uuid.uuid4().hex[:8]}",
            },
        )
        assert r.status_code == 409
        assert "device" in r.text.lower()

    def test_duplicate_username_rejected(self, session, base_url, state):
        # different device_id, same username -> 409
        r = session.post(
            f"{base_url}/api/auth/device-register",
            json={
                "device_id": f"qa_dev_{uuid.uuid4().hex}",
                "username": state["username"],
            },
        )
        assert r.status_code == 409
        assert "username" in r.text.lower()

    def test_username_with_space_400(self, session, base_url):
        r = session.post(
            f"{base_url}/api/auth/device-register",
            json={
                "device_id": f"qa_dev_{uuid.uuid4().hex}",
                "username": "has space",
            },
        )
        assert r.status_code == 400

    def test_device_login_after_register_returns_200(self, session, base_url, state):
        r = session.post(
            f"{base_url}/api/auth/device-login",
            json={"device_id": state["device_id"]},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["session_token"]
        assert body["user"]["username"] == state["username"]


# ---------------- Demo token still works ----------------
class TestDemoTokenRegression:
    def test_demo_me(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/auth/me", headers=demo_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == "demo@cashclick.app"
        # spec says 500 points pre-seeded; allow >= 500 since prior tests may have added
        assert isinstance(u["points"], int)
        assert u["points"] >= 500


# ---------------- Regression: banners / tasks / config ----------------
class TestPublicRegression:
    def test_banners(self, session, base_url):
        r = session.get(f"{base_url}/api/banners")
        assert r.status_code == 200
        banners = r.json()
        assert isinstance(banners, list) and len(banners) >= 3

    def test_tasks_with_demo(self, session, base_url, demo_headers):
        r = session.get(f"{base_url}/api/tasks", headers=demo_headers)
        assert r.status_code == 200
        tasks = r.json()
        assert isinstance(tasks, list) and len(tasks) >= 1

    def test_config(self, session, base_url):
        r = session.get(f"{base_url}/api/config")
        assert r.status_code == 200
        cfg = r.json()
        assert "admob" in cfg and cfg["admob"].get("app_id")
        assert isinstance(cfg.get("withdraw_amounts"), list) and cfg["withdraw_amounts"]


# ---------------- Admin endpoints regression (with NEW admin token) ----------------
class TestAdminRegression:
    def test_admin_stats(self, session, base_url, admin_headers):
        r = session.get(f"{base_url}/api/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        s = r.json()
        assert "total_users" in s

    def test_admin_users(self, session, base_url, admin_headers):
        r = session.get(f"{base_url}/api/admin/users", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_withdrawals_pending(self, session, base_url, admin_headers):
        r = session.get(f"{base_url}/api/admin/withdrawals", params={"status": "pending"}, headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_submissions(self, session, base_url, admin_headers):
        r = session.get(f"{base_url}/api/admin/submissions", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
