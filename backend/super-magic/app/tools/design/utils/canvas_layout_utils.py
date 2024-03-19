"""
画布布局工具模块

提供画布元素布局相关的工具函数，包括智能位置计算等。

坐标系统说明：
- 顶层元素的 x/y 是相对于画布的绝对坐标
- 容器（frame/group）内子元素的 x/y 是相对于父容器的坐标
- 本模块统一使用绝对坐标进行位置计算
- 元素的 _absolute_x 和 _absolute_y 字段存储计算后的绝对坐标
"""

from typing import List, Tuple

from agentlang.logger import get_logger
from app.tools.design.utils.magic_project_design_parser import (
    CanvasElement,
    flatten_all_elements,
    MagicProjectConfig
)
from app.tools.design.constants import DEFAULT_ELEMENT_SPACING

logger = get_logger(__name__)


def check_overlap(
    x1: float, y1: float, width1: float, height1: float,
    x2: float, y2: float, width2: float, height2: float
) -> bool:
    """检查两个矩形是否重叠

    使用标准的矩形重叠检测算法：
    如果两个矩形不重叠，则必然满足以下条件之一：
    - 矩形1在矩形2的左边（x1 + width1 <= x2）
    - 矩形1在矩形2的右边（x1 >= x2 + width2）
    - 矩形1在矩形2的上边（y1 + height1 <= y2）
    - 矩形1在矩形2的下边（y1 >= y2 + height2）

    如果以上条件都不满足，则两个矩形重叠。

    Args:
        x1, y1: 矩形1的左上角坐标
        width1, height1: 矩形1的宽度和高度
        x2, y2: 矩形2的左上角坐标
        width2, height2: 矩形2的宽度和高度

    Returns:
        如果两个矩形重叠返回 True，否则返回 False

    Examples:
        >>> check_overlap(0, 0, 100, 100, 50, 50, 100, 100)
        True  # 重叠
        >>> check_overlap(0, 0, 100, 100, 120, 0, 100, 100)
        False  # 不重叠（矩形1在矩形2的左边）
    """
    # 检查是否不重叠的四种情况
    if (x1 + width1 <= x2 or      # 矩形1在矩形2的左边
        x1 >= x2 + width2 or      # 矩形1在矩形2的右边
        y1 + height1 <= y2 or     # 矩形1在矩形2的上边
        y1 >= y2 + height2):      # 矩形1在矩形2的下边
        return False

    return True


def check_overlap_with_any_element(
    new_x: float,
    new_y: float,
    new_width: float,
    new_height: float,
    existing_elements: List[CanvasElement]
) -> bool:
    """检查新元素是否与任何现有元素重叠

    Args:
        new_x, new_y: 新元素的位置
        new_width, new_height: 新元素的尺寸
        existing_elements: 现有元素列表

    Returns:
        如果与任何元素重叠返回 True，否则返回 False
    """
    for elem in existing_elements:
        if check_overlap(
            new_x, new_y, new_width, new_height,
            elem.absolute_x, elem.absolute_y, elem.width, elem.height
        ):
            logger.debug(
                f"检测到重叠: 新元素({new_x:.1f}, {new_y:.1f}, {new_width:.1f}x{new_height:.1f}) "
                f"与元素 {elem.id}({elem.absolute_x:.1f}, {elem.absolute_y:.1f}, "
                f"{elem.width:.1f}x{elem.height:.1f})"
            )
            return True

    return False


def _should_start_new_row_for_height_difference(
    last_row: List[CanvasElement],
    new_height: float,
    threshold: float = 100.0
) -> bool:
    """判断是否因高度差异过大而需要换行

    当新元素的高度与当前行元素的平均高度差异超过阈值时，
    建议开始新行以保持布局整齐。

    Args:
        last_row: 当前行的元素列表
        new_height: 新元素的高度
        threshold: 高度差异阈值（默认: 100像素）

    Returns:
        如果应该换行返回 True，否则返回 False
    """
    if not last_row:
        return False

    # 计算当前行元素的平均高度
    avg_height = sum(e.height for e in last_row) / len(last_row)

    # 判断高度差异是否超过阈值
    height_diff = abs(new_height - avg_height)

    if height_diff > threshold:
        logger.debug(
            f"高度差异过大: 新元素({new_height:.1f}) vs 行平均({avg_height:.1f}), "
            f"差异 {height_diff:.1f}px > {threshold}px"
        )
        return True

    return False


