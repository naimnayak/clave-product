# 03 · Pydantic Schemas

Shared models live in `backend/app/schemas/`; endpoint-specific request models are defined at the top of each `app/api/*.py` file. AI output models (private, prefixed `_`) live in `app/services/ai_tasks.py` and `job_ingest.py` (see 05).

## Base types (`schemas/common.py`)

`CamelModel` (Pydantic v2): `alias_generator=to_camel`, `populate_by_name=True`, `extra="ignore"`. It accepts camelCase or snake_case input, ignores unknown fields, and `dump()` emits camelCase.

| Alias | Constraint |
|---|---|
| EntryId | str ≤ 100 |
| ShortText | str ≤ 300 |
| Text | str ≤ 5,000 |
| LongText | str ≤ 20,000 |
| Tags | list (≤ 100) of str ≤ 120 |

## Career Profile (`schemas/profile.py`, mirrors `src/types/profile.ts`)

```python
ProfileData:
  name, email, phone, location: ShortText; summary: Text
  targetRoles: Tags
  experienceLevel: "student" | "fresher" | "early" | "experienced" | None
  experience: list[ExperienceEntry] (≤50)      # id, role, company, location, period, summary
  education: list[EducationEntry] (≤30)        # id, institution, degree, period, details
  projects: list[ProjectEntry] (≤50)           # id, name, description, technologies: Tags, link
  skills: Tags
  certifications: list[CertificationEntry] (≤50)  # id, name, issuer, year
  achievements: list[Text] (≤50)
  links: list[LinkEntry] (≤30)                 # id, label, url
  workModes: list["remote"|"hybrid"|"onsite"] (≤3)
  preferredLocations: ShortText; industries: Tags
```

## Resume (`schemas/resume.py`, mirrors `src/types/resumeDocument.ts`, `resume.ts`)

```python
TemplateId = "classic"|"modern"|"compact"|"minimal"|"student"|"designer"|"engineer"|"business"|"academic"|"executive"
ResumeSectionKey = "experience"|"education"|"projects"|"skills"|"certifications"
ResumeType = "base"|"tailored"
SourceType = "manual"|"template"|"ai"|"upload"|"tailored"|"duplicate"

ResumeContent:
  contact: ResumeContact        # name, email, phone, location, linkedin, github, portfolio
  summary: Text
  experience: list[ResumeExperience] (≤50)  # id, title, company, location, start, end, description, bullets (≤30)
  education: list[ResumeEducation] (≤30)    # id, degree, institution, location, dates, details
  projects: list[ResumeProject] (≤50)       # id, name, description, tech: Tags, link, bullets
  skills: ResumeSkills                      # technical, tools, other: Tags
  certifications: list[ResumeCertification] (≤50)  # id, name, issuer, date, link

ResumeDocumentIn:
  name = "Untitled Resume"; targetRole; template = "classic"
  sectionOrder: list[ResumeSectionKey] (≤5, de-duplicated; default experience, projects, education, skills, certifications)
  content: ResumeContent

ResumeCreate(ResumeDocumentIn):
  type = "base"; sourceType = "manual"; sourceResumeId?; sourceFileId? (required for "upload")
  tailoredFor?; status: "draft" | None

ResumePatch: name?, targetRole?, template?, status: "draft"|"ready" | None
JobDescriptionInput: jobDescription: LongText = ""
```

Responses: `ResumeSummary` = `{id, name, targetRole, template, atsScore, type, tailoredFor?, status?, sourceType, sourceResumeId?, createdAt, updatedAt}` (None values dropped). `ResumeDocument` = summary + `sectionOrder` + `content` (`services/resumes.py`).

## Settings (`schemas/settings.py`, mirrors `src/types/settings.ts`)

```python
UserSettings:
  dateFormat: "dmy"|"mdy"|"iso" = "dmy"
  emailPreference: "important"|"product"|"none" = "important"
  notifications: {jobs, resumes, applications, product: bool = True}
  privacy: {personalizeAi: bool = True, usageData: bool = False}
  defaultTemplate: TemplateId = "classic"
```

## Request models in API files

| File | Model | Fields |
|---|---|---|
| account.py | SyncRequest | `name?: ShortText` |
| account.py | AccountUpdate | `name?: ShortText`, `avatarUrl?: str ≤ 400,000` |
| resumes.py | AnalyzeJobRequest | `targetRole` (required), `jobDescription: LongText`, `careerProfile?: ProfileData` |
| resumes.py | JobAnalysisIn | `keyRequirements, matchedSkills, gaps: Tags` |
| resumes.py | GenerateRequest | `targetRole` (required), `industry`, `jobDescription: LongText`, `attempt: 0-20`, `template?`, `jobAnalysis?` |
| resumes.py | TailorRequest | `jobTitle`, `company`, `jobDescription: LongText` (required) |
| ai.py | TransformRequest | `text: Text`, `action: improve\|rewrite\|concise\|impact`, `context: {role, skills: Tags, kind?: "summary"}` |
| ai.py | ChatRequest | `message: Text` (required), `context: Text`, `history: list[ChatTurn] ≤ 20` (`role: user\|assistant`, `content`) |
| ai.py | InterviewSessionRequest | `role` (required), `level="mid"`, `focusSkills: Tags`, `totalQuestions: 1-15 = 5` |
| ai.py | InterviewAnswerRequest | `answer: Text` (required) |
| applications.py | ApplicationUpdate | `status: applied\|interviewing\|rejected`, `notes?: Text` |
| notifications.py | MarkRead | `ids: list[str] ≤ 100` |
| support.py | ContactRequest | `name` (required), `email: EmailStr`, `topic="General question"`, `message: 10-5000`, `website` (honeypot) |
| support.py | FeedbackRequest | `message: 3-5000`, `page`, `rating?: 1-5` |
| billing.py | CreateOrderRequest | `plan: single\|monthly` |
| billing.py | VerifyPaymentRequest | `razorpayOrderId ≤100`, `razorpayPaymentId ≤100`, `razorpaySignature ≤200` |

Query parameters (job filters, limits) are validated with FastAPI `Query` constraints listed in 02.
