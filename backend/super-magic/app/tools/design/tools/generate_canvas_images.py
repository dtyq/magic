"""AI 图片生成并添加到画布工具（任务列表版）

每个 task 独立指定 prompt / name / size / reference_images，
有几个 task 就生成几张图，并发执行，无变体/组图模式。
"""

from app.i18n import i18n
import asyncio
import random
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field, field_validator

from agentlang.config.dynamic_config import dynamic_config
from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail, DisplayType
from app.tools.core import BaseToolParams, tool
from app.tools.design.tools.base_design_tool import BaseDesignTool
from app.tools.design.tools.batch_create_canvas_elements import (
    BatchCreateCanvasElements,
    ElementCreationSpec,
)
from app.tools.design.constants import DEFAULT_ELEMENT_SPACING
from app.tools.generate_image import GenerateImage, GenerateImageParams
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry
from app.utils.async_file_utils import async_exists

logger = get_logger(__name__)

SdkSnippetTimeoutRegistry.register("generate_canvas_images", min_timeout=600)


@dataclass
class ImageGenerationResult:
    """单张图片的生成结果

    Attributes:
        index: task 在列表中的索引（0 起）
        success: 是否生成成功
        image_info: 成功时的图片信息
        error_message: 失败时的错误信息
        updated_elements: 占位符更新后返回的元素列表，用于汇总到最终 ToolResult
    """
    index: int
    success: bool
    image_info: Optional["GeneratedImageInfo"] = None
    error_message: Optional[str] = None
    updated_elements: List[Dict] = field(default_factory=list)

    @property
    def is_success(self) -> bool:
        return self.success

    @property
    def is_failed(self) -> bool:
        return not self.success


@dataclass
class ImageDimensions:
    """图片尺寸

    Attributes:
        width: 宽度像素，None 表示读取失败
        height: 高度像素，None 表示读取失败
    """
    width: Optional[float]
    height: Optional[float]

    @property
    def is_valid(self) -> bool:
        return self.width is not None and self.height is not None

    @property
    def size_string(self) -> Optional[str]:
        if self.is_valid:
            return f"{int(self.width)}x{int(self.height)}"
        return None


@dataclass
class GeneratedImageInfo:
    """生成成功的图片信息

    Attributes:
        relative_path: 相对于项目目录的路径
        width: 实际宽度
        height: 实际高度
        generate_request: 生成时使用的参数记录
    """
    relative_path: str
    width: Optional[float]
    height: Optional[float]
    generate_request: Dict[str, Any]


@dataclass
class ExtractedImagesResult:
    """从 generate_image 结果中提取的图片列表

    Attributes:
        images: 成功提取的图片列表
        errors: 提取失败的错误列表
    """
    images: List[GeneratedImageInfo]
    errors: List[str]

    @property
    def has_success(self) -> bool:
        return len(self.images) > 0

    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0


