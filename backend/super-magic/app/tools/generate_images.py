"""批量图片生成工具

每个 task 独立指定 prompt / size / name / output_path / reference_images，
有几个 task 就生成几张图，所有任务并发执行。

reference_images 有值时走编辑/参考模式（edits endpoint），否则走纯文本生成模式（generations endpoint）。
"""

import asyncio
import dataclasses
import json
import os
import random
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, ClassVar, List, Optional

from pydantic import BaseModel, Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.event import EventPairType, get_correlation_manager
from agentlang.event.data import PendingToolCallEventData
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.path_manager import PathManager
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.core.entity.attachment import AttachmentStorageType
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.core.entity.tool.tool_result_types import ImageToolResult
from app.i18n import i18n
from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
from app.infrastructure.sdk.magic_service.parameter.update_file_source_parameter import (
    FileSource,
    UpdateFileSourceParameter,
)
from app.service.media_generation_service import AI_IMAGE_GENERATION_SOURCE
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.image_utils import (
    cleanup_temp_files,
    detect_image_file_extension,
    get_model_valid_sizes,
    resolve_image_model,
    resolve_reference_images_to_urls,
    resolve_safe_save_path,
    resolve_size_from_references,
    snap_to_nearest_valid_size,
)
from app.tools.media_generator import (
    HANDLER_MAGIC_SERVICE,
    GeneratedImage,
    ImageGenerationRequest,
    ImageGeneratorDispatcher,
    get_image_generator,
)
from app.tools.media_generator.base import ImageGenerationProviderError, ImageTaskCreatedCallback
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import (
    async_copy2,
    async_exists,
    async_mkdir,
    async_stat,
    async_unlink,
    get_file_id_from_xattr,
)

logger = get_logger(__name__)

SdkSnippetTimeoutRegistry.register("generate_images", min_timeout=600)


@dataclass
class ImageTaskResult:
    """单张图片生成任务的执行结果"""

    success: bool
    prompt: str
    reference_images: List[str]
    saved_path: Optional[str] = None
    relative_path: Optional[str] = None
    error: Optional[str] = None
    model: Optional[str] = None

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)


@dataclass
class ExecutionSummary:
    """批量生图执行汇总"""

    tasks: List[ImageTaskResult]
    succeeded_count: int
    failed_count: int
    total_count: int
    saved_images: List[str]

    def to_dict(self) -> dict:
        return {
            "tasks": [t.to_dict() for t in self.tasks],
            "succeeded_count": self.succeeded_count,
            "failed_count": self.failed_count,
            "total_count": self.total_count,
            "saved_images": self.saved_images,
        }


