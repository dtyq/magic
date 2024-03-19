"""Dashboard卡片管理共享工具函数

提供卡片解析、序列化、布局计算、碰撞检测等核心功能
"""

import re
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from agentlang.logger import get_logger

logger = get_logger(__name__)


# 卡片类型常量
VALID_CARD_TYPES = ["metric", "table", "markdown", "echarts"]
GRID_COLS = 24  # 默认栅格列数

# 按类型排序：metric → echarts → table → markdown
_TYPE_ORDER = {"metric": 0, "echarts": 1, "table": 2, "markdown": 3}

# 标准尺寸：(每行数量, 高度)，w = grid_cols // 每行数量
_DEFAULT_SIZES: Dict[str, Tuple[int, int]] = {
    "metric": (6, 3),
    "echarts": (3, 8),
    "table": (2, 8),  # 表格高度与 echarts 一致
    "markdown": (2, 6),
}


def get_grid_cols_from_config(project_dir: Path) -> int:
    """从 config.js 读取 GRID_COLS 配置

    Args:
        project_dir: 项目目录路径

    Returns:
        int: GRID_COLS 值，读取失败时返回默认值 GRID_COLS
    """
    config_path = project_dir / "config.js"
    if not config_path.exists():
        logger.warning("config.js 不存在，使用默认 GRID_COLS=%d", GRID_COLS)
        return GRID_COLS
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read()
        pattern = r'["\']?GRID_COLS["\']?\s*:\s*(\d+)'
        match = re.search(pattern, content)
        if match:
            return int(match.group(1))
    except Exception as e:
        logger.warning("读取 config.js GRID_COLS 失败: %s，使用默认值", e)
    return GRID_COLS


def _redistribute_row_evenly(row_cards: List[Dict[str, Any]], grid_cols: int) -> None:
    """将一行内的卡片平均分配宽度，使每行铺满且不超出 grid_cols。

    全部使用整数、向下取整，保证 sum(w) == grid_cols，避免换行。
    余数优先分配给前面的卡片。
    """
    if not row_cards:
        return
    n = len(row_cards)
    base_w = grid_cols // n  # 向下取整
    remainder = grid_cols % n
    x = 0
    for i, card in enumerate(row_cards):
        w = base_w + (1 if i < remainder else 0)
        card["layout"]["x"] = x
        card["layout"]["w"] = w
        x += w


def compute_auto_layout(
    existing_cards: List[Dict[str, Any]],
    new_cards: List[Dict[str, Any]],
    grid_cols: int,
) -> None:
    """为待添加的卡片自动计算 layout，保证横向铺满无空隙

    按类型顺序（metric → echarts → table → markdown）从左到右、从上到下放置，
    每行铺满 grid_cols，无重叠无空隙。直接修改 new_cards 中每项的 layout。

    Args:
        existing_cards: 现有卡片列表（已有 layout）
        new_cards: 待添加的卡片列表（将被赋予 layout）
        grid_cols: 栅格列数
    """
    if not new_cards:
        return

    max_y = 0
    if existing_cards:
        max_y = max(
            c["layout"]["y"] + c["layout"]["h"]
            for c in existing_cards
            if c.get("layout")
        )

    sorted_cards = sorted(
        new_cards,
        key=lambda c: (_TYPE_ORDER.get(c.get("type", ""), 99), c.get("id", "")),
    )

    current_x = 0
    current_y = max_y
    row_max_h = 0
    row_cards: List[Dict[str, Any]] = []

    for card in sorted_cards:
        card_type = card.get("type", "echarts")
        per_row, default_h = _DEFAULT_SIZES.get(
            card_type, _DEFAULT_SIZES["echarts"]
        )
        w = grid_cols // per_row
        h = default_h

        # 若放入后本行将换行，且本行有剩余列，则扩展当前卡片以铺满
        next_x = current_x + w
        if next_x > grid_cols and current_x > 0:
            w = grid_cols - current_x
            next_x = grid_cols

        card["layout"] = {
            "x": current_x,
            "y": current_y,
            "w": w,
            "h": h,
        }
        row_cards.append(card)
        row_max_h = max(row_max_h, h)
        current_x = next_x

        if current_x >= grid_cols:
            current_x = 0
            current_y += row_max_h
            row_max_h = 0
            row_cards = []

    # 最后一行若未铺满，平均分配该行所有卡片的宽度（整数、向下取整，保证不超出 grid）
    if row_cards and current_x > 0:
        _redistribute_row_evenly(row_cards, grid_cols)


