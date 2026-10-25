"""File mention handler"""
import os
import re
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from urllib.parse import quote

from app.path_manager import PathManager
from app.service.mention.base import BaseMentionHandler, logger
from app.utils.agfs_mount_path import get_referenced_project_mount_base

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
from app.service.mention.utils.canvas_project_detector import find_parent_canvas_project

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".avif", ".tif", ".tiff"}
_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".webm", ".mkv", ".flv", ".wmv"}
_TEMPORARY_FILE_NOTIFICATION = (
    "These files are stored in `.tmp` and will be removed automatically by the expiration policy. "
    "If any file or derived result must persist, move or copy it to a workspace path outside `.tmp` before "
    "completing the task."
)

_PROJECT_TYPE_LABELS = {
    "design": "canvas",
    "slide": "slide",
}

_PROJECT_TYPE_TIPS = {
    "design": (
        "The referenced file belongs to a Canvas design project. "
        "Use canvas project skill or tools for AI image generation, image search, or design marker processing."
    ),
    "slide": (
        "The referenced file belongs to a Slide project. "
        "Use slide/PPT skill or tools to create, edit, or manage the presentation."
    ),
}


def _file_category(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    if ext in _IMAGE_EXTS:
        return "image"
    if ext in _VIDEO_EXTS:
        return "video"
    return "file"


def _is_temporary_workspace_path(file_path: str) -> bool:
    """判断文件路径是否位于 PathManager 定义的工作区临时目录下。"""
    path = Path(file_path)
    if file_path == "~" or file_path.startswith("~/"):
        path = path.expanduser()
    if not path.is_absolute():
        path = PathManager.get_workspace_dir() / path

    normalized_path = Path(os.path.normpath(str(path)))
    temporary_directory = Path(os.path.normpath(str(PathManager.get_tmp_dir())))
    try:
        normalized_path.relative_to(temporary_directory)
        return True
    except ValueError:
        return False


def _workspace_relative_path(file_path: str) -> Optional[str]:
    """将安全的工作区路径转换为 canonical 相对路径。"""
    raw_path = file_path.strip()
    if not raw_path or raw_path.startswith("~"):
        return None

    normalized_input = raw_path.replace("\\", "/")
    if re.match(r"^[A-Za-z][A-Za-z\d+.-]*:", normalized_input):
        return None
    if ".." in Path(normalized_input).parts:
        return None

    normalized_path = Path(os.path.normpath(normalized_input))
    if normalized_path.is_absolute():
        workspace_path = Path(os.path.normpath(str(PathManager.get_workspace_dir())))
        try:
            normalized_path = normalized_path.relative_to(workspace_path)
        except ValueError:
            return None

    relative_path = normalized_path.as_posix()
    if relative_path.startswith("./"):
        relative_path = relative_path[2:]
    if not relative_path or relative_path == "." or relative_path.startswith("../"):
        return None
    return relative_path


def _referenced_project_absolute_path(file_path: str) -> Optional[str]:
    """验证并保留 Agent 可直接读取的跨项目挂载绝对路径。"""
    raw_path = file_path.strip()
    if not raw_path or "\0" in raw_path:
        return None

    normalized_input = raw_path.replace("\\", "/")
    if ".." in Path(normalized_input).parts:
        return None

    # 跨项目挂载根随 AGFS FUSE 挂载根变化，统一由 agfs_mount_path 解析，
    # 避免这里再维护一份会漂移的默认值。
    normalized_mount_base = Path(os.path.normpath(str(get_referenced_project_mount_base())))
    normalized_path = Path(os.path.normpath(normalized_input))
    if not normalized_mount_base.is_absolute() or not normalized_path.is_absolute():
        return None

    try:
        relative_path = normalized_path.relative_to(normalized_mount_base)
    except ValueError:
        return None

    # 第一段是来源 project_id，后续至少还要包含一个文件路径段。
    if len(relative_path.parts) < 2 or any(
        not part or part in {".", ".."} for part in relative_path.parts
    ):
        return None
    if not re.fullmatch(r"[1-9][0-9]*", relative_path.parts[0]):
        return None
    return normalized_path.as_posix()


def _markdown_label(value: str) -> str:
    return " ".join(value.split()).replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")


def _encode_markdown_path(path: str) -> Optional[str]:
    if any(ord(char) < 0x20 or ord(char) == 0x7F for char in path):
        return None

    replacements = str.maketrans({"%": "%25", "#": "%23", "?": "%3F", "<": "%3C", ">": "%3E"})
    return "/".join(segment.translate(replacements) for segment in path.split("/"))


def _canonical_file_link(file_path: str, file_name: str, *, is_directory: bool = False) -> Optional[str]:
    # 用户根使用运行中的沙盒 HOME；不把服务器配置或开发机路径写进引用。
    user_prefix = Path.home().as_posix().rstrip("/") + "/"
    if file_path.startswith(user_prefix) and not _workspace_relative_path(file_path):
        file_path = "~/" + file_path[len(user_prefix):]
    if file_path.startswith("~"):
        if not file_path.startswith("~/"):
            return None
        relative_user_path = file_path[2:].rstrip("/")
        if (
            not relative_user_path
            or any(part in {"", ".", ".."} for part in relative_user_path.split("/"))
            or any(ord(char) < 0x20 or ord(char) == 0x7F for char in relative_user_path)
        ):
            return None
        label = _markdown_label(file_name or Path(relative_user_path).name)
        destination = quote(user_prefix + relative_user_path, safe="/")
        return f"[{label}]({destination}{'/' if is_directory else ''})"

    relative_path = _workspace_relative_path(file_path)
    if relative_path:
        destination = f"./{relative_path}"
        fallback_name = Path(relative_path).name
    else:
        absolute_path = _referenced_project_absolute_path(file_path)
        if not absolute_path:
            return None
        destination = absolute_path
        fallback_name = Path(absolute_path).name

    encoded_path = _encode_markdown_path(destination)
    if not encoded_path:
        return None
    if is_directory:
        encoded_path += "/"

    label = _markdown_label(file_name or fallback_name)
    if " " in encoded_path:
        return f"[{label}](<{encoded_path}>)"
    return f"[{label}]({encoded_path})"


class FileHandler(BaseMentionHandler):
    """处理文件类型的mention（file、project_file、upload_file）"""

    def __init__(self) -> None:
        """初始化当前构建周期内的临时文件路径集合。"""
        self._temporary_file_paths: List[str] = []

    def get_type(self) -> str:
        return "file"

    async def get_tip(self, mention: Dict[str, Any], agent_context: Optional["AgentContext"] = None) -> str:
        file_path = mention.get("file_path", "") or ""
        if mention.get("type") == "user_file" or file_path.startswith("~/"):
            return "Read and understand the referenced file or directory before proceeding"
        _, project_type = await find_parent_canvas_project(file_path)
        if project_type and project_type in _PROJECT_TYPE_TIPS:
            return _PROJECT_TYPE_TIPS[project_type]
        return "Read and understand the referenced file or directory before proceeding"

    async def get_final_tip(self, agent_context: Optional["AgentContext"] = None) -> str:
        """在全部文件 mention 处理完成后统一生成临时文件提示。"""
        if not self._temporary_file_paths:
            return ""

        notification = self._build_temporary_file_notification()
        self._temporary_file_paths.clear()
        if agent_context is not None:
            try:
                agent_context.horizon.push_notification(
                    "temporary_file_mention",
                    notification,
                )
                return ""
            except Exception as error:
                logger.warning(f"推送临时文件 Horizon 通知失败: {error}")
        return f"{notification}\n\nRead and understand the referenced files before proceeding."

    async def extract_image_refs(
        self,
        mention: Dict[str, Any],
        agent_context: Optional["AgentContext"] = None,
    ) -> List[str]:
        """从文件 mention 中提取可用于原生视觉的图片路径。"""
        attrs = mention.get("attrs", {})
        if not isinstance(attrs, dict):
            attrs = {}
        data = attrs.get("data", {})
        if not isinstance(data, dict):
            data = {}

        file_path = (
            mention.get("file_path")
            or mention.get("relative_file_path")
            or data.get("file_path")
            or data.get("relative_file_path")
        )
        if not isinstance(file_path, str) or not file_path.strip():
            return []
        file_path = file_path.strip()

        extension = mention.get("file_extension") or data.get("file_extension")
        if not isinstance(extension, str) or not extension.strip():
            file_name = mention.get("file_name") or data.get("file_name") or file_path
            extension = Path(str(file_name)).suffix
        extension = str(extension).strip().lower()
        if extension and not extension.startswith("."):
            extension = f".{extension}"

        return [file_path] if extension in _IMAGE_EXTS else []

    def _build_temporary_file_notification(self) -> str:
        """构建包含临时文件列表的统一英文提示。"""
        file_list = "\n".join(f"- `{file_path}`" for file_path in self._temporary_file_paths)
        return (
            "The user directly submitted the following files through the chat input:\n"
            f"{file_list}\n\n{_TEMPORARY_FILE_NOTIFICATION}"
        )

    async def handle(self, mention: Dict[str, Any], index: int, agent_context: Optional["AgentContext"] = None) -> List[str]:
        file_path = mention.get("file_path", "") or ""
        file_name = str(mention.get("file_name") or "").strip()
        file_url = mention.get("file_url", "")

        if _is_temporary_workspace_path(file_path) and file_path not in self._temporary_file_paths:
            self._temporary_file_paths.append(file_path)

        canonical_link = _canonical_file_link(file_path, file_name)
        if canonical_link:
            context_lines = [f"{index}. {canonical_link}"]
        else:
            readable_reference = file_path or file_url or "missing file path"
            context_lines = [
                f"{index}. File reference (not a valid workspace-relative link): {readable_reference}"
            ]

        if mention.get("type") == "user_file" or file_path.startswith("~/"):
            project_path, project_type = None, None
        else:
            project_path, project_type = await find_parent_canvas_project(file_path)
        if project_path and project_type:
            project_label = _PROJECT_TYPE_LABELS.get(project_type, project_type)
            category = _file_category(file_path)
            context_lines.append(f"   - Project ({project_label}): {project_path}")
            context_lines.append(f"   - File type: {project_label} {category}")

        if file_url:
            context_lines.append(f"   - URL: {file_url}")

        logger.info(
            f"用户prompt添加文件引用: {file_path}"
            + (f" (所属项目: {project_path})" if project_path else "")
        )

        return context_lines
