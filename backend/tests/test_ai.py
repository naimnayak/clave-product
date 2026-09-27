"""AI endpoints with the model mocked: daily allowance, refunds on failure, personalization and interviews."""

import json
from datetime import timedelta

import pytest

from app.core.utils import utcnow
from app.db import mongo
from app.services import ai_tasks
from app.services import chat as chat_service
from app.services.ai_client import AIResponseError, AIUnavailableError
from tests.helpers import error_code, resume_body, signed_up

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

    usage = (await client.get("/api/ai/usage", headers=headers)).json()["data"]
    assert usage == {"limit": 3, "used": 3, "chatLimit": 4, "chatUsed": 0, "isPro": False}

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


@pytest.fixture
def fake_chat(monkeypatch):
    """Records what the assistant was given each turn."""
    calls: list[dict] = []

    async def chat(message, *, history, user_context, extra_context=""):
        calls.append({"message": message, "history": history, "context": json.loads(user_context)})
        return {"reply": f"echo: {message}", "suggestedActions": ["Next?"]}

    async def summarize_memory(transcript, existing):
        return {"facts": [f"Asked: {t['content']}" for t in transcript if t["role"] == "user"], "summary": "Preparing for data roles."}

    monkeypatch.setattr(ai_tasks, "chat", chat)
    monkeypatch.setattr(ai_tasks, "summarize_memory", summarize_memory)
    return calls


async def test_chat_session_carries_context_and_history(client, fake_chat):
    headers = await signed_up(client, "chatter")
    await client.put("/api/profile", json={"name": "Chatter", "targetRoles": ["Data Analyst"]}, headers=headers)
    await client.post("/api/resumes", json=resume_body("Data CV"), headers=headers)

    assert (await client.get("/api/ai/chat/session", headers=headers)).json()["data"] is None
    first = (await client.post("/api/ai/chat", json={"message": "Hi"}, headers=headers)).json()["data"]
    assert first["reply"] == "echo: Hi" and first["personalized"] is True
    assert [m["role"] for m in first["session"]["messages"]] == ["user", "assistant"]
    context = fake_chat[-1]["context"]
    assert context["careerProfile"]["targetRoles"] == ["Data Analyst"]
    assert context["latestResume"]["name"] == "Data CV" and context["plan"] == "Free"

    # The next turn (even from another device, no client history) continues the same conversation.
    await client.post("/api/ai/chat", json={"message": "And then?"}, headers=headers)
    assert [t["content"] for t in fake_chat[-1]["history"]] == ["Hi", "echo: Hi"]
    session = (await client.get("/api/ai/chat/session", headers=headers)).json()["data"]
    assert len(session["messages"]) == 4 and session["id"] == first["session"]["id"]

    usage = (await client.get("/api/ai/usage", headers=headers)).json()["data"]
    assert usage["chatUsed"] == 2 and usage["used"] == 0  # chat has its own daily cap


async def test_new_chat_saves_memory_for_next_session(client, fake_chat):
    headers = await signed_up(client, "rememberer")
    await client.post("/api/ai/chat", json={"message": "I want to become a data analyst"}, headers=headers)
    assert (await client.post("/api/ai/chat/session/end", headers=headers)).status_code == 200
    assert await mongo.chat_sessions().count_documents({"uid": "rememberer"}) == 0  # transcript deleted

    memory = (await client.get("/api/ai/memory", headers=headers)).json()["data"]
    assert memory["facts"] == ["Asked: I want to become a data analyst"]

    await client.post("/api/ai/chat", json={"message": "Hello again"}, headers=headers)
    assert fake_chat[-1]["history"] == []
    assert fake_chat[-1]["context"]["memoryFromPastConversations"]["facts"] == memory["facts"]

    assert (await client.delete("/api/ai/memory", headers=headers)).status_code == 204
    assert (await client.get("/api/ai/memory", headers=headers)).json()["data"]["facts"] == []


async def test_sessions_close_after_48_hours(client, fake_chat):
    headers = await signed_up(client, "sleeper")
    await client.post("/api/ai/chat", json={"message": "Remember my goal"}, headers=headers)
    await mongo.chat_sessions().update_one({"uid": "sleeper"}, {"$set": {"closesAt": utcnow() - timedelta(minutes=1)}})

    assert await chat_service.close_due_sessions() == 1
    assert (await mongo.user_memory().find_one({"_id": "sleeper"}))["facts"] == ["Asked: Remember my goal"]
    assert (await client.get("/api/ai/chat/session", headers=headers)).json()["data"] is None


async def test_chat_without_personalization_shares_nothing(client, fake_chat):
    headers = await signed_up(client, "private")
    await client.put("/api/profile", json={"name": "Private", "targetRoles": ["Designer"]}, headers=headers)
    settings = (await client.get("/api/me/settings", headers=headers)).json()["data"]
    settings["privacy"]["personalizeAi"] = False
    await client.put("/api/me/settings", json=settings, headers=headers)

    reply = (await client.post("/api/ai/chat", json={"message": "Hi"}, headers=headers)).json()["data"]
    assert reply["personalized"] is False
    assert "careerProfile" not in fake_chat[-1]["context"]
    await client.post("/api/ai/chat/session/end", headers=headers)
    assert await mongo.user_memory().find_one({"_id": "private"}) is None


async def test_chat_daily_cap(client, fake_chat):
    headers = await signed_up(client, "talker")
    for i in range(4):  # CHAT_DAILY_LIMIT_FREE=4 in conftest
        assert (await client.post("/api/ai/chat", json={"message": f"m{i}"}, headers=headers)).status_code == 200
    blocked = await client.post("/api/ai/chat", json={"message": "one more"}, headers=headers)
    assert blocked.status_code == 429 and error_code(blocked) == "AI_DAILY_LIMIT_REACHED"


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

    # FREE_MOCK_INTERVIEWS=1: the next one needs Pro (deleting doesn't give it back).
    again = await client.post("/api/ai/interview/sessions", json={"role": "Backend Developer"}, headers=headers)
    assert again.status_code == 402 and error_code(again) == "PRO_REQUIRED"
    await mongo.users().update_one(
        {"_id": "candidate"}, {"$set": {"subscription.plan": "monthly", "subscription.currentPeriodEnd": utcnow() + timedelta(days=5)}}
    )
    assert (await client.post("/api/ai/interview/sessions", json={"role": "Backend Developer"}, headers=headers)).status_code == 201
