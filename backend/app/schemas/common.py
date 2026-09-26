from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Accepts and emits camelCase JSON to match the TypeScript types in src/types."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")

    def dump(self) -> dict:
        return self.model_dump(by_alias=True)


EntryId = Annotated[str, Field(max_length=100)]
ShortText = Annotated[str, Field(max_length=300)]
Text = Annotated[str, Field(max_length=5_000)]
LongText = Annotated[str, Field(max_length=20_000)]
Tags = Annotated[list[Annotated[str, Field(max_length=120)]], Field(max_length=100)]