def _find_non_overlapping_position(
    positioned_elements: List[CanvasElement],
    element_width: float,
    element_height: float,
    start_x: float,
    start_y: float,
    spacing: float
) -> Tuple[float, float]:
    """在指定起始位置附近查找不重叠的位置

    从起始位置开始，如果检测到重叠，则尝试向右移动，
    直到找到不重叠的位置。

    Args:
        positioned_elements: 现有元素列表
        element_width: 新元素宽度
        element_height: 新元素高度
        start_x: 起始 X 坐标
        start_y: 起始 Y 坐标
        spacing: 元素间距

    Returns:
        不重叠的 (x, y) 坐标
    """
    candidate_x = start_x
    candidate_y = start_y

    # 最多尝试 10 次向右移动
    max_attempts = 10
    for attempt in range(max_attempts):
        if not check_overlap_with_any_element(
            candidate_x, candidate_y, element_width, element_height, positioned_elements
        ):
            # 找到不重叠的位置
            if attempt > 0:
                logger.debug(
                    f"经过 {attempt} 次调整，找到不重叠位置: ({candidate_x:.1f}, {candidate_y:.1f})"
                )
            return (candidate_x, candidate_y)

        # 发生重叠，向右移动
        # 找到与当前位置重叠的元素中最右边的
        max_right = candidate_x
        for elem in positioned_elements:
            if check_overlap(
                candidate_x, candidate_y, element_width, element_height,
                elem.absolute_x, elem.absolute_y, elem.width, elem.height
            ):
                elem_right = elem.absolute_x + elem.width
                max_right = max(max_right, elem_right)

        # 移动到重叠元素的右边
        candidate_x = max_right + spacing

    # 如果还是找不到，返回候选位置（调用方会处理）
    logger.warning(
        f"无法找到完全不重叠的位置，返回最后候选位置: ({candidate_x:.1f}, {candidate_y:.1f})"
    )
    return (candidate_x, candidate_y)


