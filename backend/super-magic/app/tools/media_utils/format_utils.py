"""媒体来源格式化工具函数。"""

import re


def extract_media_source_name(source: str) -> str:
    """从媒体来源提取可读名称。

    - HTTP/HTTPS URL：返回 URL 路径中的文件名部分（去除查询参数）
    - 本地文件路径：返回原始路径（已是相对工作区的路径，保留完整路径更易识别）

    Args:
        source: 媒体来源，可以是 URL 或本地文件路径

    Returns:
        str: 可读名称；无法提取时返回原始来源字符串
    """
    if re.match(r'^https?://', source):
        file_name = source.split('/')[-1].split('?')[0]
        return file_name if file_name else source
    return source
