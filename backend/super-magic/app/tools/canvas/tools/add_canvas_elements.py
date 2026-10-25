"""新增 Canvas Element 工具。"""

from __future__ import annotations

import math
from functools import partial
from typing import Any, Literal, cast

from pydantic import ConfigDict, Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.application.commands import (
    AddElementCommand,
    CompositionParameters,
    ContentCommand,
    CreationConnectionCommand,
    GenerationParameters,
    LayoutCommand,
)
from app.tools.canvas.domain.content_fields import (
    ContentFieldsFactory,
    EllipseContentFields,
    RectangleContentFields,
    StarContentFields,
    StoryboardContentFields,
    TextContentFields,
    TriangleContentFields,
    VideoEditContentFields,
)
from app.tools.canvas.domain.content_fields.generated_media_protocol import generated_media_types
from app.tools.canvas.domain.types import JsonObject
from app.tools.canvas.presentation import (
    CanvasGenerationFeedback,
    CanvasToolDetailBuilder,
    batch_tool_result,
    canvas_remark,
    canvas_result_remark,
    error_result,
    items_content,
    summarize_tool_result,
)
from app.tools.canvas.production.contracts.composition_output import CompositionOutput
from app.tools.canvas.tools.agent_write_policy import CanvasAgentWritePolicy
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry

SdkSnippetTimeoutRegistry.register("add_canvas_elements", min_timeout=600)

CanvasElementType = Literal[
    "text",
    "rectangle",
    "ellipse",
    "triangle",
    "star",
    "image",
    "video",
    "audio",
    "storyboard",
    "video-edit",
]
# 这里只列画布请求构造器拼得出来的输入模式；模型是否支持由后端按能力声明校验。
# draft_task 故意不在其中：成片需要 inputs.draft_task 携带样片引用，构造器没有该输入，
# 成片改由画布 UI 的「出成片」按钮提交，不由 Agent 提交。
VideoInputMode = Literal[
    "standard",
    "image_reference",
    "omni_reference",
    "keyframe_guided",
    "video_edit",
]


class CanvasPositionInput(BaseToolParams):
    """显式布局坐标。"""

    model_config = ConfigDict(extra="forbid")

    x: float
    y: float

    @model_validator(mode="after")
    def validate_finite_coordinates(self) -> "CanvasPositionInput":
        """拒绝不能写入 Canvas 的无穷值和非数字值。"""
        if not math.isfinite(self.x) or not math.isfinite(self.y):
            raise ValueError("position.x and position.y must be finite numbers")
        return self


class CanvasLayoutInput(BaseToolParams):
    """新增 Element 使用的确定布局参数。"""

    model_config = ConfigDict(extra="forbid")

    strategy: Literal["row_incremental", "dependency_flow", "explicit_position"]
    position: CanvasPositionInput | None = None

    @model_validator(mode="after")
    def validate_position(self) -> "CanvasLayoutInput":
        """限制显式坐标只用于 explicit_position。"""
        if self.strategy == "explicit_position" and self.position is None:
            raise ValueError("explicit_position requires position")
        if self.strategy != "explicit_position" and self.position is not None:
            raise ValueError("position is only allowed for explicit_position")
        return self

    def to_command(self) -> LayoutCommand:
        """转换为应用层布局命令。"""
        position = (self.position.x, self.position.y) if self.position is not None else None
        return LayoutCommand(strategy=self.strategy, position=position)


class CanvasCreationConnectionInput(BaseToolParams):
    """新增 Element 时使用的确定初始连线参数。"""

    model_config = ConfigDict(extra="forbid")

    source_element_id: str | None = None
    source_item_ref: str | None = None
    target_element_id: str | None = None
    target_item_ref: str | None = None

    @model_validator(mode="after")
    def validate_anchor(self) -> "CanvasCreationConnectionInput":
        """保证每条初始连线只有一个外部锚点。"""
        values = (
            self.source_element_id,
            self.source_item_ref,
            self.target_element_id,
            self.target_item_ref,
        )
        if sum(value is not None for value in values) != 1:
            raise ValueError("each initial connection must provide exactly one source or target reference")
        return self

    def to_command(self) -> CreationConnectionCommand:
        """转换为应用层初始连线命令。"""
        return CreationConnectionCommand(
            source_element_id=self.source_element_id,
            source_item_ref=self.source_item_ref,
            target_element_id=self.target_element_id,
            target_item_ref=self.target_item_ref,
        )


