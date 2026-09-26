"""Career Profile: mirrors src/types/profile.ts."""

from typing import Annotated, Literal

from pydantic import Field

from app.schemas.common import CamelModel, EntryId, ShortText, Tags, Text

ExperienceLevel = Literal["student", "fresher", "early", "experienced"]
WorkMode = Literal["remote", "hybrid", "onsite"]


class ExperienceEntry(CamelModel):
    id: EntryId = ""
    role: ShortText = ""
    company: ShortText = ""
    location: ShortText = ""
    period: ShortText = ""
    summary: Text = ""


class EducationEntry(CamelModel):
    id: EntryId = ""
    institution: ShortText = ""
    degree: ShortText = ""
    period: ShortText = ""
    details: Text = ""


class ProjectEntry(CamelModel):
    id: EntryId = ""
    name: ShortText = ""
    description: Text = ""
    technologies: Tags = []
    link: ShortText = ""


class CertificationEntry(CamelModel):
    id: EntryId = ""
    name: ShortText = ""
    issuer: ShortText = ""
    year: ShortText = ""


class LinkEntry(CamelModel):
    id: EntryId = ""
    label: ShortText = ""
    url: ShortText = ""


class ProfileData(CamelModel):
    name: ShortText = ""
    email: ShortText = ""
    phone: ShortText = ""
    location: ShortText = ""
    summary: Text = ""
    target_roles: Tags = []
    experience_level: ExperienceLevel | None = None
    experience: Annotated[list[ExperienceEntry], Field(max_length=50)] = []
    education: Annotated[list[EducationEntry], Field(max_length=30)] = []
    projects: Annotated[list[ProjectEntry], Field(max_length=50)] = []
    skills: Tags = []
    certifications: Annotated[list[CertificationEntry], Field(max_length=50)] = []
    achievements: Annotated[list[Text], Field(max_length=50)] = []
    links: Annotated[list[LinkEntry], Field(max_length=30)] = []
    work_modes: Annotated[list[WorkMode], Field(max_length=3)] = []
    preferred_locations: ShortText = ""
    industries: Tags = []