class CardParseError(Exception):
    """卡片解析错误"""
    pass


class CardValidationError(Exception):
    """卡片验证错误"""
    pass


def parse_data_js(file_path: Path) -> Tuple[List[Dict[str, Any]], str]:
    """解析data.js文件，提取卡片数组和原始内容
    
    Args:
        file_path: data.js文件路径
        
    Returns:
        Tuple[List[Dict], str]: (卡片列表, 原始文件内容)
        
    Raises:
        CardParseError: 解析失败时抛出
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 提取DASHBOARD_CARDS数组
        cards = _extract_cards_from_content(content)
        
        return cards, content
        
    except Exception as e:
        logger.error(f"Failed to parse data.js: {e}", exc_info=True)
        raise CardParseError(f"Failed to parse data.js: {str(e)}")


def _extract_cards_from_content(content: str) -> List[Dict[str, Any]]:
    """从data.js内容中提取卡片数组
    
    Args:
        content: data.js文件内容
        
    Returns:
        List[Dict]: 卡片列表
    """
    cards = []
    
    # 匹配卡片对象的正则表达式
    # 匹配格式：{ id: "xxx", type: "xxx", ... }
    card_pattern = r'\{\s*id:\s*["\']([^"\']+)["\'].*?\}'
    
    # 找到DASHBOARD_CARDS数组的开始和结束位置
    array_start = content.find('const DASHBOARD_CARDS = [')
    if array_start == -1:
        array_start = content.find('DASHBOARD_CARDS = [')
    
    if array_start == -1:
        logger.warning("DASHBOARD_CARDS array not found, returning empty list")
        return []
    
    # 找到数组结束位置（匹配对应的]）
    bracket_count = 0
    array_content_start = content.find('[', array_start)
    i = array_content_start
    array_end = -1
    
    while i < len(content):
        if content[i] == '[':
            bracket_count += 1
        elif content[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                array_end = i
                break
        i += 1
    
    if array_end == -1:
        raise CardParseError("Could not find end of DASHBOARD_CARDS array")
    
    array_content = content[array_content_start:array_end + 1]
    
    # 解析每个卡片对象
    cards = _parse_card_objects(array_content)
    
    return cards


def _parse_card_objects(array_content: str) -> List[Dict[str, Any]]:
    """解析卡片对象数组
    
    Args:
        array_content: 数组内容字符串
        
    Returns:
        List[Dict]: 卡片列表
    """
    cards = []
    
    # 使用正则表达式提取每个卡片对象
    # 匹配 { ... } 对象
    brace_level = 0
    card_start = -1
    
    for i, char in enumerate(array_content):
        if char == '{':
            if brace_level == 0:
                card_start = i
            brace_level += 1
        elif char == '}':
            brace_level -= 1
            if brace_level == 0 and card_start != -1:
                # 找到一个完整的卡片对象
                card_str = array_content[card_start:i + 1]
                card = _parse_single_card(card_str)
                if card:
                    cards.append(card)
                card_start = -1
    
    return cards


def _parse_single_card(card_str: str) -> Optional[Dict[str, Any]]:
    """解析单个卡片对象字符串
    
    Args:
        card_str: 卡片对象字符串
        
    Returns:
        Optional[Dict]: 卡片字典，解析失败返回None
    """
    try:
        card = {}
        
        # 提取id
        id_match = re.search(r'id:\s*["\']([^"\']+)["\']', card_str)
        if id_match:
            card['id'] = id_match.group(1)
        else:
            return None
        
        # 提取type
        type_match = re.search(r'type:\s*["\']([^"\']+)["\']', card_str)
        if type_match:
            card['type'] = type_match.group(1)
        
        # 提取source
        source_match = re.search(r'source:\s*["\']([^"\']+)["\']', card_str)
        if source_match:
            card['source'] = source_match.group(1)
        
        # 提取title (可选)
        title_match = re.search(r'title:\s*["\']([^"\']+)["\']', card_str)
        if title_match:
            card['title'] = title_match.group(1)
        
        # 提取titleAlign (可选)
        title_align_match = re.search(r'titleAlign:\s*["\']([^"\']+)["\']', card_str)
        if title_align_match:
            card['titleAlign'] = title_align_match.group(1)
        
        # 提取layout
        layout_match = re.search(
            r'layout:\s*\{\s*x:\s*(\d+)\s*,\s*y:\s*(\d+)\s*,\s*w:\s*(\d+)\s*,\s*h:\s*(\d+)\s*\}',
            card_str
        )
        if layout_match:
            card['layout'] = {
                'x': int(layout_match.group(1)),
                'y': int(layout_match.group(2)),
                'w': int(layout_match.group(3)),
                'h': int(layout_match.group(4))
            }
        
        # 提取getCardData函数
        # 使用大括号平衡来匹配完整的函数体，避免非贪婪匹配导致的内容丢失
        get_card_data_start = card_str.find('getCardData:')
        if get_card_data_start != -1:
            # 找到 getCardData: 后面的函数开始位置
            func_start_pos = card_str.find('async', get_card_data_start)
            if func_start_pos == -1:
                func_start_pos = card_str.find('function', get_card_data_start)
            
            if func_start_pos != -1:
                # 找到函数体的开始大括号
                brace_start = card_str.find('{', func_start_pos)
                if brace_start != -1:
                    # 使用大括号平衡来找到函数体的结束位置
                    brace_count = 0
                    i = brace_start
                    func_end_pos = -1
                    
                    while i < len(card_str):
                        if card_str[i] == '{':
                            brace_count += 1
                        elif card_str[i] == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                # 找到匹配的闭合大括号
                                func_end_pos = i + 1
                                break
                        i += 1
                    
                    if func_end_pos != -1:
                        # 提取完整的函数体
                        func_str = card_str[func_start_pos:func_end_pos].strip()
                        # 移除末尾可能的多余字符（逗号、空格等）
                        func_str = func_str.rstrip(', \t\n')
                        card['getCardData'] = func_str
        
        return card
        
    except Exception as e:
        logger.warning(f"Failed to parse card object: {e}")
        return None


# 缩进常量：卡片2空格，字段4空格，getCardData函数体+2空格
_INDENT_CARD = 2
_INDENT_FIELD = 4
_INDENT_GET_CARD_DATA_BODY = 2


def serialize_cards(cards: List[Dict[str, Any]]) -> str:
    """将卡片列表序列化为data.js内容

    在生成阶段直接输出正确格式，不依赖 jsbeautifier 后处理。
    缩进规则：卡片2空格，字段4空格，layout单行，getCardData函数体6空格。
    """
    card_strings = [_serialize_single_card(card) for card in cards]
    cards_array = ',\n'.join(card_strings)

    return f"""// Dashboard data configuration