class TextStyleInput(BaseToolParams):
    """富文本字符样式。"""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    font_size: float | None = Field(None, alias="fontSize")
    font_weight: int | str | None = Field(None, alias="fontWeight")
    color: str | None = None
    font_family: str | None = Field(None, alias="fontFamily")
    bold: bool | None = None
    italic: bool | None = None
    underline: bool | None = None
    strikethrough: bool | None = None
    background_color: str | None = Field(None, alias="backgroundColor")
    letter_spacing: float | None = Field(None, alias="letterSpacing")


class ParagraphStyleInput(BaseToolParams):
    """富文本段落样式。"""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    text_align: Literal["left", "center", "right", "justify"] | None = Field(None, alias="textAlign")
    line_height: float | None = Field(None, gt=0, alias="lineHeight")


class RichTextNodeInput(BaseToolParams):
    """富文本字符节点。"""

    model_config = ConfigDict(extra="forbid")

    type: Literal["text"] = "text"
    text: str
    style: TextStyleInput | None = None


class RichTextParagraphInput(BaseToolParams):
    """富文本段落。"""

    model_config = ConfigDict(extra="forbid")

    children: list[RichTextNodeInput] = Field(default_factory=list)
    style: ParagraphStyleInput | None = None


class StoryboardGenerationConfigInput(BaseToolParams):
    """分镜统一生成配置。"""

    model_config = ConfigDict(extra="forbid")

    model_id: str | None = None
    size: str | None = None
    resolution: str | None = None
    aspect_ratio: str | None = None


class StoryboardShotInput(BaseToolParams):
    """单个分镜镜头。"""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    output_image_element_id: str | None = Field(None, alias="outputImageElementId")


class CompositionOutputInput(BaseToolParams):
    """单次视频合成的导出配置。"""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    aspect_ratio: str | None = Field(None, alias="aspectRatio")
    width: int | None = Field(
        None,
        ge=2,
        description="Explicit output width in pixels. Use together with height when exact dimensions are required.",
    )
    height: int | None = Field(
        None,
        ge=2,
        description="Explicit output height in pixels. Use together with width when exact dimensions are required.",
    )
    resolution: str | None = Field(
        None,
        description="""<!--zh: 输出短边分辨率。支持 480p、720p、1080p、2k、4k，也支持任意正整数形式，例如 768p。-->
Output short-side resolution. Presets such as 480p, 720p, 1080p, 2k, and 4k are supported, as well as any positive integer form such as 768p.""",
    )
    format: Literal["mp4"] = "mp4"
    audio_policy: Literal["preserve", "mute"] = Field(
        "preserve",
        alias="audioPolicy",
        description="最终合成音频策略：preserve 保留音频，mute 输出静音视频。",
    )


class CompositionInputsInput(BaseToolParams):
    """直接视频合成的媒体输入列表。"""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    video_sequence: list[str] = Field(
        ...,
        min_length=1,
        max_length=VideoEditContentFields.MAX_VIDEO_SEQUENCE_LENGTH,
        alias="videoSequence",
        description="Ordered Video Element IDs.",
    )
    audio_sequence: list[str] = Field(default_factory=list, max_length=1, alias="audioSequence", description="Optional Audio Element ID.")

    @model_validator(mode="after")
    def validate_sequences(self) -> "CompositionInputsInput":
        """校验合成输入中的 Element ID 非空且不重复。"""
        ContentInput._validate_unique_sequence("composition.videoSequence", self.video_sequence)
        ContentInput._validate_unique_sequence("composition.audioSequence", self.audio_sequence)
        return self


