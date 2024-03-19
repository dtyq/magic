"""工具函数"""
import json
import csv
import io
from typing import Any, List, Dict
from pathlib import Path


def format_output(data: Any, format_type: str = 'json') -> str:
    """格式化输出数据

    Args:
        data: 要输出的数据
        format_type: 输出格式 (json, csv)

    Returns:
        格式化后的字符串
    """
    if format_type == 'csv':
        return _format_as_csv(data)
    else:
        return json.dumps(data, ensure_ascii=False, indent=2)


def _format_as_csv(data: Dict[str, Any]) -> str:
    """将数据格式化为 CSV

    Args:
        data: 要格式化的数据（包含 tools 或 skills 列表）

    Returns:
        CSV 格式的字符串
    """
    output = io.StringIO()

    # 检测数据类型
    if 'tools' in data:
        # Tools 格式
        items = data['tools']
        if items:
            writer = csv.DictWriter(output, fieldnames=['name', 'description'])
            writer.writeheader()
            writer.writerows(items)
    elif 'skills' in data:
        # Skills 格式
        items = data['skills']
        if items:
            # 获取所有字段
            fieldnames = list(items[0].keys()) if items else []
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(items)

    return output.getvalue()


def get_project_root() -> Path:
    """获取项目根目录

    Returns:
        项目根目录路径
    """
    # bin/super_magic/utils.py -> bin/ -> project_root
    return Path(__file__).resolve().parent.parent.parent


def get_config_path() -> Path:
    """获取配置文件路径

    Returns:
        tool_definitions.json 路径
    """
    return get_project_root() / "config" / "tool_definitions.json"


def get_skills_dirs() -> List[Path]:
    """获取 skills 目录列表

    Returns:
        skills 目录路径列表
    """
    return [
        get_project_root() / "agents" / "skills",
        # 未来可以添加更多目录，例如：
        # Path.home() / ".magic" / "skills",  # 用户自定义 skills
    ]


def truncate_text(text: str, max_length: int = 80) -> str:
    """截断文本

    Args:
        text: 原始文本
        max_length: 最大长度

    Returns:
        截断后的文本
    """
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."