const DASHBOARD_CARDS = [
{cards_array}
];

window.DASHBOARD_CARDS = DASHBOARD_CARDS;
"""


def _remove_trailing_extra_brace(s: str) -> str:
    """移除末尾多余的卡片闭合括号。

    序列化时会在卡片对象末尾添加 `}`，若 getCardData 已带多余的 `}` 会导致重复闭合。
    通过大括号平衡判断：若最后一行是单独的 `}` 且移除后平衡，则视为多余。
    """
    lines = s.rstrip().split('\n')
    if len(lines) < 2:
        return s
    last_line = lines[-1].strip()
    if last_line != '}':
        return s
    test_s = '\n'.join(lines[:-1]).rstrip()
    if test_s.count('{') == test_s.count('}'):
        return test_s
    return s


def _normalize_get_card_data(get_card_data: str) -> str:
    """规范化 getCardData 字符串。

    1. 移除末尾多余的卡片闭合括号
    2. 使用 jsbeautifier 规范化函数体缩进（处理复杂 JS 语法）
    3. 返回格式：首行无缩进，函数体内容 4 空格起，序列化时再加 4 空格字段缩进
    """
    s = _remove_trailing_extra_brace(get_card_data.rstrip())

    try:
        # 延迟导入 jsbeautifier，避免模块未安装时影响其他功能
        import jsbeautifier  # type: ignore
        
        opts = jsbeautifier.default_options()
        opts.indent_size = _INDENT_GET_CARD_DATA_BODY
        opts.indent_char = ' '
        opts.preserve_newlines = True
        opts.max_preserve_newlines = 2
        opts.keep_array_indentation = False
        opts.brace_style = "collapse"

        formatted = jsbeautifier.beautify(s, opts)
        lines = formatted.split('\n')
        if not lines:
            return s

        # 找到最后一个非空行索引，用于唯一识别函数体闭合 }
        last_non_empty_idx = -1
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].strip():
                last_non_empty_idx = i
                break

        result_lines = []
        brace_count = 0
        first_line_done = False

        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped:
                result_lines.append('')
                continue

            line_brace_change = line.count('{') - line.count('}')
            # 仅当大括号平衡且是最后一个非空行时，才视为函数体闭合（避免嵌套 } 误判）
            is_last_brace = i == last_non_empty_idx and stripped == '}'
            will_close_function = (
                stripped == '}' and
                (brace_count + line_brace_change) == 0 and
                is_last_brace
            )

            if not first_line_done:
                result_lines.append(line.lstrip())
                first_line_done = True
                brace_count += line.count('{') - line.count('}')
            elif will_close_function:
                result_lines.append('}')
                brace_count = 0
            else:
                result_lines.append(line)
                brace_count += line_brace_change

        return '\n'.join(result_lines)

    except Exception as e:
        logger.warning(f"jsbeautifier 格式化 getCardData 失败，使用原始内容: {e}")
        lines = s.split('\n')
        if lines and lines[0].strip():
            lines[0] = lines[0].lstrip()
        return '\n'.join(lines)


def _serialize_layout(layout: Dict[str, int]) -> str:
    """序列化 layout 对象为单行格式。"""
    return f'    layout: {{ x: {layout["x"]}, y: {layout["y"]}, w: {layout["w"]}, h: {layout["h"]} }},'


def _serialize_get_card_data(get_card_data: str) -> List[str]:
    """序列化 getCardData 字段，返回行列表。

    规范化后格式：首行无缩进，函数体 4 空格起，闭合 } 无缩进。
    序列化时：字段缩进 4 空格，body 行再加 4 空格（保持相对缩进）。
    """
    normalized = _normalize_get_card_data(get_card_data)
    field_indent = ' ' * _INDENT_FIELD
    lines = normalized.split('\n')

    if len(lines) == 1:
        return [f'{field_indent}getCardData: {normalized}']

    result = [f'{field_indent}getCardData: {lines[0]}']
    for line in lines[1:]:
        if line.strip():
            result.append(field_indent + line)
        else:
            result.append('')
    return result


def _serialize_single_card(card: Dict[str, Any]) -> str:
    """序列化单个卡片对象，直接输出正确缩进格式。"""
    lines = ['  {']

    lines.append(f'    id: "{card["id"]}",')
    lines.append(f'    type: "{card["type"]}",')
    lines.append(f'    source: "{card["source"]}",')

    if 'title' in card and card['title']:
        title = card['title'].replace('"', '\\"')
        lines.append(f'    title: "{title}",')

    if 'titleAlign' in card and card['titleAlign']:
        lines.append(f'    titleAlign: "{card["titleAlign"]}",')

    lines.append(_serialize_layout(card['layout']))
    lines.extend(_serialize_get_card_data(card['getCardData']))
    lines.append('  }')

    return '\n'.join(lines)


def validate_card_structure(card: Dict[str, Any], existing_ids: Optional[List[str]] = None) -> None:
    """验证卡片结构的完整性和合法性
    
    Args:
        card: 卡片字典
        existing_ids: 现有卡片ID列表（用于检查唯一性）
        
    Raises:
        CardValidationError: 验证失败时抛出
    """
    # 检查必需字段
    required_fields = ['id', 'type', 'source', 'layout', 'getCardData']
    for field in required_fields:
        if field not in card:
            raise CardValidationError(f"Missing required field: {field}")
    
    # 验证ID唯一性
    if existing_ids and card['id'] in existing_ids:
        raise CardValidationError(f"Card ID already exists: {card['id']}")
    
    # 验证type
    if card['type'] not in VALID_CARD_TYPES:
        raise CardValidationError(
            f"Invalid card type: {card['type']}. Must be one of {VALID_CARD_TYPES}"
        )
    
    # 验证source格式
    if not card['source'].startswith('./cleaned_data/'):
        raise CardValidationError(
            f"Invalid source path: {card['source']}. Must start with './cleaned_data/'"
        )
    
    # 验证layout
    _validate_layout(card['layout'])
    
    # 验证titleAlign (如果存在)
    if 'titleAlign' in card and card['titleAlign']:
        valid_aligns = ['left', 'center', 'right']
        if card['titleAlign'] not in valid_aligns:
            raise CardValidationError(
                f"Invalid titleAlign: {card['titleAlign']}. Must be one of {valid_aligns}"
            )


def _validate_layout(layout: Dict[str, int]) -> None:
    """验证layout对象的合法性
    
    Args:
        layout: layout字典
        
    Raises:
        CardValidationError: 验证失败时抛出
    """
    required_keys = ['x', 'y', 'w', 'h']
    for key in required_keys:
        if key not in layout:
            raise CardValidationError(f"Missing layout field: {key}")
        
        # 检查是否为整数
        if not isinstance(layout[key], int):
            raise CardValidationError(f"Layout field {key} must be an integer, got {type(layout[key])}")
        
        # 检查是否为非负整数
        if layout[key] < 0:
            raise CardValidationError(f"Layout field {key} must be non-negative, got {layout[key]}")
    
    # 检查w和h至少为1
    if layout['w'] < 1:
        raise CardValidationError(f"Layout width (w) must be at least 1, got {layout['w']}")
    if layout['h'] < 1:
        raise CardValidationError(f"Layout height (h) must be at least 1, got {layout['h']}")
    
    # 检查x + w不超过GRID_COLS
    if layout['x'] + layout['w'] > GRID_COLS:
        raise CardValidationError(
            f"Layout exceeds grid width: x({layout['x']}) + w({layout['w']}) = {layout['x'] + layout['w']} > {GRID_COLS}"
        )


def validate_getCardData_syntax(get_card_data: str, card_id: str) -> None:
    """验证getCardData函数的JavaScript语法
    
    Args:
        get_card_data: getCardData函数代码字符串
        card_id: 卡片ID（用于错误信息）
        
    Raises:
        CardValidationError: 语法验证失败时抛出
    """
    try:
        # 创建临时JS文件
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False, encoding='utf-8') as f:
            # 包装函数以便node可以检查语法
            test_code = f"const getCardData = {get_card_data};"
            f.write(test_code)
            temp_file = f.name
        
        # 使用node -c检查语法
        result = subprocess.run(
            ['node', '-c', temp_file],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        # 删除临时文件
        Path(temp_file).unlink()
        
        if result.returncode != 0:
            error_msg = result.stderr.strip()
            raise CardValidationError(
                f"Invalid JavaScript syntax in getCardData for card '{card_id}': {error_msg}"
            )
            
    except subprocess.TimeoutExpired:
        raise CardValidationError(f"Syntax check timeout for card '{card_id}'")
    except FileNotFoundError:
        logger.warning("Node.js not found, skipping syntax validation")
    except Exception as e:
        if isinstance(e, CardValidationError):
            raise
        logger.warning(f"Failed to validate getCardData syntax: {e}")


def collides(l1: Dict[str, int], l2: Dict[str, int]) -> bool:
    """检测两个layout是否重叠
    
    Args:
        l1: 第一个layout
        l2: 第二个layout
        
    Returns:
        bool: 是否重叠
    """
    # l1在l2左边
    if l1['x'] + l1['w'] <= l2['x']:
        return False
    # l1在l2右边
    if l1['x'] >= l2['x'] + l2['w']:
        return False
    # l1在l2上边
    if l1['y'] + l1['h'] <= l2['y']:
        return False
    # l1在l2下边
    if l1['y'] >= l2['y'] + l2['h']:
        return False
    # 重叠
    return True


def compact_layout(cards: List[Dict[str, Any]], grid_cols: int = GRID_COLS) -> List[Dict[str, Any]]:
    """垂直压缩布局，移除卡片间的空隙
    
    参考react-grid-layout的compact算法
    
    Args:
        cards: 卡片列表
        grid_cols: 栅格列数
        
    Returns:
        List[Dict]: 压缩后的卡片列表
    """
    if not cards:
        return []
    
    # 1. 按y值排序（y相同时按x排序）
    sorted_cards = sorted(cards, key=lambda c: (c['layout']['y'], c['layout']['x']))
    
    # 2. 逐个处理卡片，尽可能向上移动
    result = []
    for card in sorted_cards:
        # 创建卡片副本
        card_copy = card.copy()
        card_copy['layout'] = card['layout'].copy()
        
        # 尝试将卡片向上移动到最高可能位置
        target_y = 0
        while target_y < card_copy['layout']['y']:
            # 检查在target_y位置是否会碰撞
            test_layout = card_copy['layout'].copy()
            test_layout['y'] = target_y
            
            has_collision = False
            for other_card in result:
                if collides(test_layout, other_card['layout']):
                    has_collision = True
                    break
            
            if not has_collision:
                card_copy['layout']['y'] = target_y
                break
            
            target_y += 1
        
        result.append(card_copy)
    
    return result


def push_down_colliding_cards(
    cards: List[Dict[str, Any]],
    inserted_card: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """插入新卡片时，将重叠的卡片向下推移
    
    Args:
        cards: 现有卡片列表
        inserted_card: 要插入的新卡片
        
    Returns:
        Tuple[List[Dict], List[str]]: (更新后的卡片列表, 受影响的卡片ID列表)
    """
    affected_ids = []
    result = []
    
    for card in cards:
        card_copy = card.copy()
        card_copy['layout'] = card['layout'].copy()
        
        # 检查是否与插入的卡片碰撞
        if collides(inserted_card['layout'], card_copy['layout']):
            # 计算需要推移的距离
            inserted_bottom = inserted_card['layout']['y'] + inserted_card['layout']['h']
            current_top = card_copy['layout']['y']
            
            if inserted_bottom > current_top:
                push_distance = inserted_bottom - current_top
                card_copy['layout']['y'] += push_distance
                affected_ids.append(card['id'])
        
        result.append(card_copy)
    
    return result, affected_ids


def get_layout_bounds(cards: List[Dict[str, Any]]) -> Dict[str, int]:
    """获取布局的边界信息
    
    Args:
        cards: 卡片列表
        
    Returns:
        Dict: 边界信息 {min_x, max_x, min_y, max_y, max_bottom}
    """
    if not cards:
        return {'min_x': 0, 'max_x': 0, 'min_y': 0, 'max_y': 0, 'max_bottom': 0}
    
    min_x = min(card['layout']['x'] for card in cards)
    max_x = max(card['layout']['x'] + card['layout']['w'] for card in cards)
    min_y = min(card['layout']['y'] for card in cards)
    max_y = max(card['layout']['y'] for card in cards)
    max_bottom = max(card['layout']['y'] + card['layout']['h'] for card in cards)
    
    return {
        'min_x': min_x,
        'max_x': max_x,
        'min_y': min_y,
        'max_y': max_y,
        'max_bottom': max_bottom
    }


def count_cards_by_type(cards: List[Dict[str, Any]]) -> Dict[str, int]:
    """统计各类型卡片的数量
    
    Args:
        cards: 卡片列表
        
    Returns:
        Dict[str, int]: 类型统计 {"metric": 5, "echarts": 10, ...}
    """
    counts = {card_type: 0 for card_type in VALID_CARD_TYPES}
    
    for card in cards:
        card_type = card.get('type')
        if card_type in counts:
            counts[card_type] += 1
    
    return counts
