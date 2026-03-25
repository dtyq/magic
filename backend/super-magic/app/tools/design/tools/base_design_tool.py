"""设计模式工具基类

为所有设计相关工具提供通用功能。
"""

from app.i18n import i18n
import asyncio
import re
from pathlib import Path
from typing import Any, Dict, Generic, Optional, Tuple, TypeVar

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams
from app.tools.design.manager.canvas_manager import CanvasManager
from app.tools.design.utils.magic_project_design_parser import ImageElement
from app.tools.workspace_tool import WorkspaceTool

logger = get_logger(__name__)

# 参数类型变量
T = TypeVar('T', bound=BaseToolParams)


class BaseDesignTool(AbstractFileTool[T], WorkspaceTool[T], Generic[T]):
    """设计模式工具基类

    提供的公共方法包括：
    - 项目路径验证
    - magic.project.js 存在性检查
    - 项目名称提取
    - 路径操作

    所有设计模式工具都应继承此类。
    """

    # magic.project.js 文件名常量
    MAGIC_PROJECT_JS = "magic.project.js"

    # images 文件夹名常量
    IMAGES_FOLDER = "images"

    async def _get_project_path(self, project_path_str: str) -> Tuple[Optional[Path], Optional[str]]:
        """获取安全的项目路径并验证

        Args:
            project_path_str: 相对项目路径字符串

        Returns:
            (project_path, error_message) 元组
            - 成功时: (Path 对象, None)
            - 失败时: (None, 错误消息)
        """
        project_path = self.resolve_path(project_path_str)
        return project_path, None

    async def _validate_project_exists(self, project_path: Path) -> Optional[str]:
        """验证项目文件夹是否存在

        Args:
            project_path: 项目文件夹路径

        Returns:
            项目不存在时返回错误消息，存在时返回 None
        """
        # 尝试获取相对路径，如果失败则使用绝对路径
        try:
            display_path = project_path.relative_to(Path.cwd())
        except ValueError:
            display_path = project_path

        if not await asyncio.to_thread(project_path.exists):
            return f"Project folder does not exist: {display_path}"

        if not await asyncio.to_thread(project_path.is_dir):
            return f"Path is not a directory: {display_path}"

        return None

    async def _validate_magic_project_js_exists(
        self,
        project_path: Path,
        suggest_create_command: bool = True
    ) -> Optional[str]:
        """验证项目文件夹中是否存在 magic.project.js

        Args:
            project_path: 项目文件夹路径
            suggest_create_command: 是否建议使用 create_design_project 命令

        Returns:
            文件不存在时返回错误消息，存在时返回 None
        """
        config_file = self._get_magic_project_js_path(project_path)

        if not await asyncio.to_thread(config_file.exists):
            # 尝试获取相对路径，如果失败则使用绝对路径
            try:
                display_path = project_path.relative_to(Path.cwd())
            except ValueError:
                display_path = project_path

            error_msg = f"{self.MAGIC_PROJECT_JS} does not exist in {display_path}."

            if suggest_create_command:
                error_msg += f" Please create the project first using create_design_project tool."

            return error_msg

        return None

    def _get_magic_project_js_path(self, project_path: Path) -> Path:
        """获取 magic.project.js 文件路径

        Args:
            project_path: 项目文件夹路径

        Returns:
            magic.project.js 的路径
        """
        return project_path / self.MAGIC_PROJECT_JS

    def _get_images_folder_path(self, project_path: Path) -> Path:
        """获取 images 文件夹路径

        Args:
            project_path: 项目文件夹路径

        Returns:
            images 文件夹的路径
        """
        return project_path / self.IMAGES_FOLDER

    def _get_project_name(self, project_path: Path) -> str:
        """从路径中提取项目名称

        Args:
            project_path: 项目文件夹路径

        Returns:
            项目名称（路径的最后一部分）

        Examples:
            - /path/to/my-project -> "my-project"
            - /path/to/designs/poster -> "poster"
        """
        return project_path.name

    async def _ensure_project_ready(
        self,
        project_path_str: str,
        require_magic_project_js: bool = True
    ) -> Tuple[Optional[Path], Optional[ToolResult]]:
        """确保项目已准备好进行操作

        这是一个便捷方法，组合了以下步骤：
        1. 获取安全的项目路径
        2. 验证项目是否存在
        3. 验证 magic.project.js 是否存在（可选）

        Args:
            project_path_str: 相对项目路径字符串
            require_magic_project_js: 是否要求 magic.project.js 必须存在

        Returns:
            (project_path, error_result) 元组
            - 成功时: (Path 对象, None)
            - 失败时: (None, 包含错误的 ToolResult，带有 error_type)

        Usage:
            project_path, error_result = await self._ensure_project_ready(params.project_path)
            if error_result:
                return error_result
            # 现在 project_path 保证是有效的
        """
        # 步骤 1: 获取安全路径
        project_path, error = await self._get_project_path(project_path_str)
        if error:
            return None, ToolResult.error(
                error,
                extra_info={"error_type": "design.error_project_not_found"}
            )

        # 步骤 2: 验证项目是否存在
        error = await self._validate_project_exists(project_path)
        if error:
            return None, ToolResult.error(
                error,
                extra_info={"error_type": "design.error_project_not_found"}
            )

        # 步骤 3: 验证 magic.project.js 是否存在（如果需要）
        if require_magic_project_js:
            error = await self._validate_magic_project_js_exists(project_path)
            if error:
                return None, ToolResult.error(
                    error,
                    extra_info={"error_type": "design.error_magic_project_js_not_found"}
                )

        return project_path, None

    async def _ensure_project_ready_with_retry(
        self,
        project_path_str: str,
        require_magic_project_js: bool = True,
        max_retries: int = 3,
        retry_delay: float = 0.2
    ) -> Tuple[Optional[Path], Optional[ToolResult]]:
        """确保项目已准备好进行操作（带重试机制）

        这是 _ensure_project_ready 的增强版本，添加了重试机制以处理文件系统延迟
        （如 TOS 同步延迟）等临时问题。

        重试策略：
        1. 对于路径安全性检查失败 -> 不重试（这是配置错误，重试无意义）
        2. 对于项目文件夹不存在 -> 不重试（项目真的不存在）
        3. 对于 magic.project.js 不存在 -> 重试（可能是文件系统延迟）

        Args:
            project_path_str: 相对项目路径字符串
            require_magic_project_js: 是否要求 magic.project.js 必须存在
            max_retries: 最大重试次数，默认3次
            retry_delay: 重试延迟（秒），默认0.2秒

        Returns:
            (project_path, error_result) 元组
            - 成功时: (Path 对象, None)
            - 失败时: (None, 包含错误的 ToolResult，带有 error_type)

        Usage:
            project_path, error_result = await self._ensure_project_ready_with_retry(params.project_path)
            if error_result:
                return error_result
            # 现在 project_path 保证是有效的
        """
        # 步骤 1: 获取安全路径（不重试，配置错误）
        project_path, error = await self._get_project_path(project_path_str)
        if error:
            return None, ToolResult.error(
                error,
                extra_info={"error_type": "design.error_project_not_found"}
            )

        # 步骤 2: 验证项目是否存在（不重试，项目真的不存在）
        error = await self._validate_project_exists(project_path)
        if error:
            return None, ToolResult.error(
                error,
                extra_info={"error_type": "design.error_project_not_found"}
            )

        # 步骤 3: 验证 magic.project.js 是否存在（如果需要）-> 带重试机制
        if require_magic_project_js:
            for attempt in range(max_retries):
                error = await self._validate_magic_project_js_exists(project_path)
                if error is None:
                    # 文件存在，验证成功
                    break

                if attempt < max_retries - 1:
                    # 还有重试机会，等待后重试
                    logger.debug(
                        f"magic.project.js 不存在 (尝试 {attempt + 1}/{max_retries}): {project_path}, "
                        f"将在 {retry_delay}s 后重试"
                    )
                    await asyncio.sleep(retry_delay)
                else:
                    # 最后一次尝试也失败了，返回错误
                    logger.warning(
                        f"magic.project.js 不存在 (已重试 {max_retries} 次): {project_path}"
                    )
                    return None, ToolResult.error(
                        error,
                        extra_info={"error_type": "design.error_magic_project_js_not_found"}
                    )

        return project_path, None

    async def _read_image_dimensions_with_retry(
        self,
        tool_context: ToolContext,
        src: str,
        max_retries: int = 3,
        retry_delay: float = 0.1
    ) -> Tuple[Optional[float], Optional[float]]:
        """读取图片尺寸（带重试机制）

        统一的图片尺寸读取方法，处理文件系统延迟和临时锁定问题。

        Args:
            tool_context: 工具上下文
            src: 图片相对路径
            max_retries: 最大重试次数，默认3次
            retry_delay: 重试延迟（秒），默认0.1秒

        Returns:
            (width, height) 元组，失败时返回 (None, None)

        Note:
            - 此方法不会抛出异常，失败时返回 (None, None)
            - 自动处理文件系统延迟（如刚创建的文件）
            - 使用异步重试机制，不阻塞其他操作
        """
        from app.tools.design.utils.canvas_image_utils import get_image_info

        for attempt in range(max_retries):
            try:
                workspace_path = Path(tool_context.base_dir)
                width, height = await get_image_info(src, workspace_path)
                return float(width), float(height)

            except Exception as e:
                if attempt < max_retries - 1:
                    # 还有重试机会，等待后重试
                    logger.debug(
                        f"读取图片尺寸失败 (尝试 {attempt + 1}/{max_retries}): {src}, "
                        f"错误: {e}, 将在 {retry_delay}s 后重试"
                    )
                    await asyncio.sleep(retry_delay)
                else:
                    # 最后一次尝试也失败了
                    logger.warning(
                        f"无法从图片文件读取尺寸 {src} (已重试 {max_retries} 次): {e}"
                    )

        return None, None

    async def _validate_image_file(self, image_path: str) -> Tuple[bool, str]:
        """校验图片文件是否有效（异步）

        检查图片文件的基本有效性（存在性和大小），用于在生成或下载图片后验证文件完整性。

        Args:
            image_path: 图片的绝对路径

        Returns:
            (是否有效, 错误信息) 元组
            - 成功时: (True, "")
            - 失败时: (False, "具体错误信息")

        Note:
            - 仅检查文件存在性和大小，不检查图片格式
            - 使用异步文件操作，不阻塞其他任务
            - 常用于生图、下载图片后的校验
        """
        try:
            path_obj = Path(image_path)

            # 异步检查文件是否存在
            exists = await asyncio.to_thread(path_obj.exists)
            if not exists:
                return False, f"图片文件不存在: {image_path}"

            # 异步检查文件大小
            stat_result = await asyncio.to_thread(path_obj.stat)
            file_size = stat_result.st_size
            if file_size == 0:
                return False, f"图片文件大小为 0: {image_path}"

            logger.debug(f"图片文件校验通过: {path_obj.name} ({file_size} 字节)")
            return True, ""

        except Exception as e:
            return False, f"校验图片文件时发生异常: {image_path} - {e}"

    async def _perform_visual_understanding(
        self,
        element: ImageElement,
        project_path: Path
    ) -> None:
        """对图片元素执行视觉理解并更新元素属性

        此方法为图片元素自动执行视觉理解分析，并将结果保存到元素的 visualUnderstanding 属性。
        使用缓存机制避免重复分析，支持自动重试。

        Args:
            element: 图片元素对象（会被修改，添加 visualUnderstanding 属性）
            project_path: 项目路径（用于解析相对路径）

        Note:
            - 如果元素没有 src 属性，会跳过分析
            - 分析失败不会抛出异常，只记录警告日志
            - 使用缓存机制，相同图片不会重复分析
        """
        if not hasattr(element, 'src') or not element.src:
            logger.info("图片元素没有 src，跳过视觉理解")
            return

        try:
            logger.info(f"开始对图片元素执行视觉理解: {element.src}")

            # 延迟导入避免循环依赖
            from app.tools.design.utils.canvas_image_visual_understanding import analyze_image_for_canvas

            # 调用视觉理解工具
            visual_understanding = await analyze_image_for_canvas(
                image_path=element.src,
                include_detailed_analysis=True,
                use_cache=True,
                max_retries=1
            )

            # 将视觉理解结果保存到元素属性
            element.visualUnderstanding = visual_understanding

            logger.info(f"视觉理解完成: {element.src}, 摘要: {visual_understanding.summary[:50]}...")

        except Exception as e:
            # 视觉理解失败不应阻止元素操作，只记录警告
            logger.warning(f"图片元素视觉理解失败 {element.src}: {e}")

    @staticmethod
    def _sanitize_filename(name: str, max_length: int = 200) -> str:
        """清理文件名中的特殊字符

        移除或替换文件系统中不允许的字符，确保文件名安全。

        Args:
            name: 原始文件名
            max_length: 最大文件名长度，默认200（为时间戳和扩展名预留空间）

        Returns:
            清理后的文件名

        Examples:
            >>> BaseDesignTool._sanitize_filename("Product/Design:Version<1>")
            'Product_Design_Version_1_'
            >>> BaseDesignTool._sanitize_filename("宫崎骏漫画")
            '宫崎骏漫画'
        """
        # 替换文件系统不允许的字符为下划线
        # Windows: < > : " / \ | ? *
        # Unix: /
        # 同时移除控制字符
        sanitized = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name)

        # 移除首尾空格和点（避免隐藏文件或路径问题）
        sanitized = sanitized.strip('. ')

        # 如果清理后为空，使用默认名称
        if not sanitized:
            sanitized = "image"

        # 限制长度（为时间戳和扩展名预留空间）
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length]

        return sanitized

    async def _safe_save_canvas(
        self,
        manager: CanvasManager,
        operation_name: str = "operation"
    ) -> Optional[ToolResult]:
        """保存画布配置

        画布场景下始终覆盖写入，不做文件变更检测。

        Args:
            manager: CanvasManager 实例
            operation_name: 操作名称，用于日志（如 "create element", "update element"）

        Returns:
            None（保存成功），其他异常由调用方的 except 捕获
        """
        await manager.save()
        return None

    def _handle_design_tool_error(
        self,
        result: ToolResult,
        default_action_code: str,
        default_success_message_code: str
    ) -> Dict[str, str]:
        """处理设计工具的错误，返回统一的 action 和 remark

        这是一个通用方法，用于在所有设计工具的 get_after_tool_call_friendly_action_and_remark 中使用。
        参考 edit_file.py 的实现方式，对错误进行归类处理。

        Args:
            result: 工具执行结果
            default_action_code: 默认的 action 代码
            default_success_message_code: 成功时的默认消息代码

        Returns:
            包含 action 和 remark 的字典
        """
        if not result.ok:
            # 设置使用自定义 remark
            result.use_custom_remark = True

            # 从 extra_info 中获取错误类型
            error_type = result.extra_info.get("error_type") if result.extra_info else None

            # 根据错误类型返回归类后的通用错误消息
            if error_type:
                # 使用错误类型对应的友好消息
                remark = i18n.translate(error_type, category="tool.messages")

                # 对于可以重试的错误，添加后缀提示
                # DESIGN_ERROR_UNEXPECTED 建议用户检查而不是直接重试
                if error_type != "design.error_unexpected":
                    suffix = i18n.translate("tool.ai_retry_suffix", category="tool.messages")
                    remark = remark + suffix
            else:
                # 如果没有设置错误类型，使用通用错误消息
                # 这里保持原有的 result.content 以保证向后兼容
                remark = result.content

            return {
                "action": i18n.translate(default_action_code, category="tool.actions"),
                "remark": remark
            }

        # 成功的情况
        return {
            "action": i18n.translate(default_action_code, category="tool.actions"),
            "remark": i18n.translate(default_success_message_code, category="tool.messages")
        }

    @staticmethod
    def _error_element_not_found(element_id: str) -> ToolResult:
        """创建"元素未找到"的错误结果

        Args:
            element_id: 元素ID

        Returns:
            带有 error_type 的 ToolResult
        """
        return ToolResult.error(
            f"Element with ID '{element_id}' not found in canvas.",
            extra_info={"error_type": "design.error_element_not_found"}
        )

    @staticmethod
    def _error_invalid_element_type(element_type: str) -> ToolResult:
        """创建"无效元素类型"的错误结果

        Args:
            element_type: 元素类型

        Returns:
            带有 error_type 的 ToolResult
        """
        return ToolResult.error(
            f"Invalid element type '{element_type}'. Please use a supported element type.",
            extra_info={"error_type": "design.error_invalid_element_type"}
        )

    @staticmethod
    def _error_duplicate_id(element_id: str) -> ToolResult:
        """创建"元素ID重复"的错误结果

        Args:
            element_id: 元素ID

        Returns:
            带有 error_type 的 ToolResult
        """
        return ToolResult.error(
            f"Element with ID '{element_id}' already exists. Please use a different ID.",
            extra_info={"error_type": "design.error_duplicate_id"}
        )

    @staticmethod
    def _error_image_not_found(image_path: str) -> ToolResult:
        """创建"图片文件未找到"的错误结果

        Args:
            image_path: 图片路径

        Returns:
            带有 error_type 的 ToolResult
        """
        return ToolResult.error(
            f"Image file not found: {image_path}",
            extra_info={"error_type": "design.error_image_file_not_found"}
        )

    @staticmethod
    def _error_invalid_property(property_name: str, reason: str = "") -> ToolResult:
        """创建"无效属性"的错误结果

        Args:
            property_name: 属性名称
            reason: 错误原因（可选）

        Returns:
            带有 error_type 的 ToolResult
        """
        message = f"Invalid property '{property_name}'"
        if reason:
            message += f": {reason}"
        return ToolResult.error(
            message,
            extra_info={"error_type": "design.error_invalid_property"}
        )

    async def _build_elements_detail_from_ids(
        self,
        project_path: Path,
        element_ids: list[str],
        manager: CanvasManager
    ) -> list[Dict[str, Any]]:
        """从元素 ID 列表构建元素详情列表（公共方法）

        按照传入的 element_ids 顺序返回元素详情，保证顺序一致性

        Args:
            project_path: 项目路径
            element_ids: 元素 ID 列表（顺序将被保持）
            manager: 画布管理器

        Returns:
            元素详情列表（与 element_ids 顺序一致）
        """
        elements_detail = []

        # 按照 element_ids 的顺序逐个获取元素详情
        for element_id in element_ids:
            element = await manager.get_element_by_id(element_id)
            if element:
                detail = await self._build_element_detail(element, project_path, manager)
                elements_detail.append(detail)

        return elements_detail

    async def _build_element_detail(
        self,
        element: Any,
        project_path: Path,
        manager: CanvasManager
    ) -> Dict[str, Any]:
        """构建单个元素的详细信息（公共方法）

        只返回基本字段：id、type、name、x、y、width、height

        Args:
            element: 元素对象
            project_path: 项目路径
            manager: 画布管理器

        Returns:
            元素详情字典（仅包含基本字段）
        """
        # 提取基本字段
        detail = {}

        # 支持 Pydantic 模型、字典和普通对象
        if isinstance(element, dict):
            detail["id"] = element.get("id", "")
            detail["type"] = element.get("type", "")
            detail["name"] = element.get("name", "")
            detail["x"] = element.get("x", 0)
            detail["y"] = element.get("y", 0)
            detail["width"] = element.get("width", 0)
            detail["height"] = element.get("height", 0)
        else:
            # 对象属性访问
            detail["id"] = getattr(element, "id", "")
            detail["type"] = getattr(element, "type", "")
            detail["name"] = getattr(element, "name", "")
            detail["x"] = getattr(element, "x", 0)
            detail["y"] = getattr(element, "y", 0)
            detail["width"] = getattr(element, "width", 0)
            detail["height"] = getattr(element, "height", 0)

        return detail