class ContentInput(BaseToolParams):
    """Canvas 工具公开的确定 Content 输入。"""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        json_schema_extra={
            "examples": [
                {"source": "user", "content_type": "text", "content": "标题文本"},
                {
                    "source": "generated",
                    "content_type": "image",
                    "prompt": "产品主视觉",
                    "name": "深蓝香水瓶主视觉",
                },
                {"source": "generated", "content_type": "video", "prompt": "产品动态展示"},
                {
                    "source": "imported",
                    "content_type": "image",
                    "asset_path": "Canvas/Demo/images/hero.png",
                },
                {
                    "source": "generated",
                    "content_type": "video",
                    "task": "compose",
                    "composition": {
                        "videoSequence": ["element-shot-01", "element-shot-02"],
                        "audioSequence": ["element-music"],
                    },
                    "output": {"aspectRatio": "16:9", "resolution": "1080p", "format": "mp4"},
                },
            ]
        },
    )

    source: Literal["user", "imported", "generated"]
    content_type: CanvasElementType
    content: str | list[RichTextParagraphInput] | None = None
    asset_path: str | None = Field(
        None,
        min_length=1,
        description="""<!--zh: imported 媒体的本机文件路径，支持绝对路径以及工作区内相对路径。工具会自动复制到当前 Canvas 项目的标准媒体目录，并在结果中返回项目内路径。-->
Local file path of imported media. Accepts an absolute path or a relative path inside the workspace. The tool copies it into the current Canvas project's canonical media directory and returns the project-local path.""",
    )
    prompt: str | None = Field(None, min_length=1)
    default_style: TextStyleInput | None = Field(None, alias="defaultStyle")
    fill: str | None = None
    stroke: str | None = None
    stroke_width: float | None = Field(None, alias="strokeWidth")
    corner_radius: float | None = Field(None, alias="cornerRadius")
    sides: int | None = Field(None, ge=2)
    inner_radius_ratio: float | None = Field(None, gt=0, le=1, alias="innerRadiusRatio")
    generation_config: StoryboardGenerationConfigInput | None = Field(None, alias="generationConfig")
    shots: list[StoryboardShotInput] | None = None
    video_sequence: list[str] | None = Field(
        None,
        min_length=1,
        max_length=VideoEditContentFields.MAX_VIDEO_SEQUENCE_LENGTH,
        alias="videoSequence",
    )
    audio_sequence: list[str] | None = Field(None, max_length=1, alias="audioSequence")
    composition: CompositionInputsInput | None = None
    output: CompositionOutputInput | None = None
    model_id: str | None = None
    name: str | None = Field(
        None,
        min_length=1,
        description="""<!--zh: 生成媒体的文件名由大模型根据最终内容命名。生成图片时必填，生成视频时应提供；与用户语言一致，建议使用 3-5 个词。系统会清洗名称，图片追加时间戳，视频追加短唯一值。-->
Model-provided output name for generated media. Required for generated images and recommended for generated videos; describe the actual result in the user's language with 3-5 words. The system sanitizes it, then appends a timestamp for images or a short unique value for videos.""",
    )
    reference_images: list[str] = Field(
        default_factory=list,
        description="""<!--zh: 当前 Canvas 项目内的参考图片路径，必须使用相对于当前 magic.project.js 的路径，并以 ./ 开头，例如 ./images/reference.jpg。-->
Reference image paths inside the current Canvas project. Use paths relative to the current magic.project.js and always prefix them with ./, for example ./images/reference.jpg.""",
    )
    reference_image_paths: list[str] = Field(default_factory=list)
    reference_video_paths: list[str] = Field(default_factory=list)
    reference_audio_paths: list[str] = Field(default_factory=list)
    frame_start_path: str | None = None
    frame_end_path: str | None = None
    input_mode: VideoInputMode | None = None
    task: Literal["generate", "edit", "compose"] | None = None
    size: str | None = None
    duration_seconds: int | None = Field(None, gt=0)
    aspect_ratio: str | None = None
    resolution: str | None = None
    fps: int | None = Field(None, gt=0)
    seed: int | None = None
    watermark: bool | None = None
    draft: bool | None = Field(
        None,
        description="""<!--zh: 样片模式开关。仅当当前模型的 <media_model_info> 声明了 draft 能力时才可用，分辨率与计费规则见该声明。-->
Draft mode switch. Use it only when the current model's <media_model_info> declares the draft capability; that declaration carries the applicable resolution and billing rules.""",
    )
    audio_policy: Literal["auto", "generate", "mute"] | None = Field(
        None,
        alias="audioPolicy",
        description="统一视频音频策略：auto 使用模型默认行为，generate 请求生成音频，mute 要求最终视频无音频。",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_reference_images(cls, values: Any) -> Any:
        """把旧版 reference_image_paths 兼容归一化到 reference_images。"""
        if not isinstance(values, dict):
            return values
        normalized = dict(values)
        if not normalized.get("reference_images") and normalized.get("reference_image_paths"):
            normalized["reference_images"] = normalized["reference_image_paths"]
        return normalized

    @model_validator(mode="after")
    def validate_content_contract(self) -> "ContentInput":
        """按来源和 Content 类型拒绝不确定字段组合。"""
        if self.content_type == "video-edit":
            if self.source != "user":
                raise ValueError("video-edit Content requires source=user")
            if not self.video_sequence:
                raise ValueError("video-edit Content requires a non-empty videoSequence")
            self._validate_unique_sequence("videoSequence", self.video_sequence)
            self._validate_unique_sequence("audioSequence", self.audio_sequence or [])
            if self.output is not None:
                raise ValueError("Video Edit Content only accepts videoSequence and audioSequence")
        elif self.task == "compose":
            if self.content_type != "video" or self.composition is None:
                raise ValueError("task=compose requires video content and composition media inputs")
            if self.video_sequence is not None or self.audio_sequence is not None:
                raise ValueError("task=compose uses composition.videoSequence and composition.audioSequence")
            if self.prompt is not None:
                raise ValueError("task=compose does not accept prompt")
            if self.output is None:
                raise ValueError("task=compose requires composition output")
        elif self.video_sequence is not None or self.audio_sequence is not None:
            raise ValueError("videoSequence and audioSequence are only allowed for video-edit Content or task=compose")
        if self.content_type == "storyboard" and self.source == "user":
            config = self.generation_config
            if config is None or not config.model_id or not config.size or not config.resolution or not config.aspect_ratio:
                raise ValueError(
                    "storyboard Content requires generationConfig.model_id, size, resolution, and aspect_ratio"
                )
        if self.source == "generated":
            if self.content_type not in generated_media_types():
                raise ValueError(f"source=generated is not configured for content_type={self.content_type}")
            if self.task != "compose" and not self.prompt:
                raise ValueError("source=generated requires prompt")
            if self.content_type == "image" and (not self.name or not self.name.strip()):
                raise ValueError("source=generated image requires name")
            if self.asset_path is not None:
                raise ValueError("asset_path is only allowed when source=imported")
        elif self.source == "imported":
            if self.content_type not in {"image", "video", "audio"}:
                raise ValueError("source=imported requires content_type=image, video, or audio")
            if not self.asset_path:
                raise ValueError("source=imported requires asset_path")
            if self.prompt is not None:
                raise ValueError("prompt is only allowed when source=generated")
        elif self.source == "user":
            if self.content_type in {"image", "video", "audio"}:
                raise ValueError("media Content must use source=imported or source=generated")
            if self.asset_path is not None or self.prompt is not None:
                raise ValueError("user Content does not accept asset_path or prompt")
        if self.task == "edit" and self.content_type != "video":
            raise ValueError("task=edit is only allowed for generated video Content")
        return self

    @staticmethod
    def _validate_unique_sequence(field_name: str, values: list[str]) -> None:
        """拒绝 Video Edit 序列中的空白或重复 Element ID。"""
        if any(not value.strip() for value in values):
            raise ValueError(f"{field_name} IDs must not be empty")
        if len(values) != len(set(values)):
            raise ValueError(f"{field_name} IDs must be unique")

    def to_command(self, content_id: str | None = None) -> ContentCommand:
        """转换为应用层 Content 命令。"""
        return ContentCommand(
            source=self.source,
            content_type=self.content_type,
            fields=self._build_fields(),
            asset_path=self.asset_path,
            generation_parameters=self._build_generation_parameters() if self.source == "generated" else None,
            content_id=content_id,
        )

    def _build_fields(self):
        """按确定的 Content 类型构造领域字段。"""
        if self.content_type in {"image", "video", "audio"}:
            return ContentFieldsFactory.empty(self.content_type)
        if self.content_type == "text":
            return TextContentFields(
                content=self._text_paragraphs(),
                default_style=self._model_object(self.default_style),
            )
        if self.content_type == "rectangle":
            return RectangleContentFields(
                fill=self.fill,
                stroke=self.stroke,
                stroke_width=self.stroke_width,
                corner_radius=self.corner_radius,
            )
        if self.content_type == "ellipse":
            return EllipseContentFields(fill=self.fill, stroke=self.stroke, stroke_width=self.stroke_width)
        if self.content_type == "triangle":
            return TriangleContentFields(fill=self.fill, stroke=self.stroke, stroke_width=self.stroke_width)
        if self.content_type == "star":
            return StarContentFields(
                fill=self.fill,
                stroke=self.stroke,
                stroke_width=self.stroke_width,
                corner_radius=self.corner_radius,
                sides=self.sides,
                inner_radius_ratio=self.inner_radius_ratio,
            )
        if self.content_type == "storyboard":
            return StoryboardContentFields(
                generation_config=self._storyboard_generation_config(),
                shots=[self._model_object(shot) for shot in self.shots or []],
            )
        if self.content_type == "video-edit":
            return VideoEditContentFields(
                video_sequence=list(self.video_sequence or []),
                audio_sequence=list(self.audio_sequence or []),
            )
        return ContentFieldsFactory.empty(self.content_type)

    def _build_generation_parameters(self) -> GenerationParameters:
        """构造不包含开放扩展字典的生成参数。"""
        return GenerationParameters(
            prompt=self.prompt or "",
            model_id=self.model_id,
            name=self.name,
            size=self.size,
            reference_images=tuple(self.reference_images),
            reference_image_paths=tuple(self.reference_image_paths),
            reference_video_paths=tuple(self.reference_video_paths),
            reference_audio_paths=tuple(self.reference_audio_paths),
            frame_start_path=self.frame_start_path,
            frame_end_path=self.frame_end_path,
            input_mode=self.input_mode,
            task=self.task,
            duration_seconds=self.duration_seconds,
            aspect_ratio=self.aspect_ratio,
            resolution=self.resolution,
            fps=self.fps,
            seed=self.seed,
            watermark=self.watermark,
            draft=self.draft,
            audio_policy=self.audio_policy,
            composition=(
                CompositionParameters(
                    video_sequence=tuple(self.composition.video_sequence),
                    audio_sequence=tuple(self.composition.audio_sequence),
                    output=CompositionOutput.from_dict(self._model_object(self.output)).to_dict(),
                )
                if self.task == "compose" and self.composition and self.output is not None
                else None
            ),
        )

    def _text_paragraphs(self) -> list[JsonObject]:
        """把文本简写或富文本段落转换为协议对象。"""
        if isinstance(self.content, str):
            return [{"children": [{"type": "text", "text": self.content}]}]
        return [cast(JsonObject, paragraph.model_dump(by_alias=True, exclude_none=True)) for paragraph in self.content or []]

    @staticmethod
    def _model_object(model: BaseToolParams | None) -> JsonObject | None:
        """把确定的嵌套输入模型转换为领域 JSON 对象。"""
        if model is None:
            return None
        return cast(JsonObject, model.model_dump(by_alias=True, exclude_none=True))

    def _storyboard_generation_config(self) -> JsonObject:
        """转换为前端约定的分镜模型、尺寸、分辨率和画面比例结构。"""
        config = self.generation_config
        if config is None:
            return {}
        values: JsonObject = {
            "model_id": config.model_id,
            "size": config.size,
            "resolution": config.resolution,
            "image_generation_config": {"aspect_ratio": config.aspect_ratio},
        }
        return {
            key: value
            for key, value in values.items()
            if value is not None and value != {}
        }


class ElementInput(BaseToolParams):
    """单个新增 Element 参数。"""

    model_config = ConfigDict(extra="forbid")

    item_ref: str = Field(..., min_length=1)
    element_type: CanvasElementType = Field(
        ...,
        description="""<!--zh: Agent 只能创建 storyboard、video-edit、image、video、audio；Frame 请使用 frame_canvas_elements。其他类型只允许读取。-->
The Canvas Agent may create only storyboard, video-edit, image, video, and audio Elements. Create Frames with frame_canvas_elements. All other Element types are read-only.""",
    )
    name: str | None = None
    layout: CanvasLayoutInput | None = None
    content: ContentInput | None = None
    connections: list[CanvasCreationConnectionInput] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def inherit_generated_media_name(cls, value: Any) -> Any:
        """生成媒体缺少 Content 名称时，使用外层 Element 名称兼容旧调用。"""
        if not isinstance(value, dict):
            return value

        content = value.get("content")
        if not isinstance(content, dict):
            return value
        if content.get("source") != "generated" or content.get("content_type") not in generated_media_types():
            return value
        if str(content.get("name") or "").strip():
            return value

        element_name = str(value.get("name") or "").strip()
        if not element_name:
            return value

        normalized = dict(value)
        normalized_content = dict(content)
        normalized_content["name"] = element_name
        normalized["content"] = normalized_content
        return normalized

    @model_validator(mode="after")
    def validate_content_type(self) -> "ElementInput":
        """保证 Element 与 Content 类型完全一致。"""
        if self.element_type == "video-edit" and self.content is None:
            raise ValueError("video-edit Element requires Content")
        if self.content is not None and self.content.content_type != self.element_type:
            raise ValueError("content.content_type must match element_type")
        return self

    def to_command(self) -> AddElementCommand:
        """转换为应用层新增 Element 命令。"""
        return AddElementCommand(
            item_ref=self.item_ref,
            element_type=self.element_type,
            name=self.name,
            layout=self.layout.to_command() if self.layout else None,
            content=self.content.to_command() if self.content else None,
            connections=tuple(connection.to_command() for connection in self.connections),
        )


@tool(name="add_canvas_elements", code_mode_only=True)
class AddCanvasElements(BaseTool[BaseToolParams]):
    """<!--zh: 新增 Canvas Element。-->Add Canvas Elements."""

    name = "add_canvas_elements"
    feedback_action_key = "canvas.add_elements"

    class Params(BaseToolParams):
        """批量新增 Element 参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        items: list[ElementInput] = Field(..., min_length=1)

    params_class = Params

    @staticmethod
    def _operation_action_key(arguments: dict[str, Any], fallback: str) -> str:
        """根据明确的 Element 类型选择 Storyboard 或 Video Edit 专用 action。"""
        element_types = {
            item.get("element_type")
            for item in arguments.get("items", [])
            if isinstance(item, dict) and item.get("element_type")
        }
        if element_types == {"storyboard"}:
            return "canvas.create_storyboard"
        if element_types == {"video-edit"}:
            return "canvas.create_video_edit"
        return fallback

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None
    ) -> dict[str, str]:
        """生成新增 Element 前的批量操作反馈。"""
        args = arguments or {}
        generation_summary = CanvasGenerationFeedback.from_arguments(args)
        if CanvasGenerationFeedback.is_pure_generated_batch(args):
            return {
                "action": i18n.translate(
                    CanvasGenerationFeedback.action_key(generation_summary, pending=True),
                    category="tool.actions",
                ),
                "remark": CanvasGenerationFeedback.remark(
                    generation_summary,
                    pending=True,
                    names=CanvasGenerationFeedback.item_names(args),
                ),
                "tool_name": tool_name,
            }
        items = args.get("items") or []
        sources = {
            str(item.get("content", {}).get("source"))
            for item in items
            if isinstance(item, dict) and isinstance(item.get("content"), dict)
        }
        action_key = "canvas.add_generated_content" if sources == {"generated"} else (
            "canvas.import_content" if sources == {"imported"} else self.feedback_action_key
        )
        action_key = self._operation_action_key(args, action_key)
        project_path = args.get("project_path", "")
        remark = canvas_remark("canvas.add_elements_pending", project_path, total=len(items))
        return {
            "action": i18n.translate(action_key, category="tool.actions"),
            "remark": remark,
            "tool_name": tool_name,
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        """生成新增 Element 后的逐项结果反馈。"""
        # 保留 Canvas 工具自身按结果状态生成的 remark，避免失败时被通用文案覆盖。
        result.use_custom_remark = True
        generation_summary = CanvasGenerationFeedback.from_arguments(arguments)
        batch_status = summarize_tool_result(result)
        values = (result.data or {}).get("items", [])
        if CanvasGenerationFeedback.is_pure_generated_batch(arguments):
            generation_summary = CanvasGenerationFeedback.from_result(result, arguments)
            if not values and not result.ok:
                return {
                    "action": i18n.translate(
                        CanvasGenerationFeedback.action_key(generation_summary),
                        category="tool.actions",
                    ),
                    "remark": CanvasGenerationFeedback.failure_remark(
                        generation_summary,
                        CanvasGenerationFeedback.item_names(arguments),
                    ),
                }
            return {
                "action": i18n.translate(
                    CanvasGenerationFeedback.action_key(generation_summary),
                    category="tool.actions",
                ),
                "remark": CanvasGenerationFeedback.remark_for_result(result, arguments),
            }
        else:
            if not values and not result.ok:
                remark = i18n.translate("canvas.operation_failed", category="tool.messages")
            else:
                remark = canvas_result_remark(batch_status)
        args = arguments or {}
        sources = {
            str(item.get("content", {}).get("source"))
            for item in args.get("items", [])
            if isinstance(item, dict) and isinstance(item.get("content"), dict)
        }
        action_key = "canvas.add_generated_content" if sources == {"generated"} else (
            "canvas.import_content" if sources == {"imported"} else self.feedback_action_key
        )
        action_key = self._operation_action_key(args, action_key)
        return {
            "action": i18n.translate(action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None
    ) -> ToolDetail | None:
        """生成新增 Element 自己的逐项详情。"""
        data = result.data or {}
        generation_summary = CanvasGenerationFeedback.from_result(result, arguments)
        is_generation_batch = (
            CanvasGenerationFeedback.is_pure_generated_batch(arguments) and generation_summary.is_supported
        )
        if is_generation_batch:
            operation_detail = CanvasGenerationFeedback.operation_result_detail(result, arguments)
            if operation_detail is not None:
                return operation_detail
        title_key = (
            CanvasGenerationFeedback.detail_title_key(generation_summary)
            if is_generation_batch
            else "elements_added"
        )
        builder = CanvasToolDetailBuilder(self.name, title_key, result, arguments)
        builder.add_field("project_path", data.get("project_path") or builder.arguments.get("project_path") or "-")
        if is_generation_batch:
            builder.add_field("media_type", generation_summary.media_label())
            for media_type in generation_summary.media_types:
                counts = generation_summary.by_type[media_type]
                builder.add_item(
                    {
                        "media_type": CanvasGenerationFeedback.media_label_for_type(media_type),
                        "total": counts.total,
                        "completed": counts.completed,
                        "processing": counts.processing,
                        "failed": counts.failed,
                    }
                )
        for item in data.get("items", []):
            media_type = CanvasGenerationFeedback.media_type_for_item(item, arguments)
            builder.add_item(
                {
                    "item_ref": item.get("item_ref", "-"),
                    "status": item.get("status", "-"),
                    "element_id": item.get("element_id", "-"),
                    "type": item.get("element_type", "-"),
                    **({"asset_path": item["asset_path"]} if item.get("asset_path") else {}),
                    **({"media_type": CanvasGenerationFeedback.media_label_for_type(media_type)} if media_type else {}),
                }
            )
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """创建一批 Element，并按 item 返回真实标识。"""
        try:
            commands = [item.to_command() for item in params.items]
            CanvasAgentWritePolicy.validate_creation(commands)
            result = await _application(tool_context).add_elements(
                params.project_path,
                commands,
                tool_context=tool_context,
                on_placeholders_created=partial(
                    CanvasGenerationFeedback.report_placeholders, self, tool_context, params.model_dump(),
                ),
            )
            return batch_tool_result(
                content=items_content(
                    "Canvas Elements operation result.",
                    result.to_dict(),
                    "call query_canvas_element_details with the returned element_id values to verify the persisted Elements",
                ),
                data=result.to_dict(),
            )
        except Exception as error:
            return error_result(error)