class ImageGenerationTask(BaseModel):
    """单张图片的生成任务"""

    prompt: str = Field(
        ...,
        description="""<!--zh: 图片生成提示词，建议包含主体、风格、构图、光线、色调，描述越具体生成质量越高；有参考图时，写清每张图参考什么，不要复述参考图里已有的外观。禁止包含色情、暴力、种族歧视等风险内容。-->
Image generation prompt. Include subject, style, composition, lighting, and color tone for best results; with reference images, state what each image governs instead of restating its appearance. Prohibited: pornography, violence, racism.""",
    )
    size: Optional[str] = Field(
        None,
        description="""<!--zh: 输出图片尺寸，格式 'WxH'。有参考图时建议省略——系统会自动取参考图尺寸并 snap 到当前模型的合法尺寸，不要自行按参考图比例计算 size；无参考图时必须明确填写，且只能从当前会话上下文里模型信息（<image model=... sizes=.../>）给出的合法尺寸中选择，不要自己拍一个值。常用备选（仅供无该信息时参考）：2048x2048（方）、1440x2560（9:16）、2560x1440（16:9）、1728x2304（2:3）、2304x1728（3:2）。-->
Output image dimensions in 'WxH' format. When reference_images is non-empty, prefer omitting this field — the system automatically derives it from the reference image and snaps it to the current model's valid sizes. Do NOT calculate a custom size from the reference image's aspect ratio yourself. When reference_images is empty, this field is required and MUST be chosen from the valid sizes listed in the current model info (the `<image model=... sizes=.../>` context), not a self-calculated value. Fallback options if no such info is available: 2048x2048 (square), 1440x2560 (9:16), 2560x1440 (16:9), 1728x2304 (2:3), 2304x1728 (3:2).""",
    )
    name: str = Field(
        ...,
        description="""<!--zh: 输出文件的主文件名（无扩展名），**仅**由本字段决定，系统**不会**从 reference_images 的路径或参考图原文件名推断保存名。命名原则：名字必须**描述本次生成的结果内容**——如果结果与参考图在主题/风格/时段等方面有明显差异（如改为夜晚、换季节、变画风），务必体现差异（如加 夜景、_night、_winter）；只有当结果与参考图内容实质相同（如单纯提高分辨率）时才可沿用参考图主名。命名语言与用户一致；3-5 个词，下划线连接，避免 / \\ : * ? ' < > | 字符。-->
Output file stem (no extension). **Only** this field sets the saved filename; the system does **not** infer it from reference_images paths or the reference file's basename. Naming rule: the name must **describe what this output actually is** — if the result differs meaningfully from the reference (e.g. different time of day, season, style, subject), reflect that difference in the name (e.g. add 夜景, _night, _winter, _sketch); only when the result is essentially identical to the reference (e.g. upscaling only) may you reuse the reference file's stem. Same language as the user; 3-5 words, underscore-connected. Avoid / \\ : * ? ' < > | characters.""",
    )
    output_path: str = Field(
        ...,
        description="""<!--zh: 保存目录（相对路径），根据用户生图意图决定目录名，使用用户所用的语言（如用户是中文则用中文）。-->
Save directory (relative path). Name the directory based on the user's intent for this image; use the same language the user is using.""",
    )
    reference_images: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 参考图或待编辑图片的工作区相对路径列表（如 ['uploads/image.png']）。有值时以参考图为风格/内容/编辑基础生成，prompt 中按此顺序称为图片1、图片2；空列表则纯文本生成。用户上传了图片必须传入。-->
Workspace-relative paths of reference or source images (e.g. ['uploads/image.png']). When provided, generates based on them as style/content/edit reference; the prompt cites them in this order as Image 1, Image 2. Pass [] for text-only generation. Must provide when the user has uploaded images.""",
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

    @field_validator("output_path")
    @classmethod
    def validate_output_path(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("output_path 不能为空")
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


class GenerateImagesParams(BaseToolParams):
    """generate_images 工具参数"""

    MAX_TASKS: ClassVar[int] = 5

    tasks: List[ImageGenerationTask] = Field(
        ...,
        description="""<!--zh: 图片生成任务列表，每个 task 生成一张图，最多 5 个。每个 task 独立指定 prompt、size、name、output_path 和 reference_images，所有任务并发执行。-->
