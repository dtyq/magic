"""生成图片并添加到画布工具

此工具整合了 AI 图片生成和画布元素创建，一步完成图片生成和添加。
支持单张或批量（1-4张），自动处理布局和元数据保存。
"""

from app.i18n import i18n
import asyncio
import random
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

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

logger = get_logger(__name__)

# 图片生成耗时较长，注册最小超时供 run_sdk_snippet 自动提升
SdkSnippetTimeoutRegistry.register("generate_images_to_canvas", min_timeout=600)


@dataclass
class ImageGenerationResult:
    """图片生成结果

    Attributes:
        index: 图片在批次中的索引（0开始）
        success: 是否生成成功
        image_info: 成功时的图片信息
        error_message: 失败时的错误信息
    """
    index: int
    success: bool
    image_info: Optional['GeneratedImageInfo'] = None
    error_message: Optional[str] = None

    @property
    def is_success(self) -> bool:
        """是否成功"""
        return self.success

    @property
    def is_failed(self) -> bool:
        """是否失败"""
        return not self.success


@dataclass
class ImageDimensions:
    """图片尺寸信息

    Attributes:
        width: 图片宽度（像素），None 表示读取失败
        height: 图片高度（像素），None 表示读取失败
    """
    width: Optional[float]
    height: Optional[float]

    @property
    def is_valid(self) -> bool:
        """尺寸是否有效（宽高都不为空）"""
        return self.width is not None and self.height is not None

    @property
    def size_string(self) -> Optional[str]:
        """返回尺寸字符串，格式：'宽x高'，如果无效返回 None"""
        if self.is_valid:
            return f"{int(self.width)}x{int(self.height)}"
        return None


@dataclass
class GeneratedImageInfo:
    """生成的图片信息

    Attributes:
        relative_path: 相对于 workspace 的路径
        width: 图片宽度（从文件读取）
        height: 图片高度（从文件读取）
        generate_request: 生成请求参数
    """
    relative_path: str
    width: Optional[float]
    height: Optional[float]
    generate_request: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式（用于兼容现有代码）"""
        result = {
            "relative_path": self.relative_path,
            "metadata": {
                "generateImageRequest": self.generate_request
            }
        }
        if self.width is not None:
            result["width"] = self.width
        if self.height is not None:
            result["height"] = self.height
        return result


@dataclass
class ExtractedImagesResult:
    """图片提取结果

    Attributes:
        images: 成功提取的图片信息列表
        errors: 提取失败的错误信息列表
    """
    images: List[GeneratedImageInfo]
    errors: List[str]

    @property
    def has_success(self) -> bool:
        """是否有成功的图片"""
        return len(self.images) > 0

    @property
    def has_errors(self) -> bool:
        """是否有错误"""
        return len(self.errors) > 0

    @property
    def success_count(self) -> int:
        """成功数量"""
        return len(self.images)

    @property
    def error_count(self) -> int:
        """错误数量"""
        return len(self.errors)


class GenerateImagesToCanvasParams(BaseToolParams):
    """生成图片到画布的参数（简化版）

    设计理念：最小化必填参数，其他全部内部处理
    """

    # ========== 必填参数 ==========
    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹，即画布项目标识）-->
Relative path to the design project (folder containing magic.project.js, the canvas project identifier)"""
    )

    prompts: List[str] = Field(
        ...,
        description="""<!--zh: 图片生成提示词列表，最多 6 条。单条时与 image_count 配合生成变体，多条时每条独立生成一张图。-->
Image generation prompts, up to 6 entries. One entry pairs with image_count for variations; multiple entries each produce an independent image."""
    )

    size: str = Field(
        ...,
        description="""<!--zh: 输出图片尺寸，格式 'WxH'。优先从上下文提供的可用尺寸信息中选取；无配置时常用备选：2048x2048（方）、1440x2560（9:16）、2560x1440（16:9）、1728x2304（2:3）、2304x1728（3:2）。-->
Output image dimensions. Format: 'WxH'. Prefer sizes listed in the model's available options in context. Common fallbacks: 2048x2048 (square), 1440x2560 (9:16), 2560x1440 (16:9), 1728x2304 (2:3), 2304x1728 (3:2)."""
    )

    name: str = Field(
        ...,
        description="""<!--zh: 画布元素名称。生成多张时自动追加序号后缀（_1, _2, …）。-->
Canvas element label. Multiple images automatically receive index suffixes (_1, _2, …)."""
    )

    # ========== 非必填参数 ==========
    image_count: int = Field(
        1,
        description="""<!--zh: 单提示词模式下生成的变体数量（1-4，默认 1）。多提示词模式下此参数被忽略。-->
Number of variations in single-prompt mode (1–4, default 1). Ignored when multiple prompts are provided."""
    )

    reference_images: List[str] = Field(
        ...,
        description="""<!--zh: 参考图片路径列表（必填）。无参考图时传入空列表 []。参考图为生成提供视觉锚点（结构、风格、构图），模型以其为起点创作，而非复制。-->
Reference image paths (required). Pass [] for text-only generation. Reference images serve as a visual anchor — structure, style, or composition — that the model builds upon rather than copies."""
    )

    @field_validator('prompts')
    @classmethod
    def validate_prompts(cls, v):
        """验证 prompts 参数"""
        if not v or len(v) == 0:
            raise ValueError("prompts 不能为空列表，至少需要提供一个提示词")

        if len(v) > 6:
            raise ValueError("prompts 最多支持 6 个提示词")

        # 检查每个 prompt 不能为空
        for idx, prompt in enumerate(v):
            if not prompt or not prompt.strip():
                raise ValueError(f"第 {idx + 1} 个提示词不能为空")

        return v

    @field_validator('image_count')
    @classmethod
    def validate_image_count(cls, v):
        """验证 image_count 参数"""
        if v < 1:
            raise ValueError("image_count 至少为 1")

        if v > 4:
            raise ValueError("image_count 最大为 4（单次调用限制）")

        return v


