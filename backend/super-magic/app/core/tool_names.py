"""内置工具声明兼容：只转换名称，不加载工具或处理调用参数。"""

from collections.abc import Iterable


# 历史名称直接指向当前入口，不串联改名链；同名项表示补齐配套工具。
_TOOL_REPLACEMENTS: dict[str, tuple[str, ...]] = {
    "generate_image": ("generate_images",),
    "multi_edit_file_range": ("find_file_ranges", "edit_file_ranges"),
    "edit_file_ranges": ("find_file_ranges", "edit_file_ranges"),
}


def resolve_tool_names(
    tool_name: str,
    *,
    for_exclusion: bool = False,
) -> tuple[str, ...]:
    """单次解析声明；未知名称保留，由原工具校验器判断是否可用。"""
    # 单独声明 find 只提供查找；排除 find 则同时移除依赖它的范围写入，
    # 否则挂载 edit 时会重新补回 find。旧 single/multi 的排除也覆盖这组。
    if for_exclusion and tool_name == "find_file_ranges":
        return _TOOL_REPLACEMENTS["edit_file_ranges"]
    return _TOOL_REPLACEMENTS.get(tool_name, (tool_name,))


def normalize_tool_names(
    tool_names: Iterable[str],
    *,
    for_exclusion: bool = False,
) -> list[str]:
    """返回去重的新列表，保留显式当前名称的顺序，兼容入口只补缺项。"""
    declared = dict.fromkeys(tool_names)
    normalized: dict[str, None] = {}
    for tool_name in declared:
        for current_name in resolve_tool_names(tool_name, for_exclusion=for_exclusion):
            # 例：旧 image 在前、新 images 在后，保留新声明本来的位置；
            # 已声明 find/edit 的顺序不因再次归一化而改变。
            if current_name != tool_name and current_name in declared:
                continue
            normalized.setdefault(current_name, None)
    return list(normalized)
