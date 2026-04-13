"""
Canvas Manager - 画布实时 IO 事务入口

这个模块只保留两类职责：
1. 统一的实时读取与写事务入口
2. 基于当前快照的画布查询与内存修改辅助

## 核心设计原则：IO 读 -> 内存改 -> IO 写

每一次对 magic.project.js 的写操作都必须严格遵循以下三步原子流程：

  1. IO 读 —— 从文件实时读取最新状态，不使用任何缓存或先前 load 的快照
  2. 内存改 —— 在本次读取的快照上完成业务变更，内存只作为本次事务的工作区
  3. IO 写 —— 立即写回文件，并通过重新读取验证内容确实已更新

整个 read-modify-write 过程持有项目级锁，同一画布的并发写操作退化为 FIFO 串行。

**不要这样做（会引发一致性问题）：**
- 把 load 和 save 拆开，中间穿插长时间的异步操作
- 把一个旧快照复用到下一次写操作（跨 await 持有 config 引用）
- 直接写文件后仅校验文件大小而不验证内容

**这套模型不是性能优化，而是正确性保证：** 旧的 load/save 缓存模式
看似简洁，但在多阶段异步任务中（如三阶段图片生成），第二阶段完成后
写回时极易覆盖并发操作期间其他事务写入的新状态，造成元素丢失。
"""

import asyncio
import inspect
import random
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeVar

from agentlang.logger import get_logger
from app.tools.design.manager.canvas_lock_manager import canvas_lock_manager
from app.tools.design.utils.magic_project_design_parser import (
    BaseElement,
    CanvasConfig,
    CanvasElement,
    ElementType,
    EllipseElement,
    FrameElement,
    GroupElement,
    ImageElement,
    MagicProjectConfig,
    RectangleElement,
    StarElement,
    TextElement,
    TriangleElement,
    VideoElement,
    ViewportState,
    flatten_all_elements,
    read_magic_project_js,
    write_magic_project_js,
)

logger = get_logger(__name__)

TransactionResultT = TypeVar("TransactionResultT")


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
        in_region: Optional[Tuple[float, float, float, float]] = None,
        include_children: bool = True,
        top_level_only: bool = False,
    ):
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
        self.canvas_bounds: Optional[Tuple[float, float, float, float]] = None