@tool()
class GenerateImagesToCanvas(BaseDesignTool[GenerateImagesToCanvasParams]):
    """<!--zh: 生成 AI 图片并自动添加到画布，支持文生图和图生图两种锚点，支持单主题变体和多主题独立图两种输出结构。-->
    Generate AI images and automatically add them to the canvas. Supports text-only and reference-anchored generation, with either single-theme variations or multi-theme independent outputs.
    """

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
调用前需明确两个独立决策：

【决策一：输出结构】
- 单提示词 + image_count=N：对同一主题生成 N 张风格各异的变体（prompts 只有1条，用户想看多个版本）
- 多提示词：每条 prompt 独立生成一张图，主题完全不同（prompts 有多条，image_count 被忽略）

【决策二：生成锚点（reference_images，必须显式填写）】
核心问题不是"用户有没有说参考图"，而是"用户是否希望输出与某张现有图片保持视觉关联"：
- 用户上传了附件、提到了画布上的某张图、或表达了"基于这个/参考这个/做成类似风格" → 填入对应路径
- 用户纯粹用文字描述一个想象中的画面 → 填 []
两种情况都必须显式填写，不可省略。

【size 选取】
优先遵循用户明确指定的尺寸；未指定时，若 reference_images 非空，先用 query_canvas_element(src=...) 查询参考图的实际尺寸，以保持一致；否则默认 2048x2048。

【prompt 质量】
将用户的简短描述扩写为包含主体、风格、构图、光线、色调的完整描述。描述越模糊，生成结果越随机。
-->
Two decisions required before calling:

[Decision 1: Output structure]
- Single prompt + image_count=N: generates N variations of the same theme (user wants alternatives for one idea)
- Multiple prompts: each prompt produces one independent image with a distinct theme; image_count is ignored

[Decision 2: Generation anchor — reference_images, always required]
The question is not whether the user said "reference image" but whether they want the output to have visual continuity with an existing image:
- Uploaded a file, mentioned a canvas asset, or expressed "based on this / reference this / in this style" → include those paths
- Describing something purely from imagination → pass []
Both cases require explicit reference_images — never omit it.

[Size selection]
Follow any size the user explicitly states. If reference_images is non-empty and no size is stated, use query_canvas_element(src=...) to get the reference image's actual dimensions and match them. Otherwise default to 2048x2048.