class ImageTaskSpec(BaseModel):
    """单张图片的生成任务

    Attributes:
        prompt: 生成提示词
        name: 画布元素名称
        size: 输出尺寸，格式 WxH；有参考图时可省略，系统自动从最大参考图读取
        reference_images: 参考图路径列表，无参考图传 []
    """
    prompt: str = Field(
        ...,
        description="""<!--zh: 图片生成提示词。建议包含主体、风格、构图、光线、色调。-->
Image generation prompt. Include subject, style, composition, lighting, and color tone for best results."""
    )
    name: str = Field(
        ...,
        description="""<!--zh: 画布元素名称。-->
Canvas element label."""
    )
    size: Optional[str] = Field(
        None,
        description="""<!--zh: 输出图片尺寸，格式 'WxH'。有参考图时可省略，系统自动取面积最大的参考图尺寸；无参考图时必须明确填写，常用备选：2048x2048（方）、1440x2560（9:16）、2560x1440（16:9）、1728x2304（2:3）、2304x1728（3:2）。-->
Output image dimensions in 'WxH' format. Optional when reference_images is non-empty — the system automatically uses the largest reference image's dimensions. Required when reference_images is empty; common options: 2048x2048 (square), 1440x2560 (9:16), 2560x1440 (16:9), 1728x2304 (2:3), 2304x1728 (3:2)."""
    )
    reference_images: List[str] = Field(
        ...,
        description="""<!--zh: 参考图路径列表。无参考图时传 []。参考图提供视觉锚点（结构、风格、构图），模型以其为起点创作而非复制。-->
Reference image paths. Pass [] for text-only generation. Reference images serve as a visual anchor — structure, style, or composition — that the model builds upon rather than copies."""
    )
    element_id: Optional[str] = Field(
        None,
        description="""<!--zh: 可选。传入时复用画布上已有的元素（如上次生成失败的占位符），工具直接在该元素上重新生成并更新，不新建占位符。不传时新建占位符。-->
Optional. When provided, the tool reuses an existing canvas element (e.g. a failed placeholder from a previous attempt) and regenerates in place without creating a new placeholder. Omit to create a new element."""
    )

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("prompt 不能为空")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("name 不能为空")
        return v

    @field_validator("size")
    @classmethod
    def validate_size_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        parts = v.split("x")
        if len(parts) != 2:
            raise ValueError(f"size 格式无效：'{v}'，应为 'WxH'，例如 '2048x2048'")
        try:
            w, h = int(parts[0]), int(parts[1])
        except ValueError:
            raise ValueError(f"size 格式无效：'{v}'，宽高必须为整数，例如 '2048x2048'")
        if w <= 0 or h <= 0:
            raise ValueError(f"size 宽高必须大于 0，当前值：'{v}'")
        return v


class GenerateCanvasImagesParams(BaseToolParams):
    """generate_canvas_images 工具参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹）。-->
Relative path to the design project (folder containing magic.project.js)."""
    )

    tasks: List[ImageTaskSpec] = Field(
        ...,
        description="""<!--zh: 图片生成任务列表，每个 task 生成一张图，最多 6 个。每个 task 独立指定 prompt / name / reference_images，size 有参考图时可省略。-->
Image generation task list. Each task produces one image. Maximum 6 tasks. Each task independently specifies prompt, name, reference_images, and optionally size (auto-resolved from the largest reference image when omitted)."""
    )

    @field_validator("tasks")
    @classmethod
    def validate_tasks(cls, v: List[ImageTaskSpec]) -> List[ImageTaskSpec]:
        if not v or len(v) == 0:
            raise ValueError("tasks 不能为空列表，至少需要一个任务")
        if len(v) > 6:
            raise ValueError("tasks 最多支持 6 个")
        return v


@tool()
class GenerateCanvasImages(BaseDesignTool[GenerateCanvasImagesParams]):
    """<!--zh: 按任务列表生成 AI 图片并自动添加到画布。每个 task 独立指定提示词、尺寸和参考图，有几个 task 就生成几张图，并发执行。-->
    Generate AI images and automatically add them to the canvas, one image per task. Each task independently specifies its prompt, size, and reference images; all tasks run concurrently.
    """

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
每个 task 是一张图的完整描述，需明确两个事项：

【reference_images（必须显式填写）】
核心问题不是"用户有没有说参考图"，而是"用户是否希望输出与某张现有图片保持视觉关联"：
- 用户上传了附件、提到了画布上的某张图、或表达了"基于这个/参考这个/做成类似风格" → 填入对应路径
- 用户纯粹用文字描述一个想象中的画面 → 填 []
两种情况都必须显式填写，不可省略。

【size 选取】
用户明确指定时填入；未指定时：reference_images 非空则省略 size（系统自动从面积最大的参考图读取尺寸），reference_images 为空则必须填写，否则报错。

【element_id 与重试】
当某个任务生成失败时，结果中会包含该元素的 element_id。重试时在对应 task 中传入 element_id，工具会复用已有占位符原地重新生成，而不会新建占位符。不传 element_id 时，始终新建占位符。

