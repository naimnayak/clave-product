"""User settings: mirrors src/types/settings.ts."""

from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel
from app.schemas.resume import TemplateId


class NotificationSettings(CamelModel):
    jobs: bool = True
    resumes: bool = True
    applications: bool = True
    product: bool = True


class PrivacySettings(CamelModel):
    personalize_ai: bool = True
    usage_data: bool = False


class UserSettings(CamelModel):
    date_format: Literal["dmy", "mdy", "iso"] = "dmy"
    email_preference: Literal["important", "product", "none"] = "important"
    notifications: NotificationSettings = Field(default_factory=NotificationSettings)
    privacy: PrivacySettings = Field(default_factory=PrivacySettings)
    default_template: TemplateId = "classic"
