"""幻灯片过渡的严格参数及局部配置更新；不执行项目 JavaScript。"""

import copy
import json
from enum import StrEnum
from pathlib import PurePosixPath
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.tools.core import BaseToolParams
from app.utils.slide_project_config import parse_project_config


class TransitionEffect(StrEnum):
    NONE = "none"
    FADE = "fade"
    PUSH = "push"
    COVER = "cover"
    WIPE = "wipe"
    ZOOM = "zoom"


class TransitionOperation(StrEnum):
    SET_DEFAULT = "set_default"
    SET_SLIDES = "set_slides"
    CLEAR_OVERRIDES = "clear_overrides"


class SlideTransition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    effect: TransitionEffect
    duration_ms: int | None = Field(default=None, strict=True, ge=100, le=2000, multiple_of=50)
    easing: Literal["linear", "ease-in-out"] | None = None
    direction: Literal["left", "right", "up", "down"] | None = None

    @model_validator(mode="after")
    def validate_setting(self):
        if self.effect == TransitionEffect.NONE:
            if self.model_fields_set != {"effect"}:
                raise ValueError("The none effect accepts only effect.")
        else:
            if self.duration_ms is None or self.easing is None:
                raise ValueError("Animated effects require duration_ms and easing.")
            directional = self.effect in {TransitionEffect.PUSH, TransitionEffect.COVER, TransitionEffect.WIPE}
            if directional != (self.direction is not None):
                raise ValueError("Only push, cover and wipe require a direction.")
            if not directional and "direction" in self.model_fields_set:
                raise ValueError("This effect does not accept direction.")
        return self


def validate_slide_path(value: str) -> str:
    path = PurePosixPath(value)
    if (
        not value or path.is_absolute() or str(path) != value
        or any(part in {".", "..", "__proto__", "constructor", "prototype"} for part in path.parts)
        or any(char in value for char in ("\\", "\x00", "?", "#", ":"))
        or path.suffix.lower() != ".html"
    ):
        raise ValueError("Slide paths must be canonical project-relative HTML paths.")
    return value


class SlideTransitionOperation(BaseModel):
    """One default or shared page transition update."""

    # 一组页面共享完整设置；默认设置与页面覆盖可在同一批次提交。
    model_config = ConfigDict(extra="forbid")
    operation: TransitionOperation = Field(description="Transition update operation.")
    slide_paths: list[str] = Field(default_factory=list, description="Existing slide paths; required for set_slides and clear_overrides.")
    transition: SlideTransition | None = Field(default=None, description="Complete transition setting for set operations; omitted for clear_overrides.")
    clear_overrides: bool = Field(default=False, strict=True, description="Only for set_default: true replaces all page overrides with the new default.")

    @model_validator(mode="after")
    def validate_operation(self):
        for path in self.slide_paths:
            validate_slide_path(path)
        if len(set(self.slide_paths)) != len(self.slide_paths):
            raise ValueError("slide_paths must contain unique paths.")
        if self.operation == TransitionOperation.SET_DEFAULT:
            if self.slide_paths:
                raise ValueError("set_default does not accept slide_paths.")
        elif not self.slide_paths or self.clear_overrides:
            raise ValueError("Page operations require slide_paths and cannot clear all overrides.")
        if (self.operation == TransitionOperation.CLEAR_OVERRIDES) != (self.transition is None):
            raise ValueError("Set operations require transition; clear_overrides does not accept transition.")
        return self


class UpdateSlideTransitionsParams(BaseToolParams):
    model_config = ConfigDict(extra="forbid")
    project_path: str = Field(description="Existing slide project directory, relative to the workspace.")
    expected_slides: list[str] = Field(description="Ordered slide paths used to resolve this request.")
    operations: list[SlideTransitionOperation] = Field(min_length=1, description="Default and page updates to validate and save together.")

    @model_validator(mode="after")
    def validate_batch(self):
        for path in self.expected_slides:
            validate_slide_path(path)
        if len(set(self.expected_slides)) != len(self.expected_slides):
            raise ValueError("expected_slides must contain unique paths.")
        targets = set()
        for index, operation in enumerate(self.operations):
            if operation.operation == TransitionOperation.SET_DEFAULT and index != 0:
                raise ValueError("set_default may appear only once, as the first operation.")
            for path in operation.slide_paths:
                if path in targets:
                    raise ValueError("Each slide may appear in only one operation.")
                targets.add(path)
        return self


def merge_transitions(config: dict, params: UpdateSlideTransitionsParams) -> dict:
    slides = config.get("slides")
    if config.get("type") != "slide" or slides != params.expected_slides:
        raise ValueError("The deck or slide order changed. Reread the deck and resolve the requested pages again.")
    if any(path not in slides for operation in params.operations for path in operation.slide_paths):
        raise ValueError("Every target must be an existing slide in the current deck.")
    result = copy.deepcopy(config)
    transitions = result.setdefault("transitions", {})
    if not isinstance(transitions, dict):
        raise ValueError("The existing transitions field is invalid; no changes were saved.")
    for operation in params.operations:
        _apply_operation(transitions, operation)
    return result


def _apply_operation(transitions: dict, operation: SlideTransitionOperation) -> None:
    if operation.operation == TransitionOperation.SET_DEFAULT:
        transitions["default"] = operation.transition.model_dump(mode="json", exclude_none=True)
        if operation.clear_overrides:
            transitions.pop("slides", None)
    else:
        overrides = transitions.setdefault("slides", {})
        if not isinstance(overrides, dict):
            raise ValueError("The existing transition overrides are invalid; no changes were saved.")
        for path in operation.slide_paths:
            if operation.operation == TransitionOperation.CLEAR_OVERRIDES:
                overrides.pop(path, None)
            else:
                overrides[path] = operation.transition.model_dump(mode="json", exclude_none=True)
        if not overrides:
            transitions.pop("slides", None)


def update_project_content(content: str, params: UpdateSlideTransitionsParams) -> str:
    # 只替换配置对象，保留外围包装、未修改字段和未知字段。不修复有歧义的源文件。
    parsed = parse_project_config(content)
    updated = merge_transitions(parsed.config, params)
    if updated == parsed.config:
        return content
    return (
        content[:parsed.start]
        + json.dumps(updated, ensure_ascii=False, indent=2, allow_nan=False)
        + content[parsed.end:]
    )
