"""Strongly typed contracts shared by slide template builder tools."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Keep the runtime validator aligned with the slide template backend contract.
# Template IDs use the SLIDE- prefix; category codes remain PPT-CATE-* values.
BACKEND_TEMPLATE_ID_PATTERN = r"^SLIDE-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$"
BACKEND_CATEGORY_CODE_PATTERN = r"^(?:PPT|SLIDE)-CATE-[a-z0-9]+(?:-[a-z0-9]+)*$"
SLIDE_FILE_PATTERN = r"^slides/[A-Za-z0-9\u3400-\u4DBF\u4E00-\u9FFF][A-Za-z0-9\u3400-\u4DBF\u4E00-\u9FFF-]*\.html$"
LAYOUT_PATTERN = r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$"
ReconstructionMode = Literal["high-fidelity", "template-abstraction", "hybrid"]


class TemplateCanvas(BaseModel):
    """Fixed slide canvas dimensions in CSS pixels."""

    width: int = Field(..., ge=320, le=8192)
    height: int = Field(..., ge=180, le=8192)

    def as_tuple(self) -> tuple[int, int]:
        return self.width, self.height


class TemplateI18nText(BaseModel):
    zh_CN: str = Field(..., min_length=1, max_length=1000)
    en_US: str = Field(..., min_length=1, max_length=1000)

    @field_validator("zh_CN", "en_US")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("localized text cannot be empty")
        return value


class TemplateLabelText(TemplateI18nText):
    zh_CN: str = Field(..., min_length=1, max_length=100)
    en_US: str = Field(..., min_length=1, max_length=100)


class TemplateDescriptionText(TemplateI18nText):
    zh_CN: str = Field(..., min_length=1, max_length=1000)
    en_US: str = Field(..., min_length=1, max_length=1000)


class TemplateSourceParams(BaseModel):
    kind: Literal["original", "derived"]
    method: Literal[
        "manual",
        "brief-generator",
        "image-rebuild",
        "html-import",
        "visual-reconstruction",
        "project-extract",
    ]
    file: str = Field("", max_length=255)
    canvas: TemplateCanvas = Field(default_factory=lambda: TemplateCanvas(width=1920, height=1080))

    @field_validator("file")
    @classmethod
    def validate_source_file(cls, value: str) -> str:
        value = value.strip()
        if "/" in value or "\\" in value:
            raise ValueError("source.file must be a basename, not a path")
        return value


class TemplateSlideParams(BaseModel):
    file: str = Field(..., pattern=SLIDE_FILE_PATTERN)
    title: str = Field(..., min_length=1, max_length=200)
    layout: str = Field(..., pattern=LAYOUT_PATTERN)
    description: str = Field(..., min_length=1, max_length=1000)

    @field_validator("title", "description")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("slide text cannot be empty")
        return value
