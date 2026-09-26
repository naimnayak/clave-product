"""Resume documents: mirrors src/types/resumeDocument.ts and src/types/resume.ts."""

from typing import Annotated, Literal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel, EntryId, LongText, ShortText, Tags, Text

TemplateId = Literal[
    "classic", "modern", "compact", "minimal", "student", "designer", "engineer", "business", "academic", "executive"
]
ResumeSectionKey = Literal["experience", "education", "projects", "skills", "certifications"]
ResumeType = Literal["base", "tailored"]
SourceType = Literal["manual", "template", "ai", "upload", "tailored", "duplicate"]

DEFAULT_SECTION_ORDER: list[str] = ["experience", "projects", "education", "skills", "certifications"]
Bullets = Annotated[list[Text], Field(max_length=30)]


class ResumeContact(CamelModel):
    name: ShortText = ""
    email: ShortText = ""
    phone: ShortText = ""
    location: ShortText = ""
    linkedin: ShortText = ""
    github: ShortText = ""
    portfolio: ShortText = ""


class ResumeExperience(CamelModel):
    id: EntryId = ""
    title: ShortText = ""
    company: ShortText = ""
    location: ShortText = ""
    start: ShortText = ""
    end: ShortText = ""
    description: Text = ""
    bullets: Bullets = []


class ResumeEducation(CamelModel):
    id: EntryId = ""
    degree: ShortText = ""
    institution: ShortText = ""
    location: ShortText = ""
    dates: ShortText = ""
    details: Text = ""


class ResumeProject(CamelModel):
    id: EntryId = ""
    name: ShortText = ""
    description: Text = ""
    tech: Tags = []
    link: ShortText = ""
    bullets: Bullets = []


class ResumeSkills(CamelModel):
    technical: Tags = []
    tools: Tags = []
    other: Tags = []


class ResumeCertification(CamelModel):
    id: EntryId = ""
    name: ShortText = ""
    issuer: ShortText = ""
    date: ShortText = ""
    link: ShortText = ""


class ResumeContent(CamelModel):
    contact: ResumeContact = Field(default_factory=ResumeContact)
    summary: Text = ""
    experience: Annotated[list[ResumeExperience], Field(max_length=50)] = []
    education: Annotated[list[ResumeEducation], Field(max_length=30)] = []
    projects: Annotated[list[ResumeProject], Field(max_length=50)] = []
    skills: ResumeSkills = Field(default_factory=ResumeSkills)
    certifications: Annotated[list[ResumeCertification], Field(max_length=50)] = []


class ResumeDocumentIn(CamelModel):
    name: ShortText = "Untitled Resume"
    target_role: ShortText = ""
    template: TemplateId = "classic"
    section_order: Annotated[list[ResumeSectionKey], Field(max_length=5)] = Field(
        default_factory=lambda: list(DEFAULT_SECTION_ORDER)
    )
    content: ResumeContent = Field(default_factory=ResumeContent)

    @field_validator("section_order")
    @classmethod
    def _dedupe(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))


class ResumeCreate(ResumeDocumentIn):
    type: ResumeType = "base"
    source_type: SourceType = "manual"
    source_resume_id: EntryId | None = None
    # Required when source_type is "upload": the parsed upload this resume came from.
    source_file_id: EntryId | None = None
    tailored_for: ShortText | None = None
    status: Literal["draft"] | None = None


class ResumePatch(CamelModel):
    name: ShortText | None = None
    target_role: ShortText | None = None
    template: TemplateId | None = None
    status: Literal["draft", "ready"] | None = None


class JobDescriptionInput(CamelModel):
    job_description: LongText = ""
