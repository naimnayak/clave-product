"""Builder AI actions, the career assistant chat and mock interviews."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import Field

from app.api.deps import AI_LIMIT, ai_action, stored_profile
from app.core.errors import ApiError, not_found
from app.core.limiter import limiter
from app.core.security import CurrentUser, get_current_user
from app.core.utils import iso, new_id, ok, utcnow
from app.db import mongo
from app.schemas.common import CamelModel, ShortText, Tags, Text
from app.services import ai_tasks, quota
from app.services.accounts import get_user_doc, track_usage

router = APIRouter(prefix="/ai", tags=["AI"])


class TransformContext(CamelModel):
    role: ShortText = ""
    skills: Tags = []
    kind: Literal["summary"] | None = None


class TransformRequest(CamelModel):
    text: Text = ""
    action: Literal["improve", "rewrite", "concise", "impact"]
    context: TransformContext = Field(default_factory=TransformContext)


class ChatTurn(CamelModel):
    role: Literal["user", "assistant"]
    content: Text


class ChatRequest(CamelModel):
    message: Text = Field(min_length=1)
    context: Text = ""
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)


class InterviewSessionRequest(CamelModel):
    role: ShortText = Field(min_length=1)
    level: ShortText = "mid"
    focus_skills: Tags = []
    total_questions: int = Field(default=5, ge=1, le=15)


class InterviewAnswerRequest(CamelModel):
    answer: Text = Field(min_length=1)


@router.get("/usage")
async def ai_usage(user: CurrentUser = Depends(get_current_user)):
    """Today's AI actions used and the daily allowance for the user's plan."""
    return ok(await quota.ai_daily_status(user.uid))


@router.post("/transform")
@limiter.limit(AI_LIMIT)
async def transform(request: Request, payload: TransformRequest, user: CurrentUser = Depends(get_current_user)):
    """Improve / rewrite / shorten / add impact to a summary or bullet (builder AiActions menu)."""
    text = await ai_action(
        user.uid,
        lambda: ai_tasks.transform_text(
            payload.text, payload.action, role=payload.context.role, skills=payload.context.skills, kind=payload.context.kind
        ),
    )
    await track_usage(user.uid, "aiGenerations")
    return ok({"text": text})


@router.post("/chat")
@limiter.limit(AI_LIMIT)
async def chat(request: Request, payload: ChatRequest, user: CurrentUser = Depends(get_current_user)):
    """Career assistant. Uses the Career Profile only when Settings → Privacy → Personalize AI is on."""
    account = await get_user_doc(user)
    personalize = ((account.get("settings") or {}).get("privacy") or {}).get("personalizeAi", True)
    profile = await stored_profile(user.uid) if personalize else None
    history = [turn.dump() for turn in payload.history[-12:]]
    result = await ai_action(user.uid, lambda: ai_tasks.chat(payload.message, payload.context, history=history, profile=profile))
    return ok({**result, "personalized": bool(profile)})


def _session_view(session: dict, *, include_answers: bool = True) -> dict:
    answers = session.get("answers") or []
    scores = [a["evaluation"]["score"] for a in answers]
    view = {
        "sessionId": session["_id"],
        "role": session["role"],
        "level": session["level"],
        "focusSkills": session.get("focusSkills") or [],
        "totalQuestions": session["totalQuestions"],
        "questionIndex": len(session.get("questions") or []),
        "answeredCount": len(answers),
        "completed": len(answers) >= session["totalQuestions"],
        "overallScore": round(sum(scores) / len(scores)) if scores else 0,
        "createdAt": iso(session.get("createdAt")),
        "updatedAt": iso(session.get("updatedAt")),
    }
    if include_answers:
        view["questions"] = session.get("questions") or []
        view["answers"] = answers
    return view


@router.get("/interview/sessions")
async def list_interviews(user: CurrentUser = Depends(get_current_user), limit: int = Query(10, ge=1, le=50)):
    cursor = mongo.interview_sessions().find({"uid": user.uid}).sort("createdAt", -1).limit(limit)
    return ok([_session_view(doc, include_answers=False) async for doc in cursor])


@router.post("/interview/sessions", status_code=201)
@limiter.limit(AI_LIMIT)
async def start_interview(request: Request, payload: InterviewSessionRequest, user: CurrentUser = Depends(get_current_user)):
    question = await ai_action(user.uid, lambda: ai_tasks.interview_question(payload.role, payload.level, payload.focus_skills, []))
    now = utcnow()
    session = {
        "_id": new_id("int_"),
        "uid": user.uid,
        "role": payload.role.strip(),
        "level": payload.level.strip() or "mid",
        "focusSkills": payload.focus_skills,
        "totalQuestions": payload.total_questions,
        "questions": [question],
        "answers": [],
        "createdAt": now,
        "updatedAt": now,
    }
    await mongo.interview_sessions().insert_one(session)
    return ok(_session_view(session))


@router.post("/interview/sessions/{session_id}/answers")
@limiter.limit(AI_LIMIT)
async def answer_interview(
    request: Request, session_id: str, payload: InterviewAnswerRequest, user: CurrentUser = Depends(get_current_user)
):
    session = await mongo.interview_sessions().find_one({"_id": session_id, "uid": user.uid})
    if session is None:
        raise not_found("Interview session")
    questions, answers = session["questions"], session["answers"]
    if len(answers) >= session["totalQuestions"]:
        raise ApiError(409, "CONFLICT", "This interview is already complete.")
    current = questions[len(answers)]

    async def evaluate_and_continue() -> dict:
        evaluation = await ai_tasks.evaluate_answer(current["question"], payload.answer, session["role"], session["level"])
        next_question = None
        if len(answers) + 1 < session["totalQuestions"]:
            asked = [q["question"] for q in questions]
            next_question = await ai_tasks.interview_question(session["role"], session["level"], session["focusSkills"], asked)
        return {"evaluation": evaluation, "next": next_question}

    # Evaluating and asking the next question count as one AI action.
    result = await ai_action(user.uid, evaluate_and_continue)
    evaluation = result["evaluation"]
    answers.append({"questionIndex": len(answers) + 1, "question": current["question"], "answer": payload.answer.strip(), "evaluation": evaluation})
    if result["next"]:
        questions.append(result["next"])

    session.update(questions=questions, answers=answers, updatedAt=utcnow())
    await mongo.interview_sessions().update_one(
        {"_id": session_id, "uid": user.uid},
        {"$set": {"questions": questions, "answers": answers, "updatedAt": session["updatedAt"]}},
    )
    await track_usage(user.uid, "aiGenerations")
    return ok({**_session_view(session), "evaluation": evaluation})


@router.get("/interview/sessions/{session_id}")
async def get_interview(session_id: str, user: CurrentUser = Depends(get_current_user)):
    session = await mongo.interview_sessions().find_one({"_id": session_id, "uid": user.uid})
    if session is None:
        raise not_found("Interview session")
    return ok(_session_view(session))


@router.delete("/interview/sessions/{session_id}", status_code=204)
async def delete_interview(session_id: str, user: CurrentUser = Depends(get_current_user)):
    await mongo.interview_sessions().delete_one({"_id": session_id, "uid": user.uid})
    return Response(status_code=204)