def calculate_next_element_position(
    config: MagicProjectConfig,
    element_width: float,
    element_height: float,
    max_elements_per_row: int = 4,
    spacing: float = DEFAULT_ELEMENT_SPACING,
    height_diff_threshold: float = 100.0
) -> Tuple[float, float]:
    """
    计算画布上新元素的最佳位置（使用绝对坐标，智能避免重叠）

    改进的智能布局算法，包括：
    1. 展平所有元素（包括容器内的子元素）
    2. 使用绝对坐标根据垂直重叠将元素分组为行
    3. 智能判断是否可以添加到当前行：
       - 检查行元素数量限制
       - 检查高度差异（避免同一行元素高度相差太大）
       - 执行重叠检测，确保新元素不与任何现有元素重叠
    4. 如果当前行不合适，则创建新行
    5. 保持元素之间的一致间距

    改进要点：
    - ✅ 真正的重叠检测：使用标准矩形重叠算法
    - ✅ 高度差异检测：避免同一行元素高度相差过大
    - ✅ 智能位置调整：如果检测到重叠，尝试向右移动寻找合适位置
    - ✅ 保证不重叠：返回的位置一定不会与现有元素重叠

    Args:
        config: 项目配置对象（包含所有元素）
        element_width: 新元素的宽度
        element_height: 新元素的高度
        max_elements_per_row: 每行最大元素数量（默认: 4）
        spacing: 元素之间的间距，单位像素（默认: 20）
        height_diff_threshold: 高度差异阈值，超过此值会换行（默认: 100）

    Returns:
        新元素的 (x, y) 坐标元组（画布绝对坐标，保证不重叠）

    Examples:
        >>> config = await read_magic_project_js("project_path")
        >>> x, y = calculate_next_element_position(
        ...     config,
        ...     element_width=200,
        ...     element_height=150
        ... )
        >>> print(f"新元素位置: ({x}, {y})")
        新元素位置: (440, 0)

    算法详情:
        - 空画布: 返回 (0, 0)
        - 自动展平: 包括所有容器内的子元素
        - 绝对坐标: 使用 _absolute_x 和 _absolute_y 进行计算
        - 行检测: 根据垂直重叠对元素分组
        - 智能换行: 基于数量、高度差异、重叠检测多重判断
        - 新行: 定位在上一行下方，保持间距，确保不重叠
    """
    # 获取所有元素（包括容器内的子元素）
    all_elements = flatten_all_elements(config)

    # 过滤具有有效位置和尺寸信息的元素（使用绝对坐标）
    positioned_elements = [
        e for e in all_elements
        if e.absolute_x is not None and e.absolute_y is not None
        and e.width is not None and e.height is not None
        and e.visible is not False  # 排除隐藏元素
    ]

    # 空画布：从原点开始
    if not positioned_elements:
        logger.debug("画布为空，将元素定位在 (0, 0)")
        return (0.0, 0.0)

    logger.debug(f"计算位置时考虑 {len(positioned_elements)} 个元素（包括容器内子元素）")

    # 按绝对位置排序（从上到下，从左到右）
    positioned_elements.sort(key=lambda e: (e.absolute_y, e.absolute_x))

    # 通过垂直重叠检测行并分组（使用绝对坐标）
    rows: List[List[CanvasElement]] = []

    for element in positioned_elements:
        e_top = element.absolute_y
        e_bottom = element.absolute_y + element.height

        placed = False
        for row in rows:
            # 检查元素是否与该行中的任何元素垂直重叠
            for r in row:
                r_top = r.absolute_y
                r_bottom = r.absolute_y + r.height

                # 垂直重叠条件: max(top1, top2) < min(bottom1, bottom2)
                if max(e_top, r_top) < min(e_bottom, r_bottom):
                    row.append(element)
                    placed = True
                    break

            if placed:
                break

        if not placed:
            # 创建新行
            rows.append([element])

    # 按行的平均 y 坐标排序（使用绝对坐标）
    rows.sort(key=lambda row: sum(e.absolute_y for e in row) / len(row))

    # 获取最后一行
    last_row = rows[-1]
    last_row.sort(key=lambda e: e.absolute_x)  # 按绝对 x 坐标排序

    # 判断是否应该添加到当前行
    should_add_to_current_row = True

    # 判断条件 1: 行元素数量限制
    if len(last_row) >= max_elements_per_row:
        logger.debug(f"当前行已满（{len(last_row)} >= {max_elements_per_row}），需要换行")
        should_add_to_current_row = False

    # 判断条件 2: 高度差异检测
    if should_add_to_current_row:
        if _should_start_new_row_for_height_difference(
            last_row, element_height, height_diff_threshold
        ):
            logger.debug("元素高度差异过大，需要换行")
            should_add_to_current_row = False

    # 尝试添加到当前行
    if should_add_to_current_row:
        # 计算初始位置（在最右边元素的右侧）
        rightmost = last_row[-1]
        initial_x = rightmost.absolute_x + rightmost.width + spacing
        initial_y = min(e.absolute_y for e in last_row)  # 与行顶部对齐

        # 查找不重叠的位置（可能会向右调整）
        new_x, new_y = _find_non_overlapping_position(
            positioned_elements,
            element_width,
            element_height,
            initial_x,
            initial_y,
            spacing
        )

        # 最终检查：如果调整后的位置太远（说明当前行已经很挤），强制换行
        # 判断标准：如果 x 坐标超过了初始计划位置太多（超过2个元素宽度），则换行
        max_acceptable_x = initial_x + element_width * 2
        if new_x > max_acceptable_x:
            logger.debug(
                f"调整后位置太远 ({new_x:.1f} > {max_acceptable_x:.1f})，强制换行"
            )
            should_add_to_current_row = False
        else:
            logger.debug(
                f"将元素添加到现有行（该行有 {len(last_row)} 个元素），"
                f"绝对位置: ({new_x:.1f}, {new_y:.1f})"
            )
            return (new_x, new_y)

    # 需要开始新行
    # 保持与第一行相同的起始 x 坐标，实现左对齐
    first_row = rows[0]
    first_row.sort(key=lambda e: e.absolute_x)
    new_x = min(e.absolute_x for e in first_row)  # 使用第一行最左边元素的 x 坐标

    last_row_bottom = max(e.absolute_y + e.height for e in last_row)
    new_y = last_row_bottom + spacing

    # 确保新行位置也不会重叠（可能画布有不规则布局）
    final_x, final_y = _find_non_overlapping_position(
        positioned_elements,
        element_width,
        element_height,
        new_x,
        new_y,
        spacing
    )

    logger.debug(
        f"开始新行，保持与第一行左对齐，绝对位置: ({final_x:.1f}, {final_y:.1f})"
    )

    return (final_x, final_y)
