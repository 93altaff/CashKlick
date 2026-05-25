import os
import pytest
import requests


def _resolve_base_url() -> str:
    url = (
        os.environ.get("EXPO_BACKEND_URL")
        or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    )
    if not url:
        # fallback parse from frontend/.env
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                        url = line.split("=", 1)[1].strip().strip('"')
                        break
        except FileNotFoundError:
            pass
    if not url:
        raise RuntimeError("Backend URL not configured")
    return url.rstrip("/")


BASE_URL = _resolve_base_url()
DEMO_TOKEN = "demo_session_token_001"
ADMIN_EMAIL = "93altaff@gmail.com"
ADMIN_PASSWORD = "9372@Altaf93"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_headers():
    return {"Authorization": f"Bearer {DEMO_TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(
        f"{BASE_URL}/api/auth/admin-login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["session_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