[Prompt quality]
Expand brief user descriptions into full prompts covering subject, style, composition, lighting, and color tone. Vague inputs produce vague outputs.
"""

    def __init__(self, **data):
        super().__init__(**data)
        self._generate_tool = GenerateImage()
        self._batch_create_tool = BatchCreateCanvasElements()
        # 导入批量更新工具
        from app.tools.design.tools.batch_update_canvas_elements import BatchUpdateCanvasElements
        self._batch_update_tool = BatchUpdateCanvasElements()

    async def execute(
        self, tool_context: ToolContext, params: GenerateImagesToCanvasParams
    ) -> ToolResult:
        """执行生成图片并创建元素（3阶段流程）

        阶段1: 创建占位符（status="processing"）
        阶段2: 生成图片
        阶段3: 更新占位符为完整元素（status="completed"或"failed"）

        Args:
            tool_context: 工具上下文
            params: 包含生成参数的对象

        Returns:
            ToolResult: 包含创建结果详细信息
        """
        try:
            # reference_images 路径可能来自前端（file_dir 带 / 前缀），统一规范化为相对路径
            if params.reference_images:
                params.reference_images = [p.lstrip("/") for p in params.reference_images]

            # 0. 判断模式并确定生成数量
            prompts_count = len(params.prompts)

            if prompts_count == 1:
                # 单 prompt 模式：使用 image_count
                if params.image_count < 1:
                    return ToolResult.error(
                        "至少需要1张图片",
                        extra_info={"error_type": "design.error_invalid_property"}
                    )
                if params.image_count > 4:
                    return ToolResult.error(
                        "单 prompt 模式下，image_count 最大为 4。如需更多图片，请使用多 prompts 模式。",
                        extra_info={"error_type": "design.error_invalid_property"}
                    )
                actual_count = params.image_count
                mode_desc = f"单 prompt 模式（组图），image_count={actual_count}"
            else:
                # 多 prompts 模式：忽略 image_count
                actual_count = prompts_count
                mode_desc = f"多 prompts 模式（独立图片），共{actual_count}个提示词"
                if params.image_count > 1:
                    logger.info(f"多 prompts 模式下，image_count={params.image_count} 参数被忽略")

            # 1. 确保项目已准备好
            project_path, error_result = await self._ensure_project_ready(
                params.project_path,
                require_magic_project_js=True
            )
            if error_result:
                return error_result

            workspace_path = Path(tool_context.base_dir).resolve()
            logger.debug(f"Workspace path: {workspace_path}")

            # 2. 准备基本信息
            mode = "edit" if params.reference_images else "generate"
            logger.info(
                f"开始生成图片并添加到画布（3阶段流程）: mode={mode}({'图生图' if mode == 'edit' else '文生图'}), "
                f"{mode_desc}, project={params.project_path}"
            )

            # 3. 生成元素名称
            if actual_count == 1:
                element_names = [params.name]
            else:
                element_names = [f"{params.name}_{i+1}" for i in range(actual_count)]
            logger.debug(f"元素名称: {element_names}")

            # 4. 解析尺寸
            width, height = self._parse_size_to_dimensions(params.size)
            logger.debug(f"解析后的图片尺寸: {width}x{height}")

            # ========== 阶段1: 创建占位符 ==========
            logger.info("阶段1: 创建占位符元素")
            element_specs = []
            for idx in range(actual_count):
                element_name = element_names[idx]
                element_spec = ElementCreationSpec(
                    element_type="image",
                    name=element_name,
                    width=float(width),
                    height=float(height),
                    properties={
                        "status": "processing",  # 设置初始状态，processing 状态下不需要 src
                    }
                )
                element_specs.append(element_spec)

            from app.tools.design.tools.batch_create_canvas_elements import BatchCreateCanvasElementsParams

            # 使用 None 作为起始位置，让 batch_create 工具自动计算智能位置（避免覆盖）
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

            created_placeholders = placeholder_result.extra_info.get("created_elements", [])
            if not created_placeholders:
                return ToolResult.error(
                    "未能创建占位符元素",
                    extra_info={"error_type": "design.error_unexpected"}
                )

            logger.info(f"成功创建 {len(created_placeholders)} 个占位符")

            # ========== 阶段2: 生成图片 ==========
            logger.info("阶段2: 生成图片")

            # 准备公共参数
            model = self._get_model_from_config(tool_context)
            clean_name = self._sanitize_filename(params.name)
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")

            images_dir = project_path / "images"
            await asyncio.to_thread(images_dir.mkdir, parents=True, exist_ok=True)

            try:
                relative_output_path = str(images_dir.relative_to(Path.cwd()))
            except ValueError:
                relative_output_path = f"{project_path.name}/images"

            # 根据模式生成图片
            if prompts_count == 1:
                # 单 prompt 模式：调用一次 generate_image，使用 image_count
                generation_results = await self._generate_images_single_prompt(
                    tool_context=tool_context,
                    prompt=params.prompts[0],
                    image_count=params.image_count,
                    mode=mode,
                    model=model,
                    size=params.size,
                    image_name=f"{clean_name}_{timestamp}",
                    output_path=relative_output_path,
                    image_paths=params.reference_images,
                    workspace_path=workspace_path
                )
            else:
                # 多 prompts 模式：并发调用 generate_image
                logger.info(f"多 prompts 模式，将并发生成 {prompts_count} 张图片")
                generation_results = await self._generate_images_multi_prompts(
                    tool_context=tool_context,
                    prompts=params.prompts,
                    mode=mode,
                    model=model,
                    size=params.size,
                    base_name=clean_name,
                    timestamp=timestamp,
                    output_path=relative_output_path,
                    image_paths=params.reference_images,
                    workspace_path=workspace_path
                )
                succeeded_count = sum(1 for r in generation_results if r.is_success)
                logger.info(f"多 prompts 模式完成，成功: {succeeded_count}/{prompts_count}")

            # ========== 阶段3: 更新占位符 ==========
            logger.info("阶段3: 更新占位符元素")

            from app.tools.design.tools.batch_update_canvas_elements import (
                BatchUpdateCanvasElementsParams,
                ElementUpdate
            )

            updates = []
            succeeded_count = sum(1 for r in generation_results if r.is_success)
            failed_count = sum(1 for r in generation_results if r.is_failed)

            logger.info(f"生成结果：成功 {succeeded_count} 张，失败 {failed_count} 张")

            # 根据实际尺寸重新计算位置和尺寸
            # 策略：
            # 1. 保持第一个元素的位置不变（智能计算的起始位置，避免了重叠）
            # 2. 从第一个元素开始，基于实际尺寸重新计算后续元素的水平排列
            # 3. 失败的图片保持占位符尺寸
            recalculated_info = []
            if created_placeholders:
                # 提取第一个占位符的位置作为起始点（这是智能计算的结果）
                first_placeholder = created_placeholders[0]
                start_x = first_placeholder.get("x", 100.0)
                start_y = first_placeholder.get("y", 100.0)

                logger.info(
                    f"使用第一个占位符的智能位置作为起始点: ({start_x}, {start_y})"
                )

                # 基于实际尺寸重新计算水平排列（按索引遍历所有生成结果）
                current_x = start_x
                for result in generation_results:
                    idx = result.index
                    placeholder = created_placeholders[idx]

                    if result.is_success:
                        # 成功生成，使用实际尺寸
                        image_info = result.image_info
                        actual_width = image_info.width
                        actual_height = image_info.height

                        if actual_width is not None and actual_height is not None:
                            recalculated_info.append({
                                "index": idx,
                                "x": current_x,
                                "y": start_y,
                                "width": float(actual_width),
                                "height": float(actual_height)
                            })
                            logger.debug(
                                f"元素 {idx+1} (成功) 重新计算: "
                                f"x={current_x:.0f}, y={start_y:.0f}, "
                                f"width={actual_width:.0f}, height={actual_height:.0f}"
                            )
                            # 下一个元素的 x 坐标 = 当前 x + 当前宽度 + 间距
                            current_x += actual_width + DEFAULT_ELEMENT_SPACING
                        else:
                            # 没有实际尺寸，使用占位符尺寸
                            recalculated_info.append({
                                "index": idx,
                                "x": placeholder.get("x"),
                                "y": placeholder.get("y"),
                                "width": placeholder.get("width"),
                                "height": placeholder.get("height")
                            })
                            logger.warning(
                                f"元素 {idx+1} (成功但无尺寸) 保持占位符布局"
                            )
                            if placeholder.get("width"):
                                current_x += placeholder.get("width", 0) + DEFAULT_ELEMENT_SPACING
                    else:
                        # 生成失败，保持占位符尺寸和位置
                        recalculated_info.append({
                            "index": idx,
                            "x": current_x,
                            "y": start_y,
                            "width": placeholder.get("width"),
                            "height": placeholder.get("height")
                        })
                        logger.debug(
                            f"元素 {idx+1} (失败) 保持占位符尺寸: "
                            f"x={current_x:.0f}, y={start_y:.0f}, "
                            f"width={placeholder.get('width', 0):.0f}, height={placeholder.get('height', 0):.0f}"
                        )
                        if placeholder.get("width"):
                            current_x += placeholder.get("width", 0) + DEFAULT_ELEMENT_SPACING

                logger.info(f"基于实际尺寸重新计算布局完成: {len(recalculated_info)} 个元素")

            # 为每个生成结果创建更新
            for result in generation_results:
                idx = result.index
                placeholder = created_placeholders[idx]

                if result.is_success:
                    # 成功生成，更新为 completed 状态
                    image_info = result.image_info
                    update_properties = {
                        "src": image_info.relative_path,
                        "status": "completed",
                        "generateImageRequest": image_info.generate_request
                    }

                    # 应用重新计算的位置和尺寸
                    recalc = next((info for info in recalculated_info if info["index"] == idx), None)
                    if recalc:
                        if recalc.get("x") is not None:
                            update_properties["x"] = recalc["x"]
                        if recalc.get("y") is not None:
                            update_properties["y"] = recalc["y"]
                        if recalc.get("width") is not None:
                            update_properties["width"] = recalc["width"]
                        if recalc.get("height") is not None:
                            update_properties["height"] = recalc["height"]

                        logger.debug(
                            f"元素 {placeholder['id']} (索引 {idx}) 应用重新计算的布局: "
                            f"x={recalc.get('x', 'N/A'):.0f}, y={recalc.get('y', 'N/A'):.0f}, "
                            f"width={recalc.get('width', 'N/A'):.0f}, height={recalc.get('height', 'N/A'):.0f}"
                        )
                else:
                    # 生成失败，标记为 failed 状态
                    update_properties = {
                        "status": "failed"
                    }

                    # 应用重新计算的位置（保持布局连续性）
                    recalc = next((info for info in recalculated_info if info["index"] == idx), None)
                    if recalc:
                        if recalc.get("x") is not None:
                            update_properties["x"] = recalc["x"]
                        if recalc.get("y") is not None:
                            update_properties["y"] = recalc["y"]

                    logger.debug(f"元素 {placeholder['id']} (索引 {idx}) 标记为失败: {result.error_message}")

                update = ElementUpdate(
                    element_id=placeholder["id"],
                    properties=update_properties
                )
                updates.append(update)

            elements_detail = placeholder_result.extra_info.get("elements", [])

            # 执行批量更新
            if updates:
                try:
                    batch_update_params = BatchUpdateCanvasElementsParams(
                        project_path=params.project_path,
                        updates=updates
                    )

                    update_result = await self._batch_update_tool.execute(tool_context, batch_update_params)

                    if not update_result.ok:
                        logger.warning(f"更新占位符失败: {update_result.content}")
                    else:
                        elements_detail = update_result.extra_info.get("elements", elements_detail)

                    # 补偿机制：占位符可能在 Phase 2 等待期间被外部删除（如前端覆盖写入）。
                    # 对于图片已生成成功但占位符 update 失败的元素，重新 create 回画布。
                    compensated = await self._compensate_lost_placeholders(
                        tool_context=tool_context,
                        project_path=params.project_path,
                        generation_results=generation_results,
                        created_placeholders=created_placeholders,
                        recalculated_info=recalculated_info,
                        update_result=update_result,
                    )
                    if compensated:
                        # 合并而非覆盖：update 成功的 + 补偿创建的
                        compensated_elements = compensated.extra_info.get("elements", [])
                        elements_detail = elements_detail + compensated_elements

                except Exception as update_error:
                    logger.error(f"批量更新阶段异常: {update_error}", exc_info=True)

            logger.info(f"完成！成功: {succeeded_count}, 失败: {failed_count}")

            # 全部生图失败：对大模型来说这是失败，占位符只是内部实现细节
            if succeeded_count == 0 and len(created_placeholders) > 0:
                failed_elements_desc = "; ".join(
                    f"{elem['name']} (id: {elem['id']})"
                    for elem in created_placeholders
                )
                error_content = (
                    f"Image generation failed: all {len(created_placeholders)} image(s) failed to generate. "
                    f"Failed placeholder elements were created in canvas with status=failed: {failed_elements_desc}"
                )
                logger.warning(f"所有图片生成失败，返回错误结果: {error_content}")
                return ToolResult.error(
                    error_content,
                    extra_info={
                        "error_type": "design.error_unexpected",
                        "project_path": params.project_path,
                        "total_count": len(created_placeholders),
                        "succeeded_count": 0,
                        "failed_count": failed_count,
                        "created_elements": created_placeholders,
                    }
                )

            # 生成结果信息（至少有一张图成功）
            result_content = self._generate_result_content(
                params,
                created_placeholders,
                succeeded_count,
                failed_count
            )

            return ToolResult(
                content=result_content,
                data={
                    "created_elements": created_placeholders,
                    "succeeded_count": succeeded_count,
                    "failed_count": failed_count
                },
                extra_info={
                    "project_path": params.project_path,
                    "total_count": len(created_placeholders),
                    "succeeded_count": succeeded_count,
                    "failed_count": failed_count,
                    "created_elements": created_placeholders,
                    "elements": elements_detail,
                }
            )

        except Exception as e:
            logger.exception(f"生成图片到画布失败: {e!s}")
            return ToolResult.error(
                f"生成图片到画布失败: {e!s}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    async def _compensate_lost_placeholders(
        self,
        tool_context: ToolContext,
        project_path: str,
        generation_results: list,
        created_placeholders: list,
        recalculated_info: list,
        update_result: ToolResult,
    ) -> Optional[ToolResult]:
        """占位符丢失补偿：Phase 2 期间占位符可能被外部写入覆盖（如前端保存旧版画布）。
        对于图片已生成成功但占位符 update 失败的元素，重新 create 回画布。
        返回补偿 create 的 ToolResult，如果无需补偿则返回 None。"""
        errors = update_result.extra_info.get("errors", []) if update_result.extra_info else []
        if not errors:
            return None

        failed_element_ids = {item["element_id"] for item in errors}

        # 筛选：图片生成成功 + 对应占位符 update 失败
        specs_to_recreate = []
        for result in generation_results:
            if not result.is_success:
                continue
            placeholder = created_placeholders[result.index]
            if placeholder["id"] not in failed_element_ids:
                continue

            image_info = result.image_info
            recalc = next(
                (info for info in recalculated_info if info["index"] == result.index),
                None,
            )

            spec = ElementCreationSpec(
                element_type="image",
                name=placeholder.get("name", f"compensated-{result.index}"),
                width=recalc["width"] if recalc else image_info.width,
                height=recalc["height"] if recalc else image_info.height,
                x=recalc["x"] if recalc else None,
                y=recalc["y"] if recalc else None,
                properties={
                    "src": image_info.relative_path,
                    "status": "completed",
                    "generateImageRequest": image_info.generate_request,
                },
            )
            specs_to_recreate.append(spec)

        if not specs_to_recreate:
            return None

        logger.info(
            f"占位符补偿：{len(specs_to_recreate)} 个占位符在 Phase 2 期间丢失，"
            f"重新创建元素（图片文件已存在，无需重新生成）"
        )

        try:
            from app.tools.design.tools.batch_create_canvas_elements import (
                BatchCreateCanvasElementsParams,
            )
            compensate_params = BatchCreateCanvasElementsParams(
                project_path=project_path,
                elements=specs_to_recreate,
            )
            compensate_result = await self._batch_create_tool.execute(
                tool_context, compensate_params
            )
            if compensate_result.ok:
                logger.info(f"占位符补偿成功：{len(specs_to_recreate)} 个元素已重新创建")
                return compensate_result
            else:
                logger.error(f"占位符补偿失败: {compensate_result.content}")
                return None
        except Exception as e:
            logger.error(f"占位符补偿异常: {e}", exc_info=True)
            return None

    async def _generate_images_single_prompt(
        self,
        tool_context: ToolContext,
        prompt: str,
        image_count: int,
        mode: str,
        model: str,
        size: str,
        image_name: str,
        output_path: str,
        image_paths: List[str],
        workspace_path: Path
    ) -> List[ImageGenerationResult]:
        """单 prompt 模式生成图片（失败自动重试一次）

        Args:
            tool_context: 工具上下文
            prompt: 提示词
            image_count: 生成数量
            mode: 生成模式
            model: 模型名称
            size: 图片尺寸
            image_name: 图片名称
            output_path: 输出路径
            image_paths: 参考图片路径
            workspace_path: workspace 根路径

        Returns:
            图片生成结果列表，按索引顺序排列
        """
        results = []

        # 尝试生成（最多2次：首次 + 1次重试）
        for attempt in range(2):
            is_retry = attempt > 0
            attempt_desc = f"重试 {attempt}/{1}" if is_retry else "首次尝试"

            try:
                if is_retry:
                    logger.info(f"单 prompt 模式开始重试生成（image_count={image_count}）")
                    # 重试前添加短暂延迟（1-2秒）
                    retry_delay = random.uniform(1.0, 2.0)
                    logger.debug(f"重试前延迟: {retry_delay:.2f}秒")
                    await asyncio.sleep(retry_delay)

                # 重试时在文件名后加上 retry 标记
                actual_image_name = image_name
                if is_retry:
                    actual_image_name = f"{image_name}_retry{attempt}"

                generate_params = GenerateImageParams(
                    prompt=prompt,
                    mode=mode,
                    model=model,
                    size=size,
                    image_count=image_count,
                    image_name=actual_image_name,
                    output_path=output_path,
                    image_paths=image_paths,
                    override=False
                )

                generation_result = await self._generate_tool.execute_purely(tool_context, generate_params, skip_limit_check=True)

                if generation_result.ok:
                    extracted = await self._extract_generated_images(
                        generation_result,
                        workspace_path,
                        generate_params
                    )

                    # 检查是否有成功的图片
                    if extracted.has_success:
                        success_msg = f"单 prompt 模式生成成功（image_count={image_count}）"
                        if is_retry:
                            success_msg += f" (重试成功)"
                        logger.info(success_msg)

                        # 为成功的图片创建结果
                        for idx, img_info in enumerate(extracted.images):
                            results.append(ImageGenerationResult(
                                index=idx,
                                success=True,
                                image_info=img_info
                            ))

                        # 为校验失败的图片创建失败结果（从成功数量之后开始计数）
                        for idx, error in enumerate(extracted.errors, start=len(extracted.images)):
                            if idx < image_count:
                                results.append(ImageGenerationResult(
                                    index=idx,
                                    success=False,
                                    error_message=error
                                ))

                        # 有成功的图片，返回结果
                        return results
                    else:
                        # 没有成功的图片（全部校验失败）
                        error_msg = f"单 prompt 模式生成失败 ({attempt_desc}): 所有图片校验失败"
                        logger.warning(error_msg)

                        # 如果不是最后一次尝试，继续重试
                        if attempt < 1:
                            continue

                        # 最后一次尝试也失败，返回失败结果
                        # 注意：extracted.errors 可能为空（generate_image 返回 0 张图但无校验错误），
                        # 此时必须按 image_count 范围补全失败结果，否则 results 为空导致计数异常
                        for idx in range(image_count):
                            error = extracted.errors[idx] if idx < len(extracted.errors) else "图片生成失败：未返回图片文件"
                            results.append(ImageGenerationResult(
                                index=idx,
                                success=False,
                                error_message=error
                            ))
                        return results
                else:
                    # 如果整体失败
                    error_msg = f"单 prompt 模式生成失败 ({attempt_desc}): {generation_result.content}"
                    logger.warning(error_msg)

                    # 如果不是最后一次尝试，继续重试
                    if attempt < 1:
                        continue

                    # 最后一次尝试也失败，为所有索引创建失败结果
                    for idx in range(image_count):
                        results.append(ImageGenerationResult(
                            index=idx,
                            success=False,
                            error_message=error_msg
                        ))
                    return results

            except Exception as gen_error:
                error_msg = f"单 prompt 模式生成异常 ({attempt_desc}): {gen_error!s}"
                logger.error(error_msg, exc_info=True)

                # 如果不是最后一次尝试，继续重试
                if attempt < 1:
                    continue

                # 最后一次尝试也失败，为所有索引创建失败结果
                for idx in range(image_count):
                    results.append(ImageGenerationResult(
                        index=idx,
                        success=False,
                        error_message=error_msg
                    ))
                return results

        return results

    async def _generate_images_multi_prompts(
        self,
        tool_context: ToolContext,
        prompts: List[str],
        mode: str,
        model: str,
        size: str,
        base_name: str,
        timestamp: str,
        output_path: str,
        image_paths: List[str],
        workspace_path: Path
    ) -> List[ImageGenerationResult]:
        """多 prompts 模式并发生成图片（失败自动重试一次）

        Args:
            tool_context: 工具上下文
            prompts: 提示词列表
            mode: 生成模式
            model: 模型名称
            size: 图片尺寸
            base_name: 基础名称
            timestamp: 时间戳
            output_path: 输出路径
            image_paths: 参考图片路径
            workspace_path: workspace 根路径

        Returns:
            图片生成结果列表，按索引顺序排列
        """
        async def generate_single_with_retry(idx: int, prompt: str) -> ImageGenerationResult:
            """生成单张图片的异步函数（失败自动重试一次）

            Returns:
                图片生成结果
            """
            # 添加随机抖动延迟，避免高并发（0-2秒随机延迟）
            # 第一个任务不延迟，后续任务添加递增的基础延迟 + 随机抖动
            if idx > 0:
                # 基础延迟：每个任务递增 0.1 秒
                base_delay = idx * 0.1
                # 随机抖动：0-1 秒
                jitter = random.uniform(0, 1.0)
                total_delay = min(base_delay + jitter, 3.0)  # 最大延迟 3 秒
                logger.debug(f"第 {idx+1}/{len(prompts)} 张图片添加抖动延迟: {total_delay:.2f}秒")
                await asyncio.sleep(total_delay)

            # 尝试生成（最多2次：首次 + 1次重试）
            for attempt in range(2):
                is_retry = attempt > 0
                attempt_desc = f"重试 {attempt}/{1}" if is_retry else "首次尝试"

                try:
                    if is_retry:
                        logger.info(f"第 {idx+1}/{len(prompts)} 张图片开始重试生成")
                        # 重试前添加短暂延迟（0.5-1.5秒）
                        retry_delay = random.uniform(0.5, 1.5)
                        logger.debug(f"重试前延迟: {retry_delay:.2f}秒")
                        await asyncio.sleep(retry_delay)

                    image_name = f"{base_name}_{idx+1}_{timestamp}"
                    if is_retry:
                        # 重试时在文件名后加上 retry 标记
                        image_name = f"{base_name}_{idx+1}_{timestamp}_retry{attempt}"

                    generate_params = GenerateImageParams(
                        prompt=prompt,
                        mode=mode,
                        model=model,
                        size=size,
                        image_count=1,
                        image_name=image_name,
                        output_path=output_path,
                        image_paths=image_paths,
                        override=False
                    )

                    generation_result = await self._generate_tool.execute_purely(tool_context, generate_params, skip_limit_check=True)

                    if generation_result.ok:
                        extracted = await self._extract_generated_images(
                            generation_result,
                            workspace_path,
                            generate_params
                        )

                        # 检查是否成功生成图片（image_count=1，所以只有一张图片）
                        if extracted.has_success:
                            # 生成成功，取唯一的图片
                            success_msg = f"第 {idx+1}/{len(prompts)} 张图片生成成功"
                            if is_retry:
                                success_msg += f" (重试成功)"
                            logger.info(success_msg)

                            return ImageGenerationResult(
                                index=idx,
                                success=True,
                                image_info=extracted.images[0]
                            )
                        else:
                            # 生成失败（校验失败或其他原因）
                            error_msg = extracted.errors[0] if extracted.errors else "图片文件校验失败"
                            full_error_msg = f"第 {idx+1} 张图片生成失败 ({attempt_desc}): {error_msg}"
                            logger.warning(full_error_msg)

                            # 如果不是最后一次尝试，继续重试
                            if attempt < 1:
                                continue

                            return ImageGenerationResult(
                                index=idx,
                                success=False,
                                error_message=full_error_msg
                            )
                    else:
                        error_msg = f"第 {idx+1} 张图片生成失败 ({attempt_desc}): {generation_result.content}"
                        logger.warning(error_msg)

                        # 如果不是最后一次尝试，继续重试
                        if attempt < 1:
                            continue

                        return ImageGenerationResult(
                            index=idx,
                            success=False,
                            error_message=error_msg
                        )

                except Exception as gen_error:
                    error_msg = f"第 {idx+1} 张图片生成异常 ({attempt_desc}): {gen_error!s}"
                    logger.error(error_msg, exc_info=True)

                    # 如果不是最后一次尝试，继续重试
                    if attempt < 1:
                        continue

                    return ImageGenerationResult(
                        index=idx,
                        success=False,
                        error_message=error_msg
                    )

        # 并发执行所有生成任务
        tasks = [generate_single_with_retry(idx, prompt) for idx, prompt in enumerate(prompts)]
        results = await asyncio.gather(*tasks)

        # 返回结果列表（已按索引顺序）
        return list(results)

    def _get_model_from_config(self, tool_context: Optional[ToolContext] = None) -> str:
        """获取图片生成模型

        优先从 agent context 获取（含回落到 dynamic_config.yaml），
        均未配置时使用默认模型。
        """
        from app.core.context.agent_context import AgentContext
        default_model = "doubao-seedream-4-0-250828"

        try:
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext) if tool_context else None
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
                            logger.info(f"从 dynamic_config.yaml 的 image_model.model_id 获取模型: {model}")
                            return model
        except Exception as e:
            logger.debug(f"获取图片模型失败，使用默认模型: {e}")

        logger.debug(f"使用默认模型: {default_model}")
        return default_model

    # noinspection PyMethodMayBeStatic
    def _parse_size_to_dimensions(self, size: str) -> tuple[int, int]:
        """解析 size 参数为宽高尺寸

        Args:
            size: 尺寸参数，格式：'宽度x高度'，例如 '1024x1024', '2048x2048'

        Returns:
            (width, height) 元组
        """
        # 固定尺寸格式：直接解析
        if 'x' in size:
            parts = size.split('x')
            if len(parts) == 2:
                try:
                    width = int(parts[0])
                    height = int(parts[1])
                    logger.debug(f"解析固定尺寸: {size} -> {width}x{height}")
                    return width, height
                except ValueError:
                    logger.warning(f"无法解析尺寸参数 '{size}'，使用默认值 1024x1024")
                    return 1024, 1024

        # 默认返回 1024x1024
        logger.warning(f"无法解析尺寸参数 '{size}'，使用默认值 1024x1024")
        return 1024, 1024

    async def _extract_generated_images(
        self,
        generation_result: ToolResult,
        workspace_path: Path,
        generate_params: GenerateImageParams
    ) -> ExtractedImagesResult:
        """从 generate_image 结果提取图片信息并组装 generateImageRequest

        Args:
            generation_result: generate_image 的返回结果
            workspace_path: workspace 根路径（用于计算相对路径）
            generate_params: 调用 generate_image 时使用的参数

        Returns:
            ExtractedImagesResult: 包含成功的图片列表和失败的错误信息列表
        """
        images = []
        errors = []

        # generate_image 的返回结构在 extra_info 中
        extra_info = generation_result.extra_info or {}

        # generate_image 返回的是 saved_images 字段（绝对路径列表）
        image_list = extra_info.get("saved_images", [])

        # generate_image 返回的 saved_images 是绝对路径列表
        for img_path in image_list:
            # 1. 校验图片文件完整性
            is_valid, error_msg = await self._validate_image_file(img_path)
            if not is_valid:
                logger.warning(f"图片文件校验失败: {error_msg}")
                errors.append(f"图片校验失败: {Path(img_path).name} - {error_msg}")
                continue  # 跳过该图片，继续处理下一张

            # 2. 转换为相对于 workspace 的路径
            relative_path = self._make_relative_to_workspace(img_path, workspace_path)

            # 3. 从实际图片文件中读取真实尺寸
            dimensions = self._read_image_dimensions(img_path)

            # 4. 从文件名提取 image_id（去掉扩展名）
            image_id = Path(img_path).stem

            # 5. 确定 size 字段：使用实际尺寸（如果读取成功）
            if dimensions.is_valid:
                # 使用实际尺寸
                size_value = dimensions.size_string
                logger.debug(
                    f"从文件读取图片尺寸: {Path(img_path).name} -> {size_value}"
                )
            else:
                # 无法读取实际尺寸时，使用用户传入的参数值
                size_value = generate_params.size
                logger.warning(
                    f"无法读取图片尺寸: {img_path}，使用参数值 {size_value}"
                )

            # 组装 generateImageRequest（记录生成时的参数）
            generate_request = {
                "model_id": generate_params.model,
                "prompt": generate_params.prompt,
                "size": size_value,  # 使用实际尺寸
                "image_id": image_id,
                "mode": generate_params.mode,
            }

            # 如果是图生图模式，添加参考图片信息
            if generate_params.mode == "edit" and generate_params.image_paths:
                generate_request["reference_images"] = generate_params.image_paths

            # 创建图片信息对象
            image_info = GeneratedImageInfo(
                relative_path=relative_path,
                width=dimensions.width,
                height=dimensions.height,
                generate_request=generate_request
            )

            images.append(image_info)

        return ExtractedImagesResult(images=images, errors=errors)

    # noinspection PyMethodMayBeStatic
    def _read_image_dimensions(self, image_path: str) -> ImageDimensions:
        """从图片文件读取实际尺寸

        Args:
            image_path: 图片的绝对路径或相对路径

        Returns:
            ImageDimensions: 图片尺寸信息，读取失败时 width 和 height 为 None
        """
        try:
            from PIL import Image

            path_obj = Path(image_path)
            if not path_obj.exists():
                logger.warning(f"图片文件不存在: {image_path}")
                return ImageDimensions(width=None, height=None)

            with Image.open(path_obj) as img:
                width, height = img.size
                return ImageDimensions(width=float(width), height=float(height))

        except Exception as e:
            logger.warning(f"读取图片尺寸失败 {image_path}: {e}", exc_info=True)
            return ImageDimensions(width=None, height=None)

    # noinspection PyMethodMayBeStatic
    def _make_relative_to_workspace(self, absolute_path: str, workspace_path: Path) -> str:
        """转换为相对于 workspace 的路径

        Args:
            absolute_path: 绝对路径（如 generate_image 返回的路径）
            workspace_path: workspace 根路径

        Returns:
            相对于 workspace 的路径（如 "project-name/images/xxx.jpg"）
        """
        path_obj = Path(absolute_path)

        try:
            # 尝试计算相对于 workspace 的路径
            relative = path_obj.relative_to(workspace_path)
            return str(relative)
        except ValueError:
            # 如果不在 workspace 下，返回文件名
            logger.warning(f"图片路径 {absolute_path} 不在 workspace {workspace_path} 下，仅使用文件名")
            return path_obj.name

    # noinspection PyMethodMayBeStatic
    def _generate_result_content(
        self,
        params: GenerateImagesToCanvasParams,
        created_placeholders: List[Dict],
        succeeded_count: int,
        failed_count: int
    ) -> str:
        """生成结构化的结果内容（3阶段流程）

        Args:
            params: 工具参数
            created_placeholders: 创建的占位符元素列表
            succeeded_count: 成功生成的数量
            failed_count: 失败的数量

        Returns:
            格式化的结果内容
        """
        total = len(created_placeholders)

        # 此处仅在 succeeded_count > 0 时调用，部分失败时给出明确提示
        warning_line = f"\n- Warning: {failed_count}/{total} images failed to generate" if failed_count > 0 else ""

        result = f"""Generated and Added to Canvas:
- Success: {succeeded_count} images generated
- Failed: {failed_count} images{warning_line}
- Project: {params.project_path}"""

        if created_placeholders:
            result += "\n\nCreated Elements:"
            for elem in created_placeholders:
                result += f"\n- {elem['name']} (id: {elem['id']}) at ({elem['x']:.0f}, {elem['y']:.0f})"

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments:
            return i18n.translate("generate_images_to_canvas.exception", category="tool.messages")

        image_count = arguments.get("image_count", 1)
        name = arguments.get("name", "图片")

        if not result.ok:
            return i18n.translate("generate_images_to_canvas.exception", category="tool.messages")

        # 检查实际的生成结果
        extra_info = result.extra_info or {}
        succeeded_count = extra_info.get("succeeded_count", 0)
        failed_count = extra_info.get("failed_count", 0)
        total_count = extra_info.get("total_count", 0)

        # 全部失败
        if succeeded_count == 0 and total_count > 0:
            return "AI 图片生成失败，请查看详细信息"

        # 部分失败
        if failed_count > 0 and succeeded_count > 0:
            return f"AI 图片部分生成成功（成功 {succeeded_count}/{total_count}）"

        # 全部成功
        if image_count == 1:
            return i18n.translate("generate_images_to_canvas.success_single", category="tool.messages", name=name)
        else:
            return i18n.translate("generate_images_to_canvas.success_multiple", category="tool.messages", image_count=image_count,
                name=name)

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: Dict[str, Any] = None
    ) -> Dict:
        """获取工具调用后的友好操作和备注

        Args:
            tool_name: 工具名称
            tool_context: 工具上下文
            result: 工具执行结果
            execution_time: 执行时间
            arguments: 执行参数

        Returns:
            Dict: 包含 action 和 remark 的字典
        """
        # 使用基类的通用错误处理方法
        return self._handle_design_tool_error(
            result,
            default_action_code="generate_images_to_canvas",
            default_success_message_code="generate_images_to_canvas.exception"
        ) if not result.ok else {
            "action": i18n.translate("generate_images_to_canvas", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        """生成工具详情，用于前端展示

        Args:
            tool_context: 工具上下文
            result: 工具结果
            arguments: 工具参数

        Returns:
            Optional[ToolDetail]: 工具详情
        """
        if not result.ok:
            return None

        try:
            from app.core.entity.message.server_message import DesignElementContent

            # 从 extra_info 获取数据
            extra_info = result.extra_info or {}
            project_path = extra_info.get("project_path", "")
            elements = extra_info.get("elements", [])

            return ToolDetail(
                type=DisplayType.DESIGN,
                data=DesignElementContent(
                    type="element",
                    project_path=project_path,
                    elements=elements
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None
