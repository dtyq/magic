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
from dataclasses import dataclass
from pathlib import Path
from typing import Any, ClassVar, List, Optional

from pydantic import BaseModel, Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.path_manager import PathManager
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.core.entity.tool.tool_result_types import ImageToolResult
from app.i18n import i18n
from app.service.media_generation_service import (
    AI_IMAGE_GENERATION_SOURCE,
    notify_generated_media_file,
)
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.image_utils import (
    cleanup_temp_files,
    resolve_image_model,
    resolve_reference_images_to_urls,
    resolve_safe_save_path,
    resolve_size_from_references,
)
from app.tools.media_generator import (
    HANDLER_MAGIC_SERVICE,
    GeneratedImage,
    ImageGenerationRequest,
    ImageGenerationResponse,
    ImageGeneratorDispatcher,
    get_image_generator,
)
from app.tools.media_generator.base import ImageGenerationProviderError
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_copy2, async_exists, async_mkdir, async_stat, async_unlink

logger = get_logger(__name__)


@dataclass
class ImageTaskResult:
    """单张图片生成任务的执行结果"""

    success: bool
    prompt: str
    reference_images: List[str]
    saved_path: Optional[str] = None
    relative_path: Optional[str] = None
    error: Optional[str] = None

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
        description="""<!--zh: 图片生成提示词，建议包含主体、风格、构图、光线、色调，描述越具体生成质量越高。禁止包含色情、暴力、种族歧视等风险内容。-->
Image generation prompt. Include subject, style, composition, lighting, and color tone for best results. Prohibited: pornography, violence, racism.""",
    )
    size: Optional[str] = Field(
        None,
        description="""<!--zh: 输出图片尺寸，格式 'WxH'。有参考图时可省略，系统自动取面积最大的参考图尺寸；无参考图时必须明确填写，常用备选：2048x2048（方）、1440x2560（9:16）、2560x1440（16:9）、1728x2304（2:3）、2304x1728（3:2）。-->
Output image dimensions in 'WxH' format. Optional when reference_images is non-empty — the system automatically uses the largest reference image's dimensions. Required when reference_images is empty; common options: 2048x2048 (square), 1440x2560 (9:16), 2560x1440 (16:9), 1728x2304 (2:3), 2304x1728 (3:2).""",
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
        description="""<!--zh: 参考图或待编辑图片的工作区相对路径列表（如 ['uploads/image.png']）。有值时以参考图为风格/内容/编辑基础生成；空列表则纯文本生成。用户上传了图片必须传入。-->
Workspace-relative paths of reference or source images (e.g. ['uploads/image.png']). When provided, generates based on them as style/content/edit reference. Pass [] for text-only generation. Must provide when the user has uploaded images.""",
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
- 图生图时，分离内容与风格：主体（形状、颜色、细节）是什么必须保留，背景/光线/色调可以变化
- 多张参考图时，按 reference_images 中的顺序引用，如"第一张图"、"第二张图"，并声明每张图贡献的属性
- 用户给出模糊描述时，扩写为包含主体、构图、光线、色调的完整描述；用户给出精心构建的 prompt 时，保留其原文，仅补充必要参数

**语言规则**
- prompt、name、output_path 全部使用用户所用的语言
- name 描述这张图的具体内容（主体是谁/什么），不用编号或通用分类
-->
**When to call**: user wants to generate or edit one or more images.

**Key rules per task**
- If the user uploaded images — whether to reference style, modify content, or change a detail — always pass them via reference_images
- Each task can have a different output_path for organized saving
- The saved file stem comes **only** from `name`, not from reference image paths. `name` must describe what **this output actually is** — when the result differs meaningfully from the reference (different time of day, style, subject, etc.), reflect that in the name; do not default to the reference file's stem

**Prompt writing**
- A prompt is a creative brief, not a keyword list. Make every visual decision explicit rather than stacking vague adjectives ("beautiful", "stunning")
- Identify the 2–3 dimensions that would make the image fail if wrong, and make those explicit
- Replace vague terms with specifics: "dramatic lighting" → "single hard key light at 90° to the subject, deep shadow on the opposite side"
- For image-to-image: separate content from style — state what must be preserved (subject shape, color, surface details) and what can change (background, lighting, color grade)
- With multiple references, cite them by position in reference_images ("the first image", "the second image") and declare what each contributes
- User gives a vague idea → expand into a complete visual specification; user provides a crafted prompt → keep their wording, only append missing parameters

**Language rules**
- Write prompt, name, and output_path in the same language the user is using
- name must describe the specific content of that image (the actual subject), not a numbered slot or generic category label
"""

    def __init__(self, **data):
        if "base_dir" not in data:
            data["base_dir"] = PathManager.get_workspace_dir()
        super().__init__(**data)

    async def execute_purely(
        self, tool_context: ToolContext, params: GenerateImagesParams
    ) -> ImageToolResult:
        """供其他工具内部调用的纯执行入口，等价于 execute。"""
        return await self.execute(tool_context, params)

    async def execute(
        self, tool_context: ToolContext, params: GenerateImagesParams
    ) -> ImageToolResult:
        """并发执行所有生成任务，汇总结果。"""
        try:
            image_dispatcher = get_image_generator()
            model = await resolve_image_model(tool_context)

            workspace_root = Path(str(self.base_dir))
            await self._normalize_tasks(params.tasks, workspace_root)

            async def _run_with_delay(
                idx: int, gen_task: ImageGenerationTask
            ) -> ImageTaskResult:
                # 错开并发请求，首个 task 不延迟
                if idx > 0:
                    await asyncio.sleep(min(idx * 0.1 + random.uniform(0, 1.0), 3.0))
                return await self._generate_single(gen_task, model, image_dispatcher, tool_context)

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
        self, tasks: List[ImageGenerationTask], workspace_root: Path
    ) -> None:
        """
        对所有 task 做参数归一化：
        1. reference_images 去前导 /
        2. size 缺失时从参考图自动推断
        """
        for idx, task in enumerate(tasks):
            if task.reference_images:
                task.reference_images = [p.lstrip("/") for p in task.reference_images]

            if task.size:
                continue
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
                response = await dispatcher.generate(HANDLER_MAGIC_SERVICE, request)

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

    async def _save_from_image(
        self,
        image: GeneratedImage,
        save_dir: Path,
        filename_stem: str,
        tool_context: ToolContext,
    ) -> str:
        """将单张生成图片的临时文件拷贝到最终目标路径，触发文件版本事件和媒体通知。"""
        save_path = await resolve_safe_save_path(save_dir, filename_stem)

        async with self._file_versioning_context(
            tool_context, save_path, update_timestamp=False
        ) as file_existed:
            await async_copy2(image.temp_file_path, save_path)

        try:
            await async_unlink(image.temp_file_path)
        except Exception as e:
            logger.warning(f"清理临时文件失败: {image.temp_file_path}, 错误: {e}")

        try:
            await notify_generated_media_file(
                file_path=str(save_path),
                base_dir=self.base_dir,
                file_existed=file_existed,
                source=AI_IMAGE_GENERATION_SOURCE,
            )
        except Exception as e:
            logger.warning(f"发送文件通知失败: {e}")

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

        file_name = os.path.basename(first_image_path)
        return ToolDetail(
            type=DisplayType.IMAGE,
            data=FileContent(file_name=file_name, content=file_name),
        )

    def _get_remark_content(
        self, result: ToolResult, arguments: dict | None = None
    ) -> str:
        if not result.ok:
            return i18n.translate("generate_images.failed", category="tool.messages")

        if isinstance(result, ImageToolResult) and result.extra_info:
            succeeded: int = result.extra_info.get("succeeded_count", 0)
            total: int = result.extra_info.get("total_count", 0)
            failed: int = result.extra_info.get("failed_count", 0)
            saved_images: List[str] = result.extra_info.get("saved_images", [])

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