class CanvasManager:
    """唯一的画布实时读写入口。"""

    def __init__(self, project_path: str):
        self.project_path = project_path

    async def _read_current_canvas_once(self) -> MagicProjectConfig:
        """执行一次真实文件读取，不做锁编排。"""
        max_retries = 3
        retry_delay = 0.2
        last_error: Optional[Exception] = None

        for attempt in range(max_retries):
            try:
                return await read_magic_project_js(self.project_path)
            except Exception as error:  # noqa: BLE001
                last_error = error
                if attempt == max_retries - 1:
                    break
                logger.debug(
                    "读取当前画布失败 (尝试 %s/%s): %s, 错误: %s, %.1fs 后重试",
                    attempt + 1,
                    max_retries,
                    self.project_path,
                    error,
                    retry_delay,
                )
                await asyncio.sleep(retry_delay)

        raise last_error or RuntimeError("读取画布失败")

    async def read_current_canvas(self, *, use_lock: bool = True) -> MagicProjectConfig:
        """
        实时读取当前文件内容。

        默认也走项目级锁，让同一画布上的读写在进程内退化为 FIFO 串行。
        写事务内部会显式传 `use_lock=False`，避免同一把锁重入。
        """
        if not use_lock:
            return await self._read_current_canvas_once()

        async with canvas_lock_manager.lock_canvas(Path(self.project_path)):
            return await self._read_current_canvas_once()

    async def read_current_element_by_id(self, element_id: str) -> Optional[CanvasElement]:
        """基于最新文件内容读取单个元素。"""
        current_config = await self.read_current_canvas()
        return await self.get_element_by_id(element_id, config=current_config)

    async def run_write_transaction(
        self,
        mutator: Callable[[MagicProjectConfig], TransactionResultT],
        verify_content: Optional[
            Callable[[MagicProjectConfig, TransactionResultT], bool]
        ] = None,
        before_write: Optional[Callable[[], Any]] = None,
        after_write: Optional[Callable[[TransactionResultT], Any]] = None,
    ) -> TransactionResultT:
        """
        在同一把项目锁内完成一次原子写事务：IO 读 -> 内存改 -> IO 写。

        执行顺序（全程持锁，不可被其他写事务穿插）：
          1. 从文件实时读取最新状态（不依赖任何旧快照）
          2. 调用 before_write（如有，通常用于派发 BEFORE_FILE_UPDATED）
          3. 调用 mutator，仅在内存中修改当前快照
          4. 将修改后的完整配置写回文件
          5. 重新读取文件，验证内容确实已更新（不只是文件大小）
          6. 调用 after_write（如有，通常用于派发 FILE_UPDATED）

        Args:
            mutator:        接收当前 MagicProjectConfig，在内存中修改后返回业务结果；
                            可以是 async 函数。
            verify_content: 接收写后重新读取的 config 和 mutator 返回值，
                            返回 False 则写入被视为失败并抛出 IOError。
            before_write:   在写操作开始前执行的 async callback（在锁内）。
            after_write:    写操作成功后执行的 async callback（在锁内），
                            接收 mutator 返回值。

        注意：mutator 不能在自身内部再次调用 run_write_transaction，
        否则会死锁（asyncio.Lock 不可重入）。
        """
        async with canvas_lock_manager.lock_canvas(Path(self.project_path)):
            current_config = await self.read_current_canvas(use_lock=False)
            if before_write is not None:
                before_result = before_write()
                if inspect.isawaitable(before_result):
                    await before_result

            result = mutator(current_config)
            if inspect.isawaitable(result):
                result = await result

            verifier = None
            if verify_content is not None:
                verifier = lambda verified_config: verify_content(verified_config, result)

            await write_magic_project_js(
                self.project_path,
                current_config,
                content_verifier=verifier,
            )

            if after_write is not None:
                after_result = after_write(result)
                if inspect.isawaitable(after_result):
                    await after_result

            return result

    async def query_elements(
        self,
        query: ElementQuery,
        config: Optional[MagicProjectConfig] = None,
    ) -> List[CanvasElement]:
        current_config = config or await self.read_current_canvas()
        if current_config.canvas is None or not current_config.canvas.elements:
            return []

        if query.top_level_only:
            elements_to_search = current_config.canvas.elements
        elif query.include_children:
            elements_to_search = flatten_all_elements(current_config)
        else:
            elements_to_search = current_config.canvas.elements

        results: List[CanvasElement] = []
        for element in elements_to_search:
            if query.element_id and element.id != query.element_id:
                continue
            if query.element_type and element.type != query.element_type:
                continue
            if query.name_pattern and query.name_pattern.lower() not in element.name.lower():
                continue
            if query.visible_only and not element.visible:
                continue
            if query.unlocked_only and element.locked:
                continue
            if query.min_z_index is not None and (
                element.zIndex is None or element.zIndex < query.min_z_index
            ):
                continue
            if query.max_z_index is not None and (
                element.zIndex is None or element.zIndex > query.max_z_index
            ):
                continue
            if query.in_region and not self._element_in_region(element, query.in_region):
                continue
            results.append(element)

        return results

    async def get_element_by_id(
        self,
        element_id: str,
        config: Optional[MagicProjectConfig] = None,
    ) -> Optional[CanvasElement]:
        results = await self.query_elements(
            ElementQuery(element_id=element_id),
            config=config,
        )
        return results[0] if results else None

    async def get_elements_by_type(
        self,
        element_type: ElementType,
        config: Optional[MagicProjectConfig] = None,
    ) -> List[CanvasElement]:
        return await self.query_elements(
            ElementQuery(element_type=element_type),
            config=config,
        )

    async def search_elements_by_name(
        self,
        name_pattern: str,
        config: Optional[MagicProjectConfig] = None,
    ) -> List[CanvasElement]:
        return await self.query_elements(
            ElementQuery(name_pattern=name_pattern),
            config=config,
        )

    async def get_canvas_overview(
        self,
        detail_level: str = "brief",
        config: Optional[MagicProjectConfig] = None,
    ) -> str:
        current_config = config or await self.read_current_canvas()
        stats = await self.get_statistics(config=current_config)
        lines = [
            f"Canvas Project: {current_config.name or 'Untitled'}",
            f"Project Version: {current_config.version}",
            f"Project Type: {current_config.type}",
            "",
            "Element Statistics:",
            f"  - Total Elements: {stats.total_elements}",
            f"  - Visible Elements: {stats.visible_elements}",
            f"  - Locked Elements: {stats.locked_elements}",
        ]

        if stats.elements_by_type:
            lines.append("  - Element Type Distribution:")
            for element_type, count in sorted(stats.elements_by_type.items()):
                lines.append(f"    • {element_type}: {count}")

        if current_config.canvas and current_config.canvas.viewport:
            viewport = current_config.canvas.viewport
            lines.extend(
                [
                    "",
                    "Viewport State:",
                    f"  - Scale: {viewport.scale:.2f}",
                    f"  - Offset: ({viewport.x:.1f}, {viewport.y:.1f})",
                ]
            )

        if stats.canvas_bounds and detail_level == "detailed":
            min_x, min_y, max_x, max_y = stats.canvas_bounds
            lines.extend(
                [
                    "",
                    "Canvas Bounds:",
                    f"  - X Range: {min_x:.1f} ~ {max_x:.1f}",
                    f"  - Y Range: {min_y:.1f} ~ {max_y:.1f}",
                    f"  - Size: {max_x - min_x:.1f} × {max_y - min_y:.1f}",
                ]
            )

        return "\n".join(lines)

    async def describe_element(
        self,
        element: CanvasElement,
        detail_level: str = "brief",
    ) -> str:
        lines = [f"[{element.type}] {element.name} (ID: {element.id})"]
        if element.x is not None and element.y is not None:
            lines.append(f"  Position: ({element.x:.1f}, {element.y:.1f})")
        if element.width is not None and element.height is not None:
            lines.append(f"  Size: {element.width:.1f} × {element.height:.1f}")
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
            if isinstance(element, ImageElement) and getattr(element, "src", None):
                lines.append(f"  Image Source: {element.src.lstrip('/')}")
            elif isinstance(element, VideoElement) and getattr(element, "src", None):
                lines.append(f"  Video Source: {element.src.lstrip('/')}")
            elif isinstance(element, TextElement) and getattr(element, "content", None):
                text_parts = []
                for paragraph in element.content:
                    children = paragraph.get("children", []) if isinstance(paragraph, dict) else []
                    for child in children:
                        if child.get("type") == "text":
                            text_parts.append(child.get("text", ""))
                if text_parts:
                    preview = "".join(text_parts)
                    lines.append(
                        f"  Text Content: {preview[:50]}{'...' if len(preview) > 50 else ''}"
                    )
            elif isinstance(element, (RectangleElement, EllipseElement, TriangleElement, StarElement)):
                if getattr(element, "fill", None):
                    lines.append(f"  Fill Color: {element.fill}")
                if getattr(element, "stroke", None):
                    lines.append(f"  Stroke Color: {element.stroke}")
                if getattr(element, "strokeWidth", None):
                    lines.append(f"  Stroke Width: {element.strokeWidth}")

        return "\n".join(lines)

    async def describe_elements(
        self,
        elements: List[CanvasElement],
        detail_level: str = "brief",
        sort_by: str = "z_index",
    ) -> str:
        if not elements:
            return "No elements found."

        sorted_elements = self._sort_elements(elements, sort_by)
        lines = [f"Found {len(sorted_elements)} element(s):", ""]
        for index, element in enumerate(sorted_elements, 1):
            lines.append(f"{index}. {await self.describe_element(element, detail_level)}")
            if detail_level == "detailed":
                lines.append("")
        return "\n".join(lines)

    async def get_statistics(
        self,
        config: Optional[MagicProjectConfig] = None,
    ) -> CanvasStatistics:
        current_config = config or await self.read_current_canvas()
        stats = CanvasStatistics()
        if current_config.canvas is None or not current_config.canvas.elements:
            return stats

        elements = flatten_all_elements(current_config)
        stats.total_elements = len(elements)
        for element in elements:
            stats.elements_by_type[element.type] = stats.elements_by_type.get(element.type, 0) + 1
            if element.visible is not False:
                stats.visible_elements += 1
            if element.locked:
                stats.locked_elements += 1

        z_indices = [element.zIndex for element in elements if element.zIndex is not None]
        if z_indices:
            stats.z_index_range = (min(z_indices), max(z_indices))

        positioned = [
            element
            for element in elements
            if element.absolute_x is not None and element.absolute_y is not None
        ]
        if positioned:
            min_x = min(element.absolute_x for element in positioned)
            min_y = min(element.absolute_y for element in positioned)
            max_x = max(element.absolute_x + (element.width or 0) for element in positioned)
            max_y = max(element.absolute_y + (element.height or 0) for element in positioned)
            stats.canvas_bounds = (min_x, min_y, max_x, max_y)

        return stats

    async def is_empty(self, config: Optional[MagicProjectConfig] = None) -> bool:
        current_config = config or await self.read_current_canvas()
        return current_config.canvas is None or not current_config.canvas.elements

    async def add_element(
        self,
        element: CanvasElement,
        config: MagicProjectConfig,
    ) -> str:
        if config.canvas is None:
            config.canvas = CanvasConfig(
                viewport=ViewportState(scale=1.0, x=0, y=0),
                elements=[],
            )

        if not element.id:
            element.id = self.generate_element_id()
        config.canvas.elements.append(element)
        return element.id

    async def update_element(
        self,
        element_id: str,
        updates: Dict[str, object],
        config: MagicProjectConfig,
    ) -> bool:
        element = await self.get_element_by_id(element_id, config=config)
        if element is None:
            return False

        for key, value in updates.items():
            if hasattr(element, key):
                setattr(element, key, value)
        return True

    async def delete_element(self, element_id: str, config: MagicProjectConfig) -> bool:
        if config.canvas is None or not config.canvas.elements:
            return False

        original_count = len(config.canvas.elements)
        config.canvas.elements = [element for element in config.canvas.elements if element.id != element_id]
        return len(config.canvas.elements) < original_count

    async def delete_elements(self, element_ids: List[str], config: MagicProjectConfig) -> int:
        if config.canvas is None or not config.canvas.elements:
            return 0

        id_set = set(element_ids)
        original_count = len(config.canvas.elements)
        config.canvas.elements = [element for element in config.canvas.elements if element.id not in id_set]
        return original_count - len(config.canvas.elements)

    async def move_element(
        self,
        element_id: str,
        config: MagicProjectConfig,
        delta_x: float = 0,
        delta_y: float = 0,
    ) -> bool:
        element = await self.get_element_by_id(element_id, config=config)
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
        config: MagicProjectConfig,
        new_width: Optional[float] = None,
        new_height: Optional[float] = None,
    ) -> bool:
        element = await self.get_element_by_id(element_id, config=config)
        if element is None:
            return False
        if new_width is not None:
            element.width = new_width
        if new_height is not None:
            element.height = new_height
        return True

    async def change_z_index(
        self,
        element_id: str,
        new_z_index: int,
        config: MagicProjectConfig,
    ) -> bool:
        return await self.update_element(element_id, {"zIndex": new_z_index}, config=config)

    async def set_visibility(
        self,
        element_id: str,
        visible: bool,
        config: MagicProjectConfig,
    ) -> bool:
        return await self.update_element(element_id, {"visible": visible}, config=config)

    async def set_lock(
        self,
        element_id: str,
        locked: bool,
        config: MagicProjectConfig,
    ) -> bool:
        return await self.update_element(element_id, {"locked": locked}, config=config)

    def generate_element_id(self) -> str:
        timestamp = int(time.time() * 1000)
        random_suffix = random.randint(10000, 99999)
        return f"element-{timestamp}{random_suffix}"

    async def element_exists(
        self,
        element_id: str,
        config: Optional[MagicProjectConfig] = None,
    ) -> bool:
        return await self.get_element_by_id(element_id, config=config) is not None

    async def check_name_conflict(
        self,
        name: str,
        config: Optional[MagicProjectConfig] = None,
    ) -> List[CanvasElement]:
        return await self.search_elements_by_name(name, config=config)

    async def find_overlapping_elements(
        self,
        element: CanvasElement,
        config: Optional[MagicProjectConfig] = None,
    ) -> List[CanvasElement]:
        if (
            element.absolute_x is None
            or element.absolute_y is None
            or element.width is None
            or element.height is None
        ):
            return []

        current_config = config or await self.read_current_canvas()
        if current_config.canvas is None or not current_config.canvas.elements:
            return []

        overlapping: List[CanvasElement] = []
        for other in flatten_all_elements(current_config):
            if other.id == element.id:
                continue
            if (
                other.absolute_x is None
                or other.absolute_y is None
                or other.width is None
                or other.height is None
            ):
                continue
            if self._rectangles_overlap(
                (element.absolute_x, element.absolute_y, element.width, element.height),
                (other.absolute_x, other.absolute_y, other.width, other.height),
            ):
                overlapping.append(other)
        return overlapping

    async def get_next_z_index(
        self,
        config: Optional[MagicProjectConfig] = None,
    ) -> int:
        stats = await self.get_statistics(config=config)
        if stats.z_index_range == (0, 0):
            return 0
        return stats.z_index_range[1] + 1

    @staticmethod
    def _element_in_region(
        element: CanvasElement,
        region: Tuple[float, float, float, float],
    ) -> bool:
        if element.absolute_x is None or element.absolute_y is None:
            return False
        x1, y1, x2, y2 = region
        center_x = element.absolute_x + (element.width or 0) / 2
        center_y = element.absolute_y + (element.height or 0) / 2
        return x1 <= center_x <= x2 and y1 <= center_y <= y2

    @staticmethod
    def _sort_elements(elements: List[CanvasElement], sort_by: str) -> List[CanvasElement]:
        if sort_by == "z_index":
            return sorted(elements, key=lambda element: (element.zIndex or 0, element.id))
        if sort_by == "position":
            return sorted(elements, key=lambda element: (element.y or 0, element.x or 0, element.id))
        if sort_by == "type":
            return sorted(elements, key=lambda element: (element.type, element.id))
        return elements

    @staticmethod
    def _rectangles_overlap(
        rect1: Tuple[float, float, float, float],
        rect2: Tuple[float, float, float, float],
    ) -> bool:
        x1, y1, w1, h1 = rect1
        x2, y2, w2, h2 = rect2
        return not (x1 + w1 < x2 or x2 + w2 < x1 or y1 + h1 < y2 or y2 + h2 < y1)