【prompt 质量】
将用户的简短描述扩写为包含主体、风格、构图、光线、色调的完整描述。描述越模糊，生成结果越随机。
-->
Each task is a self-contained description of one image. Three things to know:

[reference_images — always required]
The question is not whether the user said "reference image" but whether they want the output to have visual continuity with an existing image:
- Uploaded a file, mentioned a canvas asset, or expressed "based on this / reference this / in this style" → include those paths
- Describing something purely from imagination → pass []
Both cases require explicit reference_images — never omit it.

[Size selection]
Fill in size when the user explicitly states one. Otherwise: if reference_images is non-empty, omit size — the system automatically reads the largest reference image's dimensions. If reference_images is empty, size is required; omitting it will cause an error.

[element_id and retry]
When a task fails, the result includes the element_id of the failed placeholder. To retry, pass that element_id in the task — the tool regenerates in place without creating a new placeholder. Omitting element_id always creates a new placeholder.

[Prompt quality]
Expand brief user descriptions into full prompts covering subject, style, composition, lighting, and color tone. Vague inputs produce vague outputs.
"""

    def __init__(self, **data):
        super().__init__(**data)
        self._generate_tool = GenerateImage()
        self._batch_create_tool = BatchCreateCanvasElements()
        from app.tools.design.tools.batch_update_canvas_elements import BatchUpdateCanvasElements
        self._batch_update_tool = BatchUpdateCanvasElements()

    async def execute(
        self, tool_context: ToolContext, params: GenerateCanvasImagesParams
    ) -> ToolResult:
        """执行生成图片并创建元素（3 阶段流程）

        阶段1: 创建占位符（status="processing"）
        阶段2: 并发生成图片（每个 task 生成一张）
        阶段3: 更新占位符为完整元素（status="completed" 或 "failed"）
        """
        try:
            workspace_root = Path(tool_context.base_dir).resolve()
            project_prefix = params.project_path.strip("/")

            normalize_error = await self._normalize_tasks(params.tasks, workspace_root, project_prefix)
            if normalize_error:
                return normalize_error

            actual_count = len(params.tasks)

            # 1. 确保项目已准备好
            project_path, error_result = await self._ensure_project_ready(
                params.project_path,
                require_magic_project_js=True
            )
            if error_result:
                return error_result

            workspace_path = workspace_root
            logger.info(
                f"开始生成图片并添加到画布（3阶段流程）: task_count={actual_count}, "
                f"project={params.project_path}"
            )

            # ========== 阶段1: 准备占位符 ==========
            # 有 element_id 的 task：复用已有元素，更新为 processing
            # 没有 element_id 的 task：新建占位符
            logger.info("阶段1: 准备占位符元素")

            from app.tools.design.tools.batch_create_canvas_elements import BatchCreateCanvasElementsParams
            from app.tools.design.tools.batch_update_canvas_elements import (
                BatchUpdateCanvasElementsParams,
                ElementUpdate,
            )

            new_task_indices = [idx for idx, task in enumerate(params.tasks) if not task.element_id]
            existing_task_indices = [idx for idx, task in enumerate(params.tasks) if task.element_id]

            # task_idx → placeholder dict
            task_placeholders: Dict[int, Dict] = {}

            # 复用已有占位符：重置为 processing
            if existing_task_indices:
                reuse_updates = [
                    ElementUpdate(
                        element_id=params.tasks[idx].element_id,
                        properties={"status": "processing"},
                    )
                    for idx in existing_task_indices
                ]
                reuse_result = await self._batch_update_tool.execute(
                    tool_context,
                    BatchUpdateCanvasElementsParams(
                        project_path=params.project_path,
                        updates=reuse_updates,
                    ),
                )
                if not reuse_result.ok:
                    logger.warning(f"重置已有占位符状态失败: {reuse_result.content}")
                for idx in existing_task_indices:
                    task = params.tasks[idx]
                    task_placeholders[idx] = {"id": task.element_id, "name": task.name}

            # 新建占位符
            if new_task_indices:
                element_specs = [
                    ElementCreationSpec(
                        element_type="image",
                        name=params.tasks[idx].name,
                        width=float(self._parse_size_to_dimensions(params.tasks[idx].size)[0]),
                        height=float(self._parse_size_to_dimensions(params.tasks[idx].size)[1]),
                        properties={"status": "processing"},
                    )
                    for idx in new_task_indices
                ]
                batch_create_params = BatchCreateCanvasElementsParams(
                    project_path=params.project_path,
                    elements=element_specs,
                    layout_mode="horizontal",
                    grid_columns=None,
                    spacing=DEFAULT_ELEMENT_SPACING,
                )
                placeholder_result = await self._batch_create_tool.execute(tool_context, batch_create_params)
                if not placeholder_result.ok:
                    logger.error("创建占位符失败")
                    return placeholder_result

                created = placeholder_result.extra_info.get("created_elements", [])
                if len(created) != len(new_task_indices):
                    return ToolResult.error(
                        "未能创建占位符元素",
                        extra_info={"error_type": "design.error_unexpected"}
                    )
                for i, idx in enumerate(new_task_indices):
                    task_placeholders[idx] = created[i]

            if not task_placeholders:
                return ToolResult.error(
                    "未能准备任何占位符元素",
                    extra_info={"error_type": "design.error_unexpected"}
                )

            # 按 task 顺序展开为列表，方便后续使用
            all_placeholders = [task_placeholders[idx] for idx in range(len(params.tasks))]

            logger.info(
                f"占位符准备完成：新建 {len(new_task_indices)} 个，复用 {len(existing_task_indices)} 个"
            )

            # ========== 阶段2: 并发生成并即时更新 ==========
            # 每个 task 生成完立即更新自己的占位符，无需等待其他任务
            logger.info("阶段2: 并发生成并即时更新")

            model = self._get_model_from_config(tool_context)
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")

            await asyncio.to_thread((project_path / "images").mkdir, parents=True, exist_ok=True)
            relative_output_path = f"{params.project_path}/images"

            generation_results = list(await asyncio.gather(*[
                self._generate_and_update_task(
                    idx=idx,
                    task=task,
                    placeholder=all_placeholders[idx],
                    tool_context=tool_context,
                    project_path_str=params.project_path,
                    model=model,
                    timestamp=timestamp,
                    output_path=relative_output_path,
                    workspace_path=workspace_path,
                    project_path=project_path,
                )
                for idx, task in enumerate(params.tasks)
            ]))

            succeeded_count = sum(1 for r in generation_results if r.is_success)
            failed_count = sum(1 for r in generation_results if r.is_failed)
            elements_detail = [elem for r in generation_results for elem in r.updated_elements]
            logger.info(f"完成！成功: {succeeded_count}, 失败: {failed_count}")

            # 全部失败
            if succeeded_count == 0 and len(all_placeholders) > 0:
                failed_elements_desc = "; ".join(
                    f"{p.get('name', p['id'])} (element_id: \"{p['id']}\")"
                    for p in all_placeholders
                )
                error_content = (
                    f"Image generation failed: all {len(all_placeholders)} image(s) failed to generate. "
                    f"To retry in place, pass element_id for each failed element: {failed_elements_desc}"
                )
                return ToolResult.error(
                    error_content,
                    extra_info={
                        "error_type": "design.error_unexpected",
                        "project_path": params.project_path,
                        "total_count": len(all_placeholders),
                        "succeeded_count": 0,
                        "failed_count": failed_count,
                        "created_elements": all_placeholders,
                    }
                )

            result_content = self._build_result_content(
                project_path=params.project_path,
                tasks=params.tasks,
                task_placeholders=all_placeholders,
                generation_results=generation_results,
            )

            return ToolResult(
                content=result_content,
                data={
                    "created_elements": all_placeholders,
                    "succeeded_count": succeeded_count,
                    "failed_count": failed_count,
                },
                extra_info={
                    "project_path": params.project_path,
                    "total_count": len(all_placeholders),
                    "succeeded_count": succeeded_count,
                    "failed_count": failed_count,
                    "created_elements": all_placeholders,
                    "elements": elements_detail,
                }
            )

        except Exception as e:
            logger.exception(f"generate_canvas_images 失败: {e!s}")
            return ToolResult.error(
                f"生成图片到画布失败: {e!s}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    async def _generate_and_update_task(
        self,
        idx: int,
        task: ImageTaskSpec,
        placeholder: Dict,
        tool_context: ToolContext,
        project_path_str: str,
        model: str,
        timestamp: str,
        output_path: str,
        workspace_path: Path,
        project_path: Optional[Path],
    ) -> ImageGenerationResult:
        """生成单张图片，完成后立即更新对应占位符，不等待其他任务"""
        # 错开并发请求，避免高并发（首个任务不延迟）
        if idx > 0:
            await asyncio.sleep(min(idx * 0.1 + random.uniform(0, 1.0), 3.0))

        result = await self._generate_single_with_retry(
            idx=idx,
            task=task,
            model=model,
            timestamp=timestamp,
            output_path=output_path,
            workspace_path=workspace_path,
            project_path=project_path,
            tool_context=tool_context,
        )

        updated_elements = await self._update_placeholder(result, placeholder, tool_context, project_path_str)
        result.updated_elements = updated_elements
        return result

    async def _generate_single_with_retry(
        self,
        idx: int,
        task: ImageTaskSpec,
        model: str,
        timestamp: str,
        output_path: str,
        workspace_path: Path,
        project_path: Optional[Path],
        tool_context: ToolContext,
    ) -> ImageGenerationResult:
        """生成单张图片，失败自动重试一次"""
        mode = "edit" if task.reference_images else "generate"
        clean_name = self._sanitize_filename(task.name)
        image_name = f"{clean_name}_{timestamp}"

        for attempt in range(2):
            is_retry = attempt > 0
            attempt_desc = f"重试 {attempt}/1" if is_retry else "首次"
            image_name_attempt = f"{image_name}_retry{attempt}" if is_retry else image_name

            if is_retry:
                await asyncio.sleep(random.uniform(0.5, 1.5))

            try:
                generate_params = GenerateImageParams(
                    prompt=task.prompt,
                    mode=mode,
                    model=model,
                    size=task.size,
                    image_count=1,
                    image_name=image_name_attempt,
                    output_path=output_path,
                    image_paths=task.reference_images,
                    override=False,
                )

                _t0 = time.monotonic()
                gen_result = await self._generate_tool.execute_purely(
                    tool_context, generate_params, skip_limit_check=True
                )
                _duration_ms = int((time.monotonic() - _t0) * 1000)

                if gen_result.ok:
                    extracted = await self._extract_generated_images(
                        gen_result,
                        workspace_path,
                        generate_params,
                        project_path=project_path,
                        duration_ms=_duration_ms,
                    )

                    if extracted.has_success:
                        retry_note = " (重试成功)" if is_retry else ""
                        logger.info(f"Task {idx + 1} 生成成功{retry_note}")
                        return ImageGenerationResult(
                            index=idx,
                            success=True,
                            image_info=extracted.images[0],
                        )

                    error_msg = extracted.errors[0] if extracted.errors else "图片文件校验失败"
                    full_error = f"Task {idx + 1} 失败 ({attempt_desc}): {error_msg}"
                    logger.warning(full_error)
                    if attempt < 1:
                        continue
                    return ImageGenerationResult(index=idx, success=False, error_message=full_error)
                else:
                    error_msg = f"Task {idx + 1} 失败 ({attempt_desc}): {gen_result.content}"
                    logger.warning(error_msg)
                    if attempt < 1:
                        continue
                    return ImageGenerationResult(index=idx, success=False, error_message=error_msg)

            except Exception as exc:
                error_msg = f"Task {idx + 1} 异常 ({attempt_desc}): {exc!s}"
                logger.error(error_msg, exc_info=True)
                if attempt < 1:
                    continue
                return ImageGenerationResult(index=idx, success=False, error_message=error_msg)

        return ImageGenerationResult(index=idx, success=False, error_message="未知错误")

    async def _update_placeholder(
        self,
        result: ImageGenerationResult,
        placeholder: Dict,
        tool_context: ToolContext,
        project_path_str: str,
    ) -> List[Dict]:
        """将生成结果立即写入对应占位符，返回更新后的元素列表"""
        from app.tools.design.tools.batch_update_canvas_elements import (
            BatchUpdateCanvasElementsParams,
            ElementUpdate,
        )

        if result.is_success:
            image_info = result.image_info
            update_properties: Dict[str, Any] = {
                "src": image_info.relative_path,
                "status": "completed",
                "generateImageRequest": image_info.generate_request,
            }
            if image_info.width is not None:
                update_properties["width"] = image_info.width
            if image_info.height is not None:
                update_properties["height"] = image_info.height
        else:
            update_properties = {"status": "failed"}

        try:
            batch_update_params = BatchUpdateCanvasElementsParams(
                project_path=project_path_str,
                updates=[ElementUpdate(element_id=placeholder["id"], properties=update_properties)],
            )
            update_result = await self._batch_update_tool.execute(tool_context, batch_update_params)
            if not update_result.ok:
                logger.warning(f"更新占位符失败 (id={placeholder['id']}): {update_result.content}")
                return []
            return update_result.extra_info.get("elements", [])
        except Exception as e:
            logger.error(f"更新占位符异常 (id={placeholder['id']}): {e}", exc_info=True)
            return []

    def _get_model_from_config(self, tool_context: Optional[ToolContext] = None) -> str:
        """获取图片生成模型，优先从 agent context 读取，均未配置时使用默认模型"""
        from app.core.context.agent_context import AgentContext
        default_model = "doubao-seedream-4-0-250828"

        try:
            agent_context = (
                tool_context.get_extension_typed("agent_context", AgentContext)
                if tool_context else None
            )
            if agent_context:
                resolved = agent_context.get_dynamic_image_model_id()
                if resolved:
                    logger.info(f"使用图片模型: {resolved}")
                    return resolved
            else:
                config_data = dynamic_config.read_dynamic_config()
                if config_data:
                    image_model_config = config_data.get("image_model", {})
                    if isinstance(image_model_config, dict):
                        model_id = image_model_config.get("model_id")
                        if model_id and isinstance(model_id, str) and model_id.strip():
                            model = model_id.strip()
                            logger.info(f"从 dynamic_config.yaml 读取图片模型: {model}")
                            return model
        except Exception as e:
            logger.debug(f"获取图片模型失败，使用默认模型: {e}")

        return default_model

    # noinspection PyMethodMayBeStatic
    def _parse_size_to_dimensions(self, size: str) -> Tuple[int, int]:
        """解析 'WxH' 格式的尺寸字符串。格式由上游 validator 或 _resolve_size_from_references 保证合法，此处不兜底。"""
        parts = size.split("x")
        if len(parts) == 2:
            try:
                return int(parts[0]), int(parts[1])
            except ValueError:
                pass
        raise ValueError(f"无法解析尺寸参数 '{size}'，应为 'WxH' 格式")

    async def _extract_generated_images(
        self,
        generation_result: ToolResult,
        workspace_path: Path,
        generate_params: GenerateImageParams,
        project_path: Optional[Path] = None,
        duration_ms: Optional[int] = None,
    ) -> ExtractedImagesResult:
        """从 generate_image 结果中提取图片信息，校验文件完整性并组装元数据"""
        images = []
        errors = []

        extra_info = generation_result.extra_info or {}
        image_list = extra_info.get("saved_images", [])

        for img_path in image_list:
            is_valid, error_msg = await self._validate_image_file(img_path)
            if not is_valid:
                logger.warning(f"图片文件校验失败: {error_msg}")
                errors.append(f"图片校验失败: {Path(img_path).name} - {error_msg}")
                continue

            if project_path is not None:
                relative_path = self._make_relative_to_project(img_path, project_path)
            else:
                try:
                    relative_path = str(Path(img_path).relative_to(workspace_path))
                except ValueError:
                    relative_path = Path(img_path).name

            dimensions = self._read_image_dimensions(img_path)
            image_id = Path(img_path).stem

            size_value = dimensions.size_string if dimensions.is_valid else generate_params.size

            generate_request: Dict[str, Any] = {
                "model_id": generate_params.model,
                "prompt": generate_params.prompt,
                "size": size_value,
                "image_id": image_id,
                "mode": generate_params.mode,
            }
            if duration_ms is not None:
                generate_request["duration_ms"] = duration_ms
            if generate_params.mode == "edit" and generate_params.image_paths:
                generate_request["reference_images"] = generate_params.image_paths

            images.append(GeneratedImageInfo(
                relative_path=relative_path,
                width=dimensions.width,
                height=dimensions.height,
                generate_request=generate_request,
            ))

        return ExtractedImagesResult(images=images, errors=errors)

    # noinspection PyMethodMayBeStatic
    def _read_image_dimensions(self, image_path: str) -> ImageDimensions:
        """从图片文件读取实际尺寸，读取失败时返回 width=None, height=None"""
        try:
            from PIL import Image

            path_obj = Path(image_path)
            if not path_obj.exists():
                return ImageDimensions(width=None, height=None)

            with Image.open(path_obj) as img:
                w, h = img.size
                return ImageDimensions(width=float(w), height=float(h))

        except Exception as e:
            logger.warning(f"读取图片尺寸失败 {image_path}: {e}")
            return ImageDimensions(width=None, height=None)

    async def _normalize_tasks(
        self, tasks: List[ImageTaskSpec], workspace_root: Path, project_prefix: str
    ) -> Optional[ToolResult]:
        """规范化 task 参数：路径解析 + size 自动填充。

        1. reference_images 路径去除前导 /，并将项目相对路径转换为工作区相对路径。
        2. 未指定 size 的 task 从参考图自动读取尺寸；无参考图时要求必须填写 size。
        """
        for idx, task in enumerate(tasks):
            if task.reference_images:
                resolved_refs = []
                for p in task.reference_images:
                    p = p.lstrip("/")
                    if await async_exists(workspace_root / p):
                        resolved_refs.append(p)
                    elif project_prefix and await async_exists(workspace_root / project_prefix / p):
                        resolved_refs.append(f"{project_prefix}/{p}")
                    else:
                        # 路径不存在，保持原样，后续步骤会给出明确错误
                        resolved_refs.append(p)
                task.reference_images = resolved_refs

            if task.size:
                continue
            if not task.reference_images:
                return ToolResult.error(
                    f"Task {idx + 1} ({task.name}): size is required when reference_images is empty.",
                    extra_info={"error_type": "design.error_invalid_property"}
                )
            resolved_size = self._resolve_size_from_references(task.reference_images, workspace_root)
            if resolved_size is None:
                return ToolResult.error(
                    f"Task {idx + 1} ({task.name}): could not read dimensions from any reference image. "
                    f"Please provide size explicitly.",
                    extra_info={"error_type": "design.error_invalid_property"}
                )
            task.size = resolved_size
            logger.info(f"Task {idx + 1} ({task.name}): auto-resolved size={resolved_size} from reference images")
        return None

    def _resolve_size_from_references(
        self, reference_images: List[str], workspace_root: Path
    ) -> Optional[str]:
        """从参考图列表中读取各图片尺寸，返回面积最大的那张的 'WxH' 字符串。
        所有图片都无法读取时返回 None。
        """
        best_area = -1
        best_size: Optional[str] = None

        for ref_path in reference_images:
            # 支持绝对路径和相对路径（相对于 workspace 根）
            path_obj = Path(ref_path)
            if not path_obj.is_absolute():
                path_obj = workspace_root / ref_path

            dims = self._read_image_dimensions(str(path_obj))
            if not dims.is_valid:
                continue

            area = dims.width * dims.height
            if area > best_area:
                best_area = area
                best_size = dims.size_string

        return best_size

    # noinspection PyMethodMayBeStatic
    def _make_relative_to_project(self, absolute_path: str, project_path: Path) -> str:
        """将绝对路径转换为相对于项目目录的路径，转换失败时仅返回文件名"""
        path_obj = Path(absolute_path)
        try:
            return str(path_obj.relative_to(project_path))
        except ValueError:
            logger.warning(f"图片路径 {absolute_path} 不在项目目录 {project_path} 下，仅使用文件名")
            return path_obj.name

    # noinspection PyMethodMayBeStatic
    def _build_result_content(
        self,
        project_path: str,
        tasks: List[ImageTaskSpec],
        task_placeholders: List[Dict],
        generation_results: List[ImageGenerationResult],
    ) -> str:
        """生成给模型读的结果描述，失败元素带 element_id 提示以便重试"""
        total = len(tasks)
        succeeded_count = sum(1 for r in generation_results if r.is_success)
        failed_count = total - succeeded_count

        warning_line = (
            f"\n- Warning: {failed_count}/{total} images failed to generate"
            if failed_count > 0 else ""
        )

        result = (
            f"Generated and Added to Canvas:\n"
            f"- Success: {succeeded_count} images generated\n"
            f"- Failed: {failed_count} images{warning_line}\n"
            f"- Project: {project_path}"
        )

        success_results = [r for r in generation_results if r.is_success]
        if success_results:
            result += "\n\nSucceeded Elements:"
            for r in success_results:
                placeholder = task_placeholders[r.index]
                name = placeholder.get("name", "")
                elem_id = placeholder["id"]
                x = placeholder.get("x")
                y = placeholder.get("y")
                pos = f" at ({x:.0f}, {y:.0f})" if x is not None and y is not None else ""
                result += f"\n- {name} (id: {elem_id}){pos}"

        failed_results = [r for r in generation_results if r.is_failed]
        if failed_results:
            result += "\n\nFailed Elements (pass element_id to retry in place):"
            for r in failed_results:
                placeholder = task_placeholders[r.index]
                name = placeholder.get("name", "")
                elem_id = placeholder["id"]
                result += f'\n- {name} (element_id: "{elem_id}")'

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """生成展示给用户的备注"""
        if not result.ok:
            return i18n.translate("generate_canvas_images.exception", category="tool.messages")

        extra_info = result.extra_info or {}
        succeeded_count = extra_info.get("succeeded_count", 0)
        failed_count = extra_info.get("failed_count", 0)
        total_count = extra_info.get("total_count", 0)

        if succeeded_count == 0 and total_count > 0:
            return i18n.translate("generate_canvas_images.exception", category="tool.messages")

        if failed_count > 0 and succeeded_count > 0:
            return i18n.translate(
                "generate_canvas_images.success_partial",
                category="tool.messages",
                succeeded_count=succeeded_count,
                total_count=total_count,
            )

        return i18n.translate(
            "generate_canvas_images.success",
            category="tool.messages",
            succeeded_count=succeeded_count,
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        if not result.ok:
            return self._handle_design_tool_error(
                result,
                default_action_code="generate_canvas_images",
                default_success_message_code="generate_canvas_images.exception",
            )
        return {
            "action": i18n.translate("generate_canvas_images", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments),
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        if not result.ok:
            return None

        try:
            from app.core.entity.message.server_message import DesignElementContent

            extra_info = result.extra_info or {}
            project_path = extra_info.get("project_path", "")
            elements = extra_info.get("elements", [])

            return ToolDetail(
                type=DisplayType.DESIGN,
                data=DesignElementContent(
                    type="element",
                    project_path=project_path,
                    elements=elements,
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None
