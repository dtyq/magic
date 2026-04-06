"""
Canvas Manager - AI 友好的画布操作管理类

这个模块提供了一个高层次的画布管理接口，封装了底层的 magic_project_design_parser，
使其更适合 AI/LLM 进行交互和操作。

主要功能：
1. 元素查询 - 按各种条件查询画布元素
2. LLM 友好格式 - 将画布状态转换为自然语言描述
3. 画布状态管理 - 获取画布统计和布局信息
4. 元素操作封装 - 简化元素的增删改操作
5. 辅助功能 - ID 生成、验证、冲突检测等
6. 并发控制 - 通过锁机制防止并发修改冲突
"""

import asyncio
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional, Dict, Tuple, Set
from dataclasses import asdict

from agentlang.logger import get_logger
from app.tools.design.manager.canvas_lock_manager import canvas_lock_manager
from app.tools.design.utils.magic_project_design_parser import (
    read_magic_project_js,
    write_magic_project_js,
    MagicProjectConfig,
    CanvasConfig,
    ViewportState,
    BaseElement,
    ImageElement,
    VideoElement,
    TextElement,
    RectangleElement,
    EllipseElement,
    TriangleElement,
    StarElement,
    FrameElement,
    GroupElement,
    ElementType,
    CanvasElement,
    flatten_all_elements
)

logger = get_logger(__name__)


class ElementQuery:
    """元素查询条件"""

    def __init__(
        self,
        element_id: Optional[str] = None,
        element_type: Optional[ElementType] = None,
        name_pattern: Optional[str] = None,
        visible_only: bool = False,
        unlocked_only: bool = False,
        min_z_index: Optional[int] = None,
        max_z_index: Optional[int] = None,
        in_region: Optional[Tuple[float, float, float, float]] = None,  # (x1, y1, x2, y2)
        include_children: bool = True,  # 是否包含容器内的子元素
        top_level_only: bool = False  # 是否只查询顶层元素
    ):
        """
        初始化查询条件

        Args:
            element_id: 精确匹配元素 ID
            element_type: 元素类型过滤
            name_pattern: 名称模糊匹配（包含）
            visible_only: 仅查询可见元素
            unlocked_only: 仅查询未锁定元素
            min_z_index: 最小图层层级
            max_z_index: 最大图层层级
            in_region: 区域过滤，(x1, y1, x2, y2) 矩形范围（使用绝对坐标）
            include_children: 是否递归查询容器内的子元素（默认: True）
            top_level_only: 是否只查询顶层元素，不包含子元素（默认: False）
        """
        self.element_id = element_id
        self.element_type = element_type
        self.name_pattern = name_pattern
        self.visible_only = visible_only
        self.unlocked_only = unlocked_only
        self.min_z_index = min_z_index
        self.max_z_index = max_z_index
        self.in_region = in_region
        self.include_children = include_children
        self.top_level_only = top_level_only


class CanvasStatistics:
    """画布统计信息"""

    def __init__(self):
        self.total_elements: int = 0
        self.elements_by_type: Dict[ElementType, int] = {}
        self.visible_elements: int = 0
        self.locked_elements: int = 0
        self.z_index_range: Tuple[int, int] = (0, 0)
        self.canvas_bounds: Optional[Tuple[float, float, float, float]] = None  # (min_x, min_y, max_x, max_y)


