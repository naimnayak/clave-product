"""Small helpers shared by the API tests."""

import httpx


def auth(uid: str, session: str | None = None) -> dict[str, str]:
    """Headers for a fake Firebase token (see conftest._fake_verify), optionally with a device session id."""
    headers = {"Authorization": f"Bearer test:{uid}", "User-Agent": "Mozilla/5.0 (Macintosh) Chrome/140.0"}
    if session:
        headers["X-Clave-Session"] = session
    return headers


async def signed_up(http: httpx.AsyncClient, uid: str, session: str | None = None) -> dict[str, str]:
    """Creates the account the way the web app does after Firebase sign-up, and returns auth headers."""
    headers = auth(uid, session)
    response = await http.post("/api/auth/sync", json={"name": uid}, headers=headers)
    assert response.status_code == 200, response.text
    return headers


def resume_body(name: str = "My Resume", **extra) -> dict:
    return {
        "name": name,
        "targetRole": "Frontend Developer",
        "content": {
            "contact": {"name": "Test User", "email": "test@example.com"},
            "summary": "Frontend developer.",
            "skills": {"technical": ["React"]},
        },
        **extra,
    }


def error_code(response: httpx.Response) -> str:
    return response.json()["error"]["code"]
