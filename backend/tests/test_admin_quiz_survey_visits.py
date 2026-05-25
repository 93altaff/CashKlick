"""Tests for the new admin/quiz/survey/visit features in CashClick backend.
Covers: admin-login, /config admob defaults, quiz/survey today + submit gating,
admin question-bank CRUD, ads update, visits CRUD, and tasks/submit not requiring screenshot.
"""
import os
import uuid
import time
import pytest
import requests

from conftest import BASE_URL, DEMO_TOKEN


# ---------- Helpers ----------

def _get(path, headers=None):
    return requests.get(f"{BASE_URL}{path}", headers=headers or {}, timeout=20)


def _post(path, headers=None, json=None):
    return requests.post(f"{BASE_URL}{path}", headers=headers or {}, json=json or {}, timeout=20)


def _put(path, headers=None, json=None):
    return requests.put(f"{BASE_URL}{path}", headers=headers or {}, json=json or {}, timeout=20)


def _delete(path, headers=None):
    return requests.delete(f"{BASE_URL}{path}", headers=headers or {}, timeout=20)


# ---------- Admin login ----------
class TestAdminLogin:
    def test_admin_login_success(self, admin_token):
        # admin_token fixture asserts 200 + returns token
        assert admin_token and isinstance(admin_token, str)

    def test_admin_login_wrong_password(self, session):
        r = session.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": "93altaff@gmail.com", "password": "wrong"},
        )
        assert r.status_code == 401

    def test_admin_me_is_admin_true(self, admin_headers):
        r = _get("/api/auth/me", admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get("is_admin") is True
        assert data.get("email") == "93altaff@gmail.com"


# ---------- Public /config ----------
class TestConfig:
    def test_config_returns_admob_defaults(self):
        r = _get("/api/config")
        assert r.status_code == 200
        cfg = r.json()
        assert "admob" in cfg
        admob = cfg["admob"]
        # Default values must be present (test ad IDs) unless admin overrode
        for k in ("app_id", "banner", "interstitial", "native", "rewarded"):
            assert k in admob, f"missing admob.{k}"
            assert isinstance(admob[k], str)


# ---------- Quiz ----------
class TestQuiz:
    def test_quiz_today_returns_20_questions(self, demo_headers):
        r = _get("/api/quiz/today", demo_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] == 20
        qs = data["questions"]
        assert len(qs) == 20
        # Each question must have q, options (>=2), answer (int index)
        for q in qs:
            assert q.get("q")
            assert isinstance(q.get("options"), list) and len(q["options"]) >= 2
            assert isinstance(q.get("answer"), int)

    def test_quiz_today_deterministic_for_same_user_same_day(self, demo_headers):
        a = _get("/api/quiz/today", demo_headers).json()["questions"]
        b = _get("/api/quiz/today", demo_headers).json()["questions"]
        assert [q["q"] for q in a] == [q["q"] for q in b], "Daily question set should be stable"

    def test_quiz_submit_requires_ad_watched(self, demo_headers):
        # Reset any existing completion so test is repeatable
        # (Demo user is not admin; cannot delete directly. Skip if already done.)
        chk = _get("/api/quiz/today", demo_headers).json()
        if chk.get("completed"):
            pytest.skip("Demo already completed quiz today; cannot test ad-gate")
        r = _post("/api/quiz/submit", demo_headers, {"ad_watched": False})
        assert r.status_code == 400
        assert "Rewarded ad" in r.text or "ad" in r.text.lower()

    def test_quiz_submit_credits_points_and_blocks_second(self, demo_headers):
        chk = _get("/api/quiz/today", demo_headers).json()
        if chk.get("completed"):
            pytest.skip("Demo already completed quiz today")
        r = _post("/api/quiz/submit", demo_headers, {"ad_watched": True})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert 50 <= data["points"] <= 200
        # Second call same day
        r2 = _post("/api/quiz/submit", demo_headers, {"ad_watched": True})
        assert r2.status_code == 400
        assert "Already" in r2.text


# ---------- Survey ----------
class TestSurvey:
    def test_survey_today_returns_20_questions(self, demo_headers):
        r = _get("/api/survey/today", demo_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 20
        assert len(data["questions"]) == 20
        for q in data["questions"]:
            assert q.get("q")
            assert isinstance(q.get("options"), list) and len(q["options"]) >= 2

    def test_survey_submit_ad_gate_and_dedupe(self, demo_headers):
        chk = _get("/api/survey/today", demo_headers).json()
        if chk.get("completed"):
            pytest.skip("Demo already completed survey today")
        r0 = _post("/api/survey/submit", demo_headers, {"ad_watched": False})
        assert r0.status_code == 400
        r1 = _post("/api/survey/submit", demo_headers, {"ad_watched": True})
        assert r1.status_code == 200, r1.text
        assert 50 <= r1.json()["points"] <= 200
        r2 = _post("/api/survey/submit", demo_headers, {"ad_watched": True})
        assert r2.status_code == 400


# ---------- Admin: quiz bank CRUD ----------
class TestAdminQuizBank:
    def test_quiz_bank_requires_admin(self, demo_headers):
        r = _get("/api/admin/quiz-bank", demo_headers)
        assert r.status_code == 403

    def test_quiz_bank_returns_100_plus(self, admin_headers):
        r = _get("/api/admin/quiz-bank", admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 100, f"Expected 100+ quiz questions, got {len(data)}"

    def test_quiz_bank_add_then_delete(self, admin_headers):
        body = {
            "q": f"TEST_QQ_{uuid.uuid4().hex[:6]}",
            "options": ["A", "B", "C", "D"],
            "answer": 2,
        }
        r = _post("/api/admin/quiz-bank", admin_headers, body)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["q"] == body["q"]
        assert "id" in created
        # Delete
        d = _delete(f"/api/admin/quiz-bank/{created['id']}", admin_headers)
        assert d.status_code == 200


# ---------- Admin: survey bank CRUD ----------
class TestAdminSurveyBank:
    def test_survey_bank_admin_only(self, demo_headers):
        r = _get("/api/admin/survey-bank", demo_headers)
        assert r.status_code == 403

    def test_survey_bank_returns_50_plus(self, admin_headers):
        r = _get("/api/admin/survey-bank", admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 50, f"Expected 50+ survey questions, got {len(data)}"

    def test_survey_bank_add_then_delete(self, admin_headers):
        body = {"q": f"TEST_S_{uuid.uuid4().hex[:6]}", "options": ["Yes", "No"]}
        r = _post("/api/admin/survey-bank", admin_headers, body)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["q"] == body["q"]
        d = _delete(f"/api/admin/survey-bank/{created['id']}", admin_headers)
        assert d.status_code == 200


# ---------- Admin: ads update ----------
class TestAdminAds:
    def test_update_admob_and_reflect_in_config(self, admin_headers):
        new_vals = {
            "app_id": "ca-app-pub-TEST~111",
            "banner": "ca-app-pub-TEST/222",
            "interstitial": "ca-app-pub-TEST/333",
            "native": "ca-app-pub-TEST/444",
            "rewarded": "ca-app-pub-TEST/555",
        }
        r = _put("/api/admin/ads", admin_headers, new_vals)
        assert r.status_code == 200, r.text
        cfg = _get("/api/config").json()["admob"]
        for k, v in new_vals.items():
            assert cfg[k] == v, f"admob.{k} did not update"

        # Restore defaults so other tests/users see Google test IDs
        defaults = {
            "app_id": "ca-app-pub-3940256099942544~3347511713",
            "banner": "ca-app-pub-3940256099942544/6300978111",
            "interstitial": "ca-app-pub-3940256099942544/1033173712",
            "native": "ca-app-pub-3940256099942544/2247696110",
            "rewarded": "ca-app-pub-3940256099942544/5224354917",
        }
        _put("/api/admin/ads", admin_headers, defaults)


# ---------- Admin: visits CRUD ----------
class TestAdminVisitsCRUD:
    @pytest.fixture
    def created_visit(self, admin_headers):
        body = {"name": f"TEST_VISIT_{uuid.uuid4().hex[:6]}", "url": "https://example.com"}
        r = _post("/api/admin/visits", admin_headers, body)
        assert r.status_code == 200
        site = r.json()
        yield site
        _delete(f"/api/admin/visits/{site['id']}", admin_headers)

    def test_list_visits_admin(self, admin_headers, created_visit):
        r = _get("/api/admin/visits", admin_headers)
        assert r.status_code == 200
        assert any(v["id"] == created_visit["id"] for v in r.json())

    def test_update_visit(self, admin_headers, created_visit):
        r = _put(
            f"/api/admin/visits/{created_visit['id']}",
            admin_headers,
            {"name": "TEST_VISIT_UPDATED"},
        )
        assert r.status_code == 200
        listed = _get("/api/admin/visits", admin_headers).json()
        match = next((v for v in listed if v["id"] == created_visit["id"]), None)
        assert match and match["name"] == "TEST_VISIT_UPDATED"

    def test_delete_visit(self, admin_headers):
        body = {"name": f"TEST_DEL_{uuid.uuid4().hex[:6]}", "url": "https://x.test"}
        site = _post("/api/admin/visits", admin_headers, body).json()
        d = _delete(f"/api/admin/visits/{site['id']}", admin_headers)
        assert d.status_code == 200
        listed = _get("/api/admin/visits", admin_headers).json()
        assert not any(v["id"] == site["id"] for v in listed)


# ---------- Visits credit 50-100 ----------
class TestVisitsComplete:
    def test_visit_complete_credits_random_50_100(self, admin_headers, demo_headers):
        # Create a fresh visit site so demo hasn't completed it
        site = _post(
            "/api/admin/visits",
            admin_headers,
            {"name": f"TEST_FRESH_{uuid.uuid4().hex[:6]}", "url": "https://example.org"},
        ).json()
        try:
            r = _post(f"/api/visits/{site['id']}/complete", demo_headers, {})
            assert r.status_code == 200, r.text
            pts = r.json()["points"]
            assert 50 <= pts <= 100
            # Second call same day → 400
            r2 = _post(f"/api/visits/{site['id']}/complete", demo_headers, {})
            assert r2.status_code == 400
        finally:
            _delete(f"/api/admin/visits/{site['id']}", admin_headers)


# ---------- Tasks submit no longer requires screenshot ----------
class TestTaskSubmitNoScreenshot:
    def test_task_submit_without_screenshot(self, admin_headers, demo_headers):
        # Create a fresh task with require_screenshot=true
        task = _post(
            "/api/admin/tasks",
            admin_headers,
            {
                "logo": "https://x/x.png",
                "name": f"TEST_TASK_{uuid.uuid4().hex[:6]}",
                "note": "Test",
                "points": 100,
                "rules": "rules",
                "youtube_url": "",
                "task_url": "https://example.com",
                "telegram_url": "",
                "require_mobile": True,
                "require_email": True,
                "require_screenshot": True,
                "active": True,
            },
        ).json()
        try:
            r = _post(
                f"/api/tasks/{task['id']}/submit",
                demo_headers,
                {"mobile": "9876543210", "email": "demo@x.com"},
            )
            assert r.status_code == 200, r.text
            sub = r.json()
            assert sub["status"] == "pending"
            assert sub.get("screenshot") in (None, "")
        finally:
            _delete(f"/api/admin/tasks/{task['id']}", admin_headers)