class CanvasManager:
    """
    AI 友好的画布管理类

    这个类封装了底层的 parser 操作，提供更高层次、更适合 AI 交互的接口。
    所有操作都是异步的，并且会自动处理文件读写。

    并发控制：
    - 修改画布的操作应该在 with_lock() 上下文中执行
    - 只读操作（查询）不需要加锁
    - 锁的粒度是项目级别（每个项目有独立的锁）

    """

    def __init__(self, project_path: str):
        """
        初始化画布管理器

        Args:
            project_path: 项目路径（相对于 workspace）
        """
        self.project_path = project_path
        self._config_cache: Optional[MagicProjectConfig] = None

    @asynccontextmanager
    async def with_lock(self):
        """获取画布锁的上下文管理器

        所有修改画布的操作都应该在此锁的保护下进行，以防止并发修改冲突。

        Yields:
            None（但保证在上下文中画布已被锁定）

        Why we need this:
            防止多个 agent 任务同时修改同一画布，确保 load → 操作 → save 的原子性。
        """
        project_path = Path(self.project_path)
        async with canvas_lock_manager.lock_canvas(project_path):
            yield

    async def load(self) -> None:
        """加载画布配置到缓存（带重试机制）

        添加重试机制以处理文件系统延迟（如 TOS 同步延迟）等临时问题。
        """
        max_retries = 3
        retry_delay = 0.2

        for attempt in range(max_retries):
            try:
                self._config_cache = await read_magic_project_js(self.project_path)
                return  # 成功，直接返回
            except Exception as e:
                if attempt < max_retries - 1:
                    # 还有重试机会，等待后重试
                    logger.debug(
                        f"加载 magic.project.js 失败 (尝试 {attempt + 1}/{max_retries}): {self.project_path}, "
                        f"错误: {e}, 将在 {retry_delay}s 后重试"
                    )
                    await asyncio.sleep(retry_delay)
                else:
                    # 最后一次尝试也失败了，抛出异常
                    raise

    async def save(self) -> None:
        """保存缓存的画布配置到文件

        画布场景下不做文件变更检测，始终覆盖写入。
        画布元数据由代码负责写入，大模型不直接编辑元数据文本，
        因此不需要像文本文件编辑那样防止旧内容覆盖新内容。
        """
        if self._config_cache is None:
            raise ValueError("No config loaded. Call load() first.")

        await write_magic_project_js(self.project_path, self._config_cache)

    async def reload(self) -> None:
        """重新加载画布配置（丢弃缓存）"""
        self._config_cache = None
        await self.load()

    def _ensure_loaded(self) -> MagicProjectConfig:
        """确保配置已加载"""
        if self._config_cache is None:
            raise ValueError("Config not loaded. Call load() first.")
        return self._config_cache

    @property
    def config(self) -> MagicProjectConfig:
        """获取当前加载的画布配置

        Returns:
            当前画布配置对象

        Raises:
            ValueError: 如果配置尚未加载
        """
        return self._ensure_loaded()

    # ==================== 元素查询功能 ====================

    async def query_elements(self, query: ElementQuery) -> List[CanvasElement]:
        """
        按条件查询元素（支持递归查询容器内子元素）

        Args:
            query: 查询条件对象

        Returns:
            符合条件的元素列表

        注意：
            - 默认会递归查询容器内的子元素（include_children=True）
            - 区域过滤使用绝对坐标进行判断
            - 如果只需要顶层元素，设置 top_level_only=True
        """
        config = self._ensure_loaded()
        if config.canvas is None or not config.canvas.elements:
            return []

        # 根据查询条件决定使用哪个元素列表
        if query.top_level_only:
            # 只查询顶层元素
            elements_to_search = config.canvas.elements
        elif query.include_children:
            # 递归查询所有元素（包括容器内的子元素）
            elements_to_search = flatten_all_elements(config)
        else:
            # 只查询顶层元素（向后兼容）
            elements_to_search = config.canvas.elements

        results: List[CanvasElement] = []

        for element in elements_to_search:
            # ID 精确匹配
            if query.element_id and element.id != query.element_id:
                continue

            # 类型过滤
            if query.element_type and element.type != query.element_type:
                continue

            # 名称模糊匹配
            if query.name_pattern and query.name_pattern.lower() not in element.name.lower():
                continue

            # 可见性过滤
            if query.visible_only and not element.visible:
                continue

            # 锁定状态过滤
            if query.unlocked_only and element.locked:
                continue

            # 图层范围过滤
            if query.min_z_index is not None and (element.zIndex is None or element.zIndex < query.min_z_index):
                continue
            if query.max_z_index is not None and (element.zIndex is None or element.zIndex > query.max_z_index):
                continue

            # 区域过滤（使用绝对坐标）
            if query.in_region and not self._element_in_region(element, query.in_region):
                continue

            results.append(element)

        return results

    async def get_element_by_id(self, element_id: str) -> Optional[CanvasElement]:
        """
        通过 ID 获取元素

        Args:
            element_id: 元素 ID

        Returns:
            找到的元素，如果不存在则返回 None
        """
        query = ElementQuery(element_id=element_id)
        results = await self.query_elements(query)
        return results[0] if results else None

    async def get_elements_by_type(self, element_type: ElementType) -> List[CanvasElement]:
        """
        获取指定类型的所有元素

        Args:
            element_type: 元素类型

        Returns:
            该类型的所有元素列表
        """
        query = ElementQuery(element_type=element_type)
        return await self.query_elements(query)

    async def search_elements_by_name(self, name_pattern: str) -> List[CanvasElement]:
        """
        按名称搜索元素（模糊匹配）

        Args:
            name_pattern: 名称关键字

        Returns:
            名称包含关键字的元素列表
        """
        query = ElementQuery(name_pattern=name_pattern)
        return await self.query_elements(query)

    # noinspection PyMethodMayBeStatic
    def _element_in_region(
        self,
        element: CanvasElement,
        region: Tuple[float, float, float, float]
    ) -> bool:
        """
        检查元素是否在指定区域内（使用绝对坐标）

        Args:
            element: 元素对象
            region: 区域范围 (x1, y1, x2, y2)，使用画布绝对坐标

        Returns:
            元素中心点是否在区域内
        """
        # 使用绝对坐标进行判断
        if element.absolute_x is None or element.absolute_y is None:
            return False

        x1, y1, x2, y2 = region
        center_x = element.absolute_x + (element.width or 0) / 2
        center_y = element.absolute_y + (element.height or 0) / 2

        return x1 <= center_x <= x2 and y1 <= center_y <= y2

    # ==================== LLM 友好的格式转换 ====================

    async def get_canvas_overview(self, detail_level: str = "brief") -> str:
        """
        获取画布概览（自然语言描述）

        Args:
            detail_level: 详细程度，"brief" 或 "detailed"

        Returns:
            画布状态的自然语言描述
        """
        config = self._ensure_loaded()
        stats = await self.get_statistics()

        lines = [
            f"Canvas Project: {config.name or 'Untitled'}",
            f"Project Version: {config.version}",
            f"Project Type: {config.type}",
            f"",
            f"Element Statistics:",
            f"  - Total Elements: {stats.total_elements}",
            f"  - Visible Elements: {stats.visible_elements}",
            f"  - Locked Elements: {stats.locked_elements}",
        ]

        if stats.elements_by_type:
            lines.append(f"  - Element Type Distribution:")
            for element_type, count in sorted(stats.elements_by_type.items()):
                lines.append(f"    • {element_type}: {count}")

        if config.canvas and config.canvas.viewport:
            viewport = config.canvas.viewport
            lines.extend([
                f"",
                f"Viewport State:",
                f"  - Scale: {viewport.scale:.2f}",
                f"  - Offset: ({viewport.x:.1f}, {viewport.y:.1f})",
            ])

        if stats.canvas_bounds and detail_level == "detailed":
            min_x, min_y, max_x, max_y = stats.canvas_bounds
            lines.extend([
                f"",
                f"Canvas Bounds:",
                f"  - X Range: {min_x:.1f} ~ {max_x:.1f}",
                f"  - Y Range: {min_y:.1f} ~ {max_y:.1f}",
                f"  - Size: {max_x - min_x:.1f} × {max_y - min_y:.1f}",
            ])

        return "\n".join(lines)

    # noinspection PyMethodMayBeStatic
    async def describe_element(self, element: CanvasElement, detail_level: str = "brief") -> str:
        """
        描述单个元素（自然语言）

        Args:
            element: 元素对象
            detail_level: 详细程度，"brief" 或 "detailed"

        Returns:
            元素的自然语言描述
        """
        lines = [f"[{element.type}] {element.name} (ID: {element.id})"]

        # Basic position and size
        if element.x is not None and element.y is not None:
            lines.append(f"  Position: ({element.x:.1f}, {element.y:.1f})")
        if element.width is not None and element.height is not None:
            lines.append(f"  Size: {element.width:.1f} × {element.height:.1f}")

        # Layer and status
        if element.zIndex is not None:
            lines.append(f"  Layer: {element.zIndex}")

        status_parts = []
        if element.visible is False:
            status_parts.append("hidden")
        if element.locked:
            status_parts.append("locked")
        if element.opacity is not None and element.opacity < 1:
            status_parts.append(f"opacity {element.opacity:.2f}")
        if status_parts:
            lines.append(f"  Status: {', '.join(status_parts)}")

        if detail_level == "detailed":
            # Type-specific attributes
            if isinstance(element, ImageElement):
                if hasattr(element, 'src') and element.src:
                    # 图像生成服务返回的路径带 / 前缀，规范化后输出，保证模型看到干净的相对路径
                    lines.append(f"  Image Source: {element.src.lstrip('/')}")
                if hasattr(element, 'visualUnderstanding') and element.visualUnderstanding:
                    lines.append(f"  Image Description: {element.visualUnderstanding.summary}")

            elif isinstance(element, VideoElement):
                if hasattr(element, 'src') and element.src:
                    # 同上，路径带 / 前缀，规范化后输出
                    lines.append(f"  Video Source: {element.src.lstrip('/')}")
                if hasattr(element, 'poster') and element.poster:
                    lines.append(f"  Poster Source: {element.poster.lstrip('/')}")

            elif isinstance(element, TextElement):
                if hasattr(element, 'content') and element.content:
                    # Extract text content
                    text_parts = []
                    for para in element.content:
                        if para.get('children'):
                            for child in para['children']:
                                if child.get('type') == 'text':
                                    text_parts.append(child.get('text', ''))
                    if text_parts:
                        text_preview = ''.join(text_parts)[:50]
                        lines.append(f"  Text Content: {text_preview}{'...' if len(''.join(text_parts)) > 50 else ''}")

            elif isinstance(element, (RectangleElement, EllipseElement, TriangleElement, StarElement)):
                if hasattr(element, 'fill') and element.fill:
                    lines.append(f"  Fill Color: {element.fill}")
                if hasattr(element, 'stroke') and element.stroke:
                    lines.append(f"  Stroke Color: {element.stroke}")
                if hasattr(element, 'strokeWidth') and element.strokeWidth:
                    lines.append(f"  Stroke Width: {element.strokeWidth}")

        return "\n".join(lines)

    async def describe_elements(
        self,
        elements: List[CanvasElement],
        detail_level: str = "brief",
        sort_by: str = "z_index"  # "z_index", "position", "type"
    ) -> str:
        """
        描述多个元素（自然语言列表）

        Args:
            elements: 元素列表
            detail_level: 详细程度
            sort_by: 排序方式

        Returns:
            元素列表的自然语言描述
        """
        if not elements:
            return "No elements found."

        # Sort elements
        sorted_elements = self._sort_elements(elements, sort_by)

        lines = [f"Found {len(sorted_elements)} element(s):", ""]

        for i, element in enumerate(sorted_elements, 1):
            element_desc = await self.describe_element(element, detail_level)
            lines.append(f"{i}. {element_desc}")
            if detail_level == "detailed":
                lines.append("")  # Add blank line between elements in detailed mode

        return "\n".join(lines)

    # noinspection PyMethodMayBeStatic
    def _sort_elements(self, elements: List[CanvasElement], sort_by: str) -> List[CanvasElement]:
        """
        对元素列表排序

        Args:
            elements: 元素列表
            sort_by: 排序方式

        Returns:
            排序后的元素列表
        """
        if sort_by == "z_index":
            return sorted(elements, key=lambda e: (e.zIndex or 0, e.id))
        elif sort_by == "position":
            return sorted(elements, key=lambda e: (e.y or 0, e.x or 0, e.id))
        elif sort_by == "type":
            return sorted(elements, key=lambda e: (e.type, e.id))
        else:
            return elements

    # ==================== 画布状态管理 ====================

    async def get_statistics(self) -> CanvasStatistics:
        """
        获取画布统计信息（包含所有元素，包括容器内的子元素）

        Returns:
            画布统计对象
        """
        config = self._ensure_loaded()
        stats = CanvasStatistics()

        if config.canvas is None or not config.canvas.elements:
            return stats

        # 获取所有元素（包括容器内的子元素）
        elements = flatten_all_elements(config)
        stats.total_elements = len(elements)

        # 类型统计
        for element in elements:
            stats.elements_by_type[element.type] = stats.elements_by_type.get(element.type, 0) + 1

            if element.visible is not False:
                stats.visible_elements += 1

            if element.locked:
                stats.locked_elements += 1

        # 图层范围
        z_indices = [e.zIndex for e in elements if e.zIndex is not None]
        if z_indices:
            stats.z_index_range = (min(z_indices), max(z_indices))

        # 画布边界（使用绝对坐标）
        positioned_elements = [
            e for e in elements
            if e.absolute_x is not None and e.absolute_y is not None
        ]
        if positioned_elements:
            min_x = min(e.absolute_x for e in positioned_elements)
            min_y = min(e.absolute_y for e in positioned_elements)
            max_x = max(e.absolute_x + (e.width or 0) for e in positioned_elements)
            max_y = max(e.absolute_y + (e.height or 0) for e in positioned_elements)
            stats.canvas_bounds = (min_x, min_y, max_x, max_y)

        return stats

    async def is_empty(self) -> bool:
        """
        检查画布是否为空

        Returns:
            画布是否没有任何元素
        """
        config = self._ensure_loaded()
        return config.canvas is None or not config.canvas.elements

    # ==================== 元素操作封装 ====================

    async def add_element(self, element: CanvasElement) -> str:
        """
        添加元素到画布

        Args:
            element: 要添加的元素

        Returns:
            添加的元素 ID
        """
        config = self._ensure_loaded()

        # 确保有 canvas
        if config.canvas is None:
            config.canvas = CanvasConfig(
                viewport=ViewportState(scale=1.0, x=0, y=0),
                elements=[]
            )

        # 确保元素有 ID
        if not element.id:
            element.id = self.generate_element_id()

        # 添加元素
        config.canvas.elements.append(element)

        return element.id

    async def update_element(
        self,
        element_id: str,
        updates: Dict[str, object]
    ) -> bool:
        """
        更新元素属性（部分更新）

        Args:
            element_id: 元素 ID
            updates: 要更新的属性字典

        Returns:
            是否成功更新
        """
        element = await self.get_element_by_id(element_id)
        if element is None:
            return False

        # 更新属性
        for key, value in updates.items():
            if hasattr(element, key):
                setattr(element, key, value)

        return True

    async def delete_element(self, element_id: str) -> bool:
        """
        删除元素

        Args:
            element_id: 要删除的元素 ID

        Returns:
            是否成功删除
        """
        config = self._ensure_loaded()
        if config.canvas is None or not config.canvas.elements:
            return False

        original_count = len(config.canvas.elements)
        config.canvas.elements = [e for e in config.canvas.elements if e.id != element_id]

        return len(config.canvas.elements) < original_count

    async def delete_elements(self, element_ids: List[str]) -> int:
        """
        批量删除元素

        Args:
            element_ids: 要删除的元素 ID 列表

        Returns:
            成功删除的元素数量
        """
        config = self._ensure_loaded()
        if config.canvas is None or not config.canvas.elements:
            return 0

        id_set = set(element_ids)
        original_count = len(config.canvas.elements)
        config.canvas.elements = [e for e in config.canvas.elements if e.id not in id_set]

        return original_count - len(config.canvas.elements)

    async def move_element(
        self,
        element_id: str,
        delta_x: float = 0,
        delta_y: float = 0
    ) -> bool:
        """
        移动元素（相对移动）

        Args:
            element_id: 元素 ID
            delta_x: X 轴偏移量
            delta_y: Y 轴偏移量

        Returns:
            是否成功移动
        """
        element = await self.get_element_by_id(element_id)
        if element is None:
            return False

        if element.x is not None:
            element.x += delta_x
        if element.y is not None:
            element.y += delta_y

        return True

    async def resize_element(
        self,
        element_id: str,
        new_width: Optional[float] = None,
        new_height: Optional[float] = None
    ) -> bool:
        """
        调整元素尺寸

        Args:
            element_id: 元素 ID
            new_width: 新宽度
            new_height: 新高度

        Returns:
            是否成功调整
        """
        element = await self.get_element_by_id(element_id)
        if element is None:
            return False

        if new_width is not None:
            element.width = new_width
        if new_height is not None:
            element.height = new_height

        return True

    async def change_z_index(self, element_id: str, new_z_index: int) -> bool:
        """
        修改元素图层层级

        Args:
            element_id: 元素 ID
            new_z_index: 新的图层层级

        Returns:
            是否成功修改
        """
        return await self.update_element(element_id, {"zIndex": new_z_index})

    async def set_visibility(self, element_id: str, visible: bool) -> bool:
        """
        设置元素可见性

        Args:
            element_id: 元素 ID
            visible: 是否可见

        Returns:
            是否成功设置
        """
        return await self.update_element(element_id, {"visible": visible})

    async def set_lock(self, element_id: str, locked: bool) -> bool:
        """
        设置元素锁定状态

        Args:
            element_id: 元素 ID
            locked: 是否锁定

        Returns:
            是否成功设置
        """
        return await self.update_element(element_id, {"locked": locked})

    # ==================== 辅助功能 ====================

    # noinspection PyMethodMayBeStatic
    def generate_element_id(self) -> str:
        """
        生成唯一的元素 ID

        Returns:
            格式为 "element-{timestamp}{random}" 的 ID
        """
        timestamp = int(time.time() * 1000)
        # 添加随机后缀确保唯一性
        import random
        random_suffix = random.randint(10000, 99999)
        return f"element-{timestamp}{random_suffix}"

    async def element_exists(self, element_id: str) -> bool:
        """
        检查元素是否存在

        Args:
            element_id: 元素 ID

        Returns:
            元素是否存在
        """
        element = await self.get_element_by_id(element_id)
        return element is not None

    async def check_name_conflict(self, name: str) -> List[CanvasElement]:
        """
        检查名称冲突

        Args:
            name: 要检查的名称

        Returns:
            同名元素列表（空列表表示无冲突）
        """
        return await self.search_elements_by_name(name)

    async def find_overlapping_elements(
        self,
        element: CanvasElement
    ) -> List[CanvasElement]:
        """
        查找与指定元素重叠的其他元素（使用绝对坐标，包括所有子元素）

        Args:
            element: 目标元素

        Returns:
            重叠的元素列表
        """
        if element.absolute_x is None or element.absolute_y is None or element.width is None or element.height is None:
            return []

        config = self._ensure_loaded()
        if config.canvas is None or not config.canvas.elements:
            return []

        overlapping: List[CanvasElement] = []

        # 获取所有元素（包括容器内的子元素）
        all_elements = flatten_all_elements(config)

        for other in all_elements:
            if other.id == element.id:
                continue

            if other.absolute_x is None or other.absolute_y is None or other.width is None or other.height is None:
                continue

            # 检查矩形重叠（使用绝对坐标）
            if self._rectangles_overlap(
                (element.absolute_x, element.absolute_y, element.width, element.height),
                (other.absolute_x, other.absolute_y, other.width, other.height)
            ):
                overlapping.append(other)

        return overlapping

    # noinspection PyMethodMayBeStatic
    def _rectangles_overlap(
        self,
        rect1: Tuple[float, float, float, float],
        rect2: Tuple[float, float, float, float]
    ) -> bool:
        """
        检查两个矩形是否重叠

        Args:
            rect1: 矩形1 (x, y, width, height)
            rect2: 矩形2 (x, y, width, height)

        Returns:
            是否重叠
        """
        x1, y1, w1, h1 = rect1
        x2, y2, w2, h2 = rect2

        return not (x1 + w1 < x2 or x2 + w2 < x1 or y1 + h1 < y2 or y2 + h2 < y1)

    async def get_next_z_index(self) -> int:
        """
        获取下一个可用的图层层级（当前最大值 + 1）

        Returns:
            下一个可用的 z-index
        """
        stats = await self.get_statistics()
        if stats.z_index_range == (0, 0):
            return 0
        return stats.z_index_range[1] + 1

    # ==================== 上下文管理器支持 ====================

    async def __aenter__(self):
        """进入上下文时自动加载"""
        await self.load()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """退出上下文时自动保存（如果没有异常）"""
        if exc_type is None:
            await self.save()
        return False