Image generation task list. Each task produces one image, maximum 5 tasks. Each task independently specifies prompt, size, name, output_path, and reference_images. All tasks run concurrently.""",
    )

    @field_validator("tasks", mode="before")
    @classmethod
    def validate_tasks(cls, v: Any) -> Any:
        """兼容模型将 tasks 序列化为 JSON 字符串的情况"""
        if isinstance(v, str):
            try:
                v = json.loads(v)
                if not isinstance(v, list):
                    raise ValueError(
                        f"tasks must be a JSON array, got {type(v).__name__}: {v!r}"
                    )
            except json.JSONDecodeError as e:
                raise ValueError(f"tasks is not valid JSON: {e}") from e
        if not v:
            raise ValueError("tasks 不能为空，至少需要一个任务")
        if len(v) > cls.MAX_TASKS:
            raise ValueError(f"tasks 最多支持 {cls.MAX_TASKS} 个")
        return v


@tool()
class GenerateImages(AbstractFileTool[GenerateImagesParams], WorkspaceTool[GenerateImagesParams]):
    """<!--zh: 图片生成工具，支持文字生图和参考图生图。-->
    Image generation tool. Supports text-to-image and reference-based generation.
    """

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
**调用时机**：用户想生成或编辑一张或多张图片。

**每个 task 的关键规则**
- 用户上传了图片，不论是"参考风格"、"修改内容"还是"改局部"，都必须传入 reference_images
- 每个 task 可以有不同的 output_path，实现分类保存
- 保存用的文件名**只**看 `name` 字段，与参考图路径无关；`name` 必须描述**本次结果**的内容——结果与参考图有明显差异时（改时段、改风格等）要体现差异，不要惯性复用参考图文件的主名

**Prompt 写法**
- Prompt 是创意简报，不是关键词堆砌。把你要传达的视觉决定逐一写清楚，而不是堆叠空洞形容词（"精美"、"震撼"）
- 要消除歧义：确定哪 2-3 个视觉维度如果出错就会让图片失败，把这些维度写明
- 用具体替代含糊："戏剧性光线" → "来自左侧 90°的单点硬光，右侧深度阴影"
- 有参考图时，生成模型会直接看图；prompt 是它同样会遵从的第二条信息通道。复述参考图里已有的外观（肤色、胡子、眼镜、服装细节）不会增加信息，看错或说重了还会把结果拉离参考图
- 所以文字只写图片表达不了的内容：按 reference_images 顺序称为图片1、图片2，写清每张图负责哪些方面（人物身份与五官、发型、服装、表情、姿势、产品外形与标签、构图、配色、光线、风格）以及保持程度（完全一致或宽松参考）；再完整描述新的场景、动作、镜头、光线和要改动的内容
- 需要强调时照常强调：用户提到的特征、正在修改的部分、容易丢失的小细节（logo、痣、包装文字）、需要区分多个主体时，指向参考图里的位置来写（"保留图片1左脸颊的痣"），不要重新描述它的样子；用户原话照常保留
- 用户给出模糊描述时，扩写为包含主体、构图、光线、色调的完整描述；用户给出精心构建的 prompt 时，保留其原文，仅补充必要参数

**形式选择**
- 用户已经选择直接生图、网页或 SVG 时，遵循选择，不重复询问
- 用户要视觉成品但没有指定形式，且多种形式都适用时，简要说明利弊、给出推荐，再让用户选择
- 直接生图适合少量文字和图文一体的视觉构图；文字与画面一起生成，但修改图片中的文字通常需要再次编辑或生成
- 网页适合长篇、结构化内容和频繁修改；正文保持为可编辑网页文字，按需生成配图
- 用户明确要求 SVG 时，这是直接写 SVG 文件的请求，不是生图请求；使用现有文件写入能力创建 `.svg`，不要调用本工具、脚本、代码生成器、位图中间产物或 PNG/JPG 转 SVG
- 纯配图、背景图或其它纯视觉素材不需要触发形式选择

**语言规则**
- prompt、name、output_path 全部使用用户所用的语言
- name 描述这张图的具体内容（主体是谁/什么），不用编号或通用分类
-->
**When to call**: user wants to generate or edit one or more images.

Image generation, editing, retries, and additional candidates may consume points or money. After a successful image, let the user review it; do not regenerate or add candidates because of your own aesthetic judgment. Follow the core user-confirmation rule for any additional image call.

**Key rules per task**
- If the user uploaded images — whether to reference style, modify content, or change a detail — always pass them via reference_images
- Each task can have a different output_path for organized saving
- The saved file stem comes **only** from `name`, not from reference image paths. `name` must describe what **this output actually is** — when the result differs meaningfully from the reference (different time of day, style, subject, etc.), reflect that in the name; do not default to the reference file's stem

**Prompt writing**
- A prompt is a creative brief, not a keyword list. Make every visual decision explicit rather than stacking vague adjectives ("beautiful", "stunning")
- Identify the 2–3 dimensions that would make the image fail if wrong, and make those explicit
- Replace vague terms with specifics: "dramatic lighting" → "single hard key light at 90° to the subject, deep shadow on the opposite side"
- With reference images, the generation model sees them directly; your prompt is a second channel it also obeys. Restating their appearance (skin tone, facial hair, glasses, clothing details) adds nothing, and a misreading or exaggeration pulls the result away from the reference
- So write what the images cannot say: cite them by reference_images order as Image 1, Image 2 (图片1, 图片2 in a Chinese prompt), state which aspects each governs (identity and face, hairstyle, outfit, expression, pose, product shape and label, composition, palette, lighting, style) and how strictly (exact or loose); then fully describe the new scene, action, camera, lighting, and the change
- Emphasize when it matters: a feature the user mentioned, the part being changed, a small detail that is easily lost (logo, mole, label text), or which of several subjects you mean. Point to it in the reference ("keep the mole on the left cheek from Image 1") instead of re-describing it; keep the user's own wording
- User gives a vague idea → expand into a complete visual specification; user provides a crafted prompt → keep their wording, only append missing parameters

**Format selection**
- If the user already chose direct image generation, HTML, or SVG, follow that choice without asking again
- If the user wants a visual deliverable but has not chosen a format and multiple formats fit, briefly explain the tradeoffs, recommend one, and let the user choose
- Direct image generation suits concise copy and integrated visual compositions. Generate requested wording together with the artwork, but changing embedded wording usually requires another image edit or generation
- HTML suits long or structured content and frequent revisions. Keep the copy as editable page text and generate supporting images only when needed
- An explicit SVG request is a direct file-authoring request, not an image-generation request. Write the `.svg` file with the existing file-writing capability; do not call this tool, use scripts or code generators, create a raster intermediate, or convert PNG/JPG to SVG
- Supporting-illustration, background-only, or other pure-image requests do not require this format question

**Language rules**
- Write prompt, name, and output_path in the same language the user is using
- name must describe the specific content of that image (the actual subject), not a numbered slot or generic category label
"""

    def __init__(self, **data):
        if "base_dir" not in data:
            data["base_dir"] = PathManager.get_workspace_dir()
        super().__init__(**data)

    async def _dispatch_file_event(self, tool_context: ToolContext, filepath: str, event_type: EventType, is_screenshot: bool = False, source: int = AI_IMAGE_GENERATION_SOURCE) -> None:
        """分发文件创建/更新事件，source=5 (AI图片生成)"""
        await super()._dispatch_file_event(tool_context, filepath, event_type, is_screenshot=False, source=AI_IMAGE_GENERATION_SOURCE)

    async def execute_purely(
        self,
        tool_context: ToolContext,
        params: GenerateImagesParams,
        *,
        model_id: Optional[str] = None,
        on_task_created: Optional[ImageTaskCreatedCallback] = None,
        report_progress: bool = True,
    ) -> ImageToolResult:
        """供其他工具内部调用，并允许使用已验证的图片模型覆盖值。

        `on_task_created` 由画布链路传入，用来把任务时间写进元素元数据。
        """
        return await self._execute_with_model(
            tool_context,
            params,
            model_id=model_id,
            on_task_created=on_task_created,
            report_progress=report_progress,
        )

    async def execute(
        self, tool_context: ToolContext, params: GenerateImagesParams
    ) -> ImageToolResult:
        """并发执行所有生成任务，汇总结果。"""
        return await self._execute_with_model(tool_context, params)

    async def _execute_with_model(
        self,
        tool_context: ToolContext,
        params: GenerateImagesParams,
        *,
        model_id: Optional[str] = None,
        on_task_created: Optional[ImageTaskCreatedCallback] = None,
        report_progress: bool = True,
    ) -> ImageToolResult:
        """使用显式模型或当前用户图片模型执行批量生成。"""
        try:
            image_dispatcher = get_image_generator()
            model = model_id.strip() if model_id and model_id.strip() else await resolve_image_model(tool_context)

            workspace_root = Path(str(self.base_dir))
            await self._normalize_tasks(params.tasks, workspace_root, tool_context)

            # 整批任务共用一张工具卡，进度事件只需要下发一次；画布元素则每个任务各写各的。
            generation_progress_dispatched = False

            async def _handle_task_created(
                task_id: str,
                expected_finished_at: Optional[str],
                started_at: Optional[str],
            ) -> None:
                nonlocal generation_progress_dispatched
                if on_task_created is not None:
                    await on_task_created(task_id, expected_finished_at, started_at)
                if not report_progress or generation_progress_dispatched or expected_finished_at is None:
                    return
                generation_progress_dispatched = True
                await self._dispatch_generation_progress(
                    tool_context, params, task_id, expected_finished_at, started_at
                )

            async def _run_with_delay(
                idx: int, gen_task: ImageGenerationTask
            ) -> ImageTaskResult:
                # 错开并发请求，首个 task 不延迟
                if idx > 0:
                    await asyncio.sleep(min(idx * 0.1 + random.uniform(0, 1.0), 3.0))
                return await self._generate_single(
                    gen_task, model, image_dispatcher, tool_context, _handle_task_created
                )

            task_results: List[ImageTaskResult] = list(
                await asyncio.gather(*[_run_with_delay(i, t) for i, t in enumerate(params.tasks)])
            )

            return self._build_tool_result(task_results)

        except Exception as e:
            logger.error(f"generate_images 执行失败: {e}")
            return ImageToolResult(
                ok=False,
                content=i18n.translate(
                    "generate_images.error",
                    category="tool.messages",
                    error=str(e),
                ),
                images=[],
                extra_info={"error": str(e)},
            )

    def _build_tool_result(self, task_results: List[ImageTaskResult]) -> ImageToolResult:
        """根据任务结果列表构造最终的 ImageToolResult。"""
        succeeded_count = sum(1 for r in task_results if r.success)
        summary = ExecutionSummary(
            tasks=task_results,
            succeeded_count=succeeded_count,
            failed_count=len(task_results) - succeeded_count,
            total_count=len(task_results),
            saved_images=[r.saved_path for r in task_results if r.saved_path],
        )

        if summary.succeeded_count == 0:
            error_detail = next((r.error for r in task_results if r.error), "unknown error")
            return ImageToolResult(
                ok=False,
                content=i18n.translate(
                    "generate_images.error",
                    category="tool.messages",
                    error=error_detail,
                ),
                images=[],
                extra_info=summary.to_dict(),
            )

        file_paths = ", ".join(r.relative_path for r in task_results if r.relative_path)

        if summary.failed_count > 0:
            errors = "; ".join(
                f"{r.prompt[:30]!r} -> {r.error}"
                for r in task_results
                if r.error
            )
            content = i18n.translate(
                "generate_images.success_partial",
                category="tool.messages",
                succeeded_count=summary.succeeded_count,
                total_count=summary.total_count,
                file_paths=file_paths,
                errors=errors,
            )
        else:
            content = i18n.translate(
                "generate_images.success",
                category="tool.messages",
                succeeded_count=summary.succeeded_count,
                file_paths=file_paths,
            )

        return ImageToolResult(
            ok=True,
            content=content,
            images=summary.saved_images,
            extra_info=summary.to_dict(),
        )

    async def _normalize_tasks(
        self, tasks: List[ImageGenerationTask], workspace_root: Path, tool_context: ToolContext
    ) -> None:
        """
        对所有 task 做参数归一化：
        1. reference_images 去前导 /
        2. size 缺失时从参考图自动推断
        3. 无论 size 来自 LLM 还是参考图推断，统一 snap 到当前模型的合法尺寸
           （合法尺寸列表来自平台注入的模型能力，未配置时不做任何改写）
        """
        valid_sizes = get_model_valid_sizes(tool_context)

        for idx, task in enumerate(tasks):
            if task.reference_images:
                task.reference_images = [p.lstrip("/") for p in task.reference_images]

            if not task.size:
                if not task.reference_images:
                    raise ValueError(
                        f"Task {idx + 1} ({task.prompt[:30]!r}): "
                        f"size is required when reference_images is empty."
                    )
                resolved = await resolve_size_from_references(task.reference_images, workspace_root)
                if resolved is None:
                    raise ValueError(
                        f"Task {idx + 1} ({task.prompt[:30]!r}): "
                        f"could not read dimensions from any reference image. "
                        f"Please provide size explicitly."
                    )
                task.size = resolved
                logger.info(f"Task {idx + 1}: auto-resolved size={resolved} from reference images")

            snapped = snap_to_nearest_valid_size(task.size, valid_sizes)
            if snapped != task.size:
                logger.info(f"Task {idx + 1}: size {task.size} not in valid list, snapped to {snapped}")
                task.size = snapped

    def _make_relative_path(self, saved_path: str) -> str:
        """计算相对于工作区根目录的相对路径，失败时回退到文件名。"""
        try:
            return str(Path(saved_path).relative_to(self.base_dir))
        except ValueError:
            return Path(saved_path).name

    async def _generate_single(
        self,
        task: ImageGenerationTask,
        model: str,
        dispatcher: ImageGeneratorDispatcher,
        tool_context: ToolContext,
        on_task_created: Optional[ImageTaskCreatedCallback] = None,
    ) -> ImageTaskResult:
        """生成单张图片，失败自动重试一次，返回结构化结果。"""
        output_path = task.output_path.strip()
        save_dir = Path(str(self.base_dir)) / output_path
        await async_mkdir(save_dir, parents=True, exist_ok=True)

        base_filename = task.name.strip()

        for attempt in range(2):
            is_retry = attempt > 0
            attempt_desc = f"重试 {attempt}/1" if is_retry else "首次"
            # 重试时文件名加后缀，避免与首次尝试的文件冲突
            filename_stem = f"{base_filename}_retry{attempt}" if is_retry else base_filename

            if is_retry:
                await asyncio.sleep(random.uniform(0.5, 1.5))

            temp_files: List[str] = []
            try:
                # 转换参考图本地路径为可访问 URL
                reference_urls: List[str] = []
                if task.reference_images:
                    reference_urls, temp_files = await resolve_reference_images_to_urls(
                        task.reference_images, Path(str(self.base_dir))
                    )

                request = ImageGenerationRequest(
                    prompt=task.prompt,
                    size=task.size,
                    model=model,
                    reference_image_urls=reference_urls,
                )
                response = await dispatcher.generate(
                    HANDLER_MAGIC_SERVICE, request, on_task_created
                )

                best = await response._pick_best_image()
                saved_path = await self._save_from_image(
                    best,
                    save_dir,
                    filename_stem,
                    tool_context,
                )
                retry_note = " (重试成功)" if is_retry else ""
                logger.info(f"图片生成并保存成功{retry_note}: {saved_path}")
                return ImageTaskResult(
                    success=True,
                    prompt=task.prompt,
                    reference_images=task.reference_images,
                    saved_path=saved_path,
                    relative_path=self._make_relative_path(saved_path),
                    model=model,
                )

            except ImageGenerationProviderError as e:
                # provider 级别的明确错误（内容审核、参数非法等），直接失败，不重试
                error_msg = str(e)
                logger.warning(f"单张图片生成失败 (provider error): {error_msg} (prompt={task.prompt[:50]!r})")
                return ImageTaskResult(
                    success=False,
                    prompt=task.prompt,
                    reference_images=task.reference_images,
                    error=error_msg,
                )
            except Exception as e:
                error_msg = f"失败 ({attempt_desc}): {e}"
                logger.warning(f"单张图片生成{error_msg} (prompt={task.prompt[:50]!r})")
                if attempt < 1:
                    continue
                return ImageTaskResult(
                    success=False,
                    prompt=task.prompt,
                    reference_images=task.reference_images,
                    error=error_msg,
                )
            finally:
                await cleanup_temp_files(temp_files)

        return ImageTaskResult(
            success=False,
            prompt=task.prompt,
            reference_images=task.reference_images,
            error="未知错误",
        )

    async def _dispatch_generation_progress(
        self,
        tool_context: ToolContext,
        params: GenerateImagesParams,
        task_id: str,
        expected_finished_at: str,
        started_at: Optional[str],
    ) -> None:
        """补发生成时间，供工具卡与 Canvas 使用同一进度口径。"""
        try:
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
            if agent_context is None:
                return

            # 委托调用时沿用外层工具的名称与文案，确保进度更新原工具卡。
            tool_name = tool_context.tool_name or "generate_images"
            tool_instance = self
            friendly_arguments = dict(tool_context.arguments or {})
            if tool_name != "generate_images":
                try:
                    from app.tools.core.tool_factory import tool_factory

                    tool_instance = tool_factory.get_tool_instance(tool_name)
                except Exception:
                    tool_name = "generate_images"
                    friendly_arguments = {}
            if not friendly_arguments:
                friendly_arguments = {"tasks": [task.model_dump() for task in params.tasks]}

            scope_id = getattr(agent_context, "context_id", None)
            correlation_id = get_correlation_manager().get_active_correlation_id(
                EventPairType.TOOL_CALL, scope_id
            ) or tool_context.tool_call_id or str(uuid.uuid4())

            friendly = await tool_instance.get_before_tool_call_friendly_action_and_remark(
                tool_name,
                tool_context,
                friendly_arguments,
            )

            event_data = PendingToolCallEventData(
                tool_context=tool_context,
                tool_name=tool_name,
                arguments={
                    "name": tool_name,
                    "correlation_id": correlation_id,
                    "action": friendly.get("action", ""),
                    "detail": {
                        "type": DisplayType.GENERATION_PROGRESS.value,
                        "data": {
                            "media_type": "image",
                            "task_id": task_id,
                            "started_at": started_at,
                            "expected_finished_at": expected_finished_at,
                            "message": friendly.get("remark", ""),
                        },
                    },
                    "status": "processing",
                },
                tool_instance=tool_instance,
                correlation_id=correlation_id,
            )
            agent_context.update_activity_time()
            await agent_context.dispatch_event(EventType.PENDING_TOOL_CALL, event_data)
        except Exception as e:
            # 进度下发失败不能影响出图结果。
            logger.warning(f"下发图片生成进度失败: {e}")

    async def _save_from_image(
        self,
        image: GeneratedImage,
        save_dir: Path,
        filename_stem: str,
        tool_context: ToolContext,
    ) -> str:
        """将单张生成图片的临时文件拷贝到最终目标路径，触发文件版本事件和媒体通知。"""
        extension = await detect_image_file_extension(image.temp_file_path)
        save_path = await resolve_safe_save_path(save_dir, filename_stem, extension)

        async with self._file_versioning_context(
            tool_context, save_path, track_in_horizon=False
        ) as file_existed:
            await async_copy2(image.temp_file_path, save_path)

        try:
            await async_unlink(image.temp_file_path)
        except Exception as e:
            logger.warning(f"清理临时文件失败: {image.temp_file_path}, 错误: {e}")

        try:
            file_id_str = await get_file_id_from_xattr(str(save_path))
            if file_id_str:
                sdk = get_magic_service_sdk()
                param = UpdateFileSourceParameter(
                    file_id=int(file_id_str),
                    source=FileSource.AI_IMAGE_GENERATION,
                )
                await sdk.file.update_file_source_async(param)
                logger.info(f"Updated file source: file_id={file_id_str}, source={FileSource.AI_IMAGE_GENERATION}")
            else:
                logger.warning(f"No file_id found in xattr, skipping update_file_source: {save_path}")
        except Exception as e:
            logger.warning(f"Failed to update file source: {e}")

        return str(save_path)

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict | None = None,
    ) -> Optional[ToolDetail]:
        """获取工具详情用于前端预览（展示第一张成功图片）。"""
        if not result.ok or not isinstance(result, ImageToolResult):
            return None

        saved_images = (
            result.extra_info.get("saved_images", []) if result.extra_info else []
        )
        if not saved_images:
            return None

        first_image_path = saved_images[0]
        try:
            safe_path = self.resolve_path(first_image_path)
            if not await async_exists(safe_path):
                logger.warning(f"图片文件不存在: {safe_path}")
                return None
            if safe_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
                logger.warning(f"文件不是识别的图片格式: {safe_path}")
                return None
            stat = await async_stat(safe_path)
            if stat.st_size < 100:
                logger.warning(f"图片文件异常小 ({stat.st_size} 字节): {safe_path}")
                return None
        except Exception as e:
            logger.error(f"验证图片路径失败 {first_image_path}: {e}")
            return None

        try:
            relative_file_path = safe_path.relative_to(self.base_dir).as_posix()
        except ValueError:
            logger.error(f"生成图片不在当前工作区内: {safe_path}")
            return None

        return ToolDetail(
            type=DisplayType.IMAGE,
            data=FileContent(
                file_name=safe_path.name,
                content="",
                relative_file_path=relative_file_path,
                storage_type=AttachmentStorageType.WORKSPACE,
            ),
        )

    def _get_remark_content(
        self, result: ToolResult, arguments: dict | None = None
    ) -> str:
        if not result.ok:
            task_remark = self._get_task_result_remark(result, self._get_task_names(arguments))
            if task_remark:
                return task_remark
            return i18n.translate("generate_images.failed", category="tool.messages")

        if isinstance(result, ImageToolResult) and result.extra_info:
            succeeded: int = result.extra_info.get("succeeded_count", 0)
            total: int = result.extra_info.get("total_count", 0)
            failed: int = result.extra_info.get("failed_count", 0)
            saved_images: List[str] = result.extra_info.get("saved_images", [])
            task_names = self._get_task_names(arguments)
            task_remark = self._get_task_result_remark(result, task_names)
            if task_remark:
                return task_remark

            if succeeded == 0:
                return i18n.translate("generate_images.failed", category="tool.messages")
            if succeeded == 1 and saved_images:
                return os.path.basename(saved_images[0])
            if failed > 0:
                return i18n.translate(
                    "generate_images.remark_success_partial",
                    category="tool.messages",
                    succeeded_count=succeeded,
                    total_count=total,
                )
            return i18n.translate(
                "generate_images.remark_success",
                category="tool.messages",
                succeeded_count=succeeded,
            )

        return i18n.translate("generate_images.processing", category="tool.messages")

    @staticmethod
    def _get_task_names(arguments: dict | None) -> List[str]:
        tasks = (arguments or {}).get("tasks", [])
        return [
            str(task.get("name") or "").strip()
            for task in tasks
            if isinstance(task, dict)
        ]

    @staticmethod
    def _get_task_result_remark(result: ToolResult, task_names: List[str]) -> str:
        if not result.extra_info:
            return ""
        task_results = result.extra_info.get("tasks")
        if not isinstance(task_results, list) or not task_results:
            return ""

        segments: List[str] = []
        for index, task_result in enumerate(task_results):
            if not isinstance(task_result, dict):
                continue
            name = task_names[index] if index < len(task_names) else ""
            if not name:
                saved_path = str(task_result.get("relative_path") or task_result.get("saved_path") or "")
                name = os.path.basename(saved_path)
            if not name:
                continue
            key = (
                "generate_images.item_status.completed"
                if task_result.get("success")
                else "generate_images.item_status.failed"
            )
            segments.append(i18n.translate(key, category="tool.messages", name=name))
        return "；".join(segments)

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: dict | None = None,
    ) -> dict:
        action = i18n.translate("generate_images_ing", category="tool.actions")

        tasks: List[dict] = (arguments or {}).get("tasks", [])
        names = [t.get("name", "").strip() for t in tasks if t.get("name", "").strip()]
        remark = ", ".join(names)

        return {"action": action, "remark": remark}

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict | None = None,
    ) -> dict[str, str]:
        result.use_custom_remark = True
        return {
            "action": i18n.translate("generate_images", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments),
        }
