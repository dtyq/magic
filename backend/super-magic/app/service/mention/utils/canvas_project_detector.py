"""画布项目检测工具函数

在 mention 处理中共享使用，避免 FileHandler / ProjectDirectoryHandler 相互耦合。
"""
import json
import re
from pathlib import Path
from typing import Optional, Tuple

from agentlang.logger import get_logger
from agentlang.path_manager import PathManager
from app.utils.async_file_utils import async_exists, async_read_text

logger = get_logger(__name__)

MAGIC_PROJECT_FILE = "magic.project.js"


async def detect_project_type(directory_path: str) -> Optional[str]:
    """检测指定目录是否为某种项目类型。

    读取目录下的 magic.project.js 获取 type 字段。

    Args:
        directory_path: 工作区相对目录路径

    Returns:
        项目类型字符串（如 'design'、'slide'），不是项目则返回 None
    """
    try:
        workspace_dir = PathManager.get_workspace_dir()
        project_file = workspace_dir / directory_path / MAGIC_PROJECT_FILE
        if not await async_exists(project_file):
            return None

        content = await async_read_text(project_file, encoding="utf-8")
        if not content or not content.strip():
            return None

        json_str = _extract_json_from_jsonp(content)
        if not json_str:
            return None

        data = json.loads(json_str)
        return data.get("type") or None

    except json.JSONDecodeError as e:
        logger.warning(f"解析 {MAGIC_PROJECT_FILE} 失败: {e}, 目录: {directory_path}")
        return None
    except Exception as e:
        logger.warning(f"读取 {MAGIC_PROJECT_FILE} 失败: {e}, 目录: {directory_path}")
        return None


async def find_parent_canvas_project(file_path: str) -> Tuple[Optional[str], Optional[str]]:
    """从文件路径向上查找其所属的画布项目目录。

    Args:
        file_path: 工作区相对文件路径

    Returns:
        (project_path, project_type)，不属于任何项目则返回 (None, None)
    """
    if not file_path:
        return None, None
    try:
        path = Path(file_path)
        for parent in path.parents:
            parent_str = str(parent.as_posix())
            # 遇到根节点退出
            if parent_str in (".", ""):
                break
            project_type = await detect_project_type(parent_str)
            if project_type:
                return parent_str, project_type
    except Exception as e:
        logger.warning(f"查找父级项目时出错: {e}, 文件: {file_path}")
    return None, None


def _extract_json_from_jsonp(content: str) -> Optional[str]:
    """从 JSONP 格式中提取 JSON 字符串。"""
    patterns = [
        r"window\.magicProjectConfig\s*=\s*({[\s\S]*})(?:\s*;|\s*$)",
        r"magicProjectConfig\s*=\s*({[\s\S]*})(?:\s*;|\s*$)",
        r"window\.magicProjectConfig\s*=\s*({[\s\S]*?});",
        r"magicProjectConfig\s*=\s*({[\s\S]*?});",
    ]
    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            return match.group(1)
    return None
