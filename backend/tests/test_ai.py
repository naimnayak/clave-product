"""AI endpoints with the model mocked: daily allowance, refunds on failure, personalization and interviews."""

import pytest

from app.services import ai_tasks
from app.services.ai_client import AIResponseError, AIUnavailableError
from tests.helpers import error_code, signed_up

TRANSFORM = {"text": "Built pages", "action": "improve", "context": {"role": "Frontend Developer", "skills": ["React"]}}


@pytest.fixture
def fake_transform(monkeypatch):
    async def transform_text(text, action, **_):
        return f"{text} (improved)"

    monkeypatch.setattr(ai_tasks, "transform_text", transform_text)


async def test_daily_limit_and_usage(client, fake_transform):
    headers = await signed_up(client, "ai-user")
    for _ in range(3):  # AI_DAILY_LIMIT_FREE=3 in conftest
        response = await client.post("/api/ai/transform", json=TRANSFORM, headers=headers)
        assert response.status_code == 200
        assert response.json()["data"]["text"] == "Built pages (improved)"

    assert (await client.get("/api/ai/usage", headers=headers)).json()["data"] == {"limit": 3, "used": 3}

    blocked = await client.post("/api/ai/transform", json=TRANSFORM, headers=headers)
    assert blocked.status_code == 429 and error_code(blocked) == "AI_DAILY_LIMIT_REACHED"


async def test_failed_calls_are_refunded(client, monkeypatch):
    headers = await signed_up(client, "unlucky")
    # Parametrize doesn't combine with the anyio marker added in conftest, so loop instead.
    for error, status in [(AIResponseError("bad output"), 502), (AIUnavailableError("busy"), 503)]:
        async def broken(*_args, _error=error, **_kwargs):
            raise _error

        monkeypatch.setattr(ai_tasks, "transform_text", broken)
        response = await client.post("/api/ai/transform", json=TRANSFORM, headers=headers)
        assert response.status_code == status and error_code(response) == "AI_GENERATION_FAILED"
        assert (await client.get("/api/ai/usage", headers=headers)).json()["data"]["used"] == 0


async def test_chat_respects_personalize_setting(client, monkeypatch):
    seen: list = []

    async def chat(message, context, *, history, profile):
        seen.append(profile)
        return {"reply": f"echo: {message}", "suggestedActions": []}

    monkeypatch.setattr(ai_tasks, "chat", chat)
    headers = await signed_up(client, "chatter")
    await client.put("/api/profile", json={"name": "Chatter", "targetRoles": ["Data Analyst"]}, headers=headers)

    on = await client.post("/api/ai/chat", json={"message": "Hi", "history": [{"role": "assistant", "content": "Hello"}]}, headers=headers)
    assert on.status_code == 200
    assert on.json()["data"] == {"reply": "echo: Hi", "suggestedActions": [], "personalized": True}
    assert seen[-1]["targetRoles"] == ["Data Analyst"]

    settings = (await client.get("/api/me/settings", headers=headers)).json()["data"]
    settings["privacy"]["personalizeAi"] = False
    await client.put("/api/me/settings", json=settings, headers=headers)

    off = await client.post("/api/ai/chat", json={"message": "Hi again"}, headers=headers)
    assert off.json()["data"]["personalized"] is False
    assert seen[-1] is None


async def test_mock_interview_flow(client, monkeypatch):
    async def question(role, level, focus, asked):
        return {"question": f"Question {len(asked) + 1} for {role}", "category": "technical", "difficulty": "medium", "expectedKeyPoints": []}

    async def evaluate(question_text, answer, role, level):
        return {"score": 80, "summary": "Good", "whatWorked": ["Clear"], "improvementPoints": ["Add an example"]}

    monkeypatch.setattr(ai_tasks, "interview_question", question)
    monkeypatch.setattr(ai_tasks, "evaluate_answer", evaluate)
    headers = await signed_up(client, "candidate")

    started = await client.post("/api/ai/interview/sessions", json={"role": "Backend Developer", "totalQuestions": 2}, headers=headers)
    assert started.status_code == 201
    session_id = started.json()["data"]["sessionId"]

    first = (await client.post(f"/api/ai/interview/sessions/{session_id}/answers", json={"answer": "My answer"}, headers=headers)).json()["data"]
    assert first["evaluation"]["score"] == 80 and first["questionIndex"] == 2 and not first["completed"]

    second = (await client.post(f"/api/ai/interview/sessions/{session_id}/answers", json={"answer": "Another"}, headers=headers)).json()["data"]
    assert second["completed"] and second["overallScore"] == 80

    done = await client.post(f"/api/ai/interview/sessions/{session_id}/answers", json={"answer": "Extra"}, headers=headers)
    assert done.status_code == 409

    listed = (await client.get("/api/ai/interview/sessions", headers=headers)).json()["data"]
    assert [s["sessionId"] for s in listed] == [session_id] and "answers" not in listed[0]

    other = await signed_up(client, "snoop")
    assert (await client.get(f"/api/ai/interview/sessions/{session_id}", headers=other)).status_code == 404
    assert (await client.delete(f"/api/ai/interview/sessions/{session_id}", headers=headers)).status_code == 204
