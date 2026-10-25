"""发布链路：把用户创建的数字员工（Crew）/ Skill 打包上传到对象存储。

流程：读工作区 frontmatter → 打 zip → 上传 → 返回 file_key + metadata。
metadata 供上游写入数据库，由前端用于展示和检索。

这条链路不参与运行时 .agent 编译，也不读 crew.template.agent / claw.template.agent。
完整链路说明见 agents/AGENT_RUNTIME_AND_PUBLISH_GUIDE.md。
"""

import os
import asyncio
import hashlib
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, Optional

import yaml
from loguru import logger

from app.path_manager import PathManager
from app.service.slides_template_export_service import export_slides_template


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_frontmatter(content: str) -> Optional[Dict[str, Any]]:
    """Parse YAML frontmatter delimited by '---' from markdown file content.

    Returns the parsed dict, or None if frontmatter is absent or invalid.
    """
    lines = content.split("\n")
    if not lines or lines[0].strip() != "---":
        return None

    end_index = -1
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_index = i
            break

    if end_index == -1:
        return None

    yaml_content = "\n".join(lines[1:end_index])
    try:
        return yaml.safe_load(yaml_content) or {}
    except yaml.YAMLError as exc:
        logger.warning(f"Failed to parse YAML frontmatter: {exc}")
        return None


def _read_frontmatter(file_path: Path) -> Optional[Dict[str, Any]]:
    """Read a file and return its parsed YAML frontmatter.

    Returns None if the file does not exist, cannot be read, or has no valid frontmatter.
    """
    if not file_path.exists():
        return None
    try:
        content = file_path.read_text(encoding="utf-8")
        return _parse_frontmatter(content)
    except Exception as exc:
        logger.warning(f"Failed to read {file_path}: {exc}")
        return None


def _build_i18n(default: str = "", zh_cn: str = "", en_us: str = "") -> Dict[str, str]:
    """Build an i18n dict with en_US, zh_CN, and default keys."""
    return {"en_US": en_us, "zh_CN": zh_cn, "default": default}


def _str(value: Any) -> str:
    """Convert a value to str, returning '' for None."""
    return "" if value is None else str(value)


def _get_field(fm: Dict[str, Any], *keys: str) -> str:
    """Return the first non-empty string value found among the given keys in the dict."""
    for key in keys:
        val = fm.get(key)
        if val is not None:
            return _str(val)
    return ""


def _validate_path_segment(value: str, field_name: str) -> None:
    """Validate a single path segment supplied by an upstream service."""
    if not value:
        return
    if "/" in value or "\\" in value or ".." in value:
        raise ValueError(f"{field_name} must be a plain path segment.")


def _validate_zip_file_name(file_name: str) -> None:
    """Validate an optional ZIP file name supplied by an upstream service."""
    if not file_name:
        return
    _validate_path_segment(file_name, "file_name")
    if not file_name.endswith(".zip"):
        raise ValueError("file_name must end with .zip.")


def _count_descendants(source_dir: Path) -> int:
    """Count all descendant files and directories, excluding source_dir itself."""
    return sum(1 for _ in source_dir.rglob("*"))


def _zip_directory(source_dir: Path, output_path: str, arcdir: str = "", exclude_paths: list[str] | None = None, skills_md_hash: str | None = None) -> None:
    """Create a ZIP archive of all files inside source_dir.

    Args:
        source_dir: directory whose contents will be zipped.
        output_path: destination .zip file path.
        arcdir: optional folder name to use as the root directory inside the ZIP.
                When provided, all files are placed under ``arcdir/`` so that
                extracting the archive produces a single named folder.
                When empty, files are placed at the ZIP root (flat).

    Example:
        _zip_directory(Path(".workspace"), "/tmp/out.zip", arcdir="SMA-abc123")
        # ZIP contents:
        #   SMA-abc123/IDENTITY.md
        #   SMA-abc123/TOOLS.md
        #   ...
    """
    exclusions = set()
    for value in exclude_paths or []:
        path = Path(value)
        if not value or path.is_absolute() or ".." in path.parts or path == Path("."):
            raise ValueError("exclude_paths must contain safe relative paths.")
        exclusions.add(path.as_posix().rstrip("/"))
    skills_content = None
    if skills_md_hash:
        skills_content = (source_dir / "SKILLS.md").read_bytes()
        if hashlib.sha256(skills_content).hexdigest() != skills_md_hash:
            raise ValueError("SKILLS.md has not synchronized or changed during publication; retry publishing.")
        # Check and write the same bytes so a later mounted-file change cannot remove dependencies.
        if "SKILLS.md" in exclusions:
            raise ValueError("SKILLS.md cannot be excluded from a reference export.")
    def excluded(relative: str) -> bool:
        return any(relative == path or relative.startswith(path + "/") for path in exclusions)

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _dirs, files in os.walk(source_dir):
            _dirs[:] = [d for d in _dirs if not excluded((Path(root) / d).relative_to(source_dir).as_posix())]
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, source_dir)
                if excluded(rel_path):
                    continue
                arcname = os.path.join(arcdir, rel_path) if arcdir else rel_path
                if rel_path == "SKILLS.md" and skills_content is not None:
                    zf.writestr(arcname, skills_content)
                else:
                    zf.write(file_path, arcname)


# ---------------------------------------------------------------------------
# Metadata extraction
# ---------------------------------------------------------------------------

def extract_agent_metadata(workspace_dir: Path) -> Dict[str, Any]:
    """Extract agent_creator metadata from IDENTITY.md, TOOLS.md, and SKILLS.md.

    Files that do not exist are silently skipped.

    Args:
        workspace_dir: root directory where the workspace files live.

    Returns:
        Metadata dict with keys subset of:
        name_i18n, role_i18n, description_i18n, tools, skills.
    """
    metadata: Dict[str, Any] = {}

    # IDENTITY.md — name / role / description
    identity = _read_frontmatter(workspace_dir / "IDENTITY.md")
    if identity is not None:
        name    = _get_field(identity, "name")
        name_cn = _get_field(identity, "name_cn", "name-cn")
        name_en = _get_field(identity, "name_en", "name-en")
        metadata["name_i18n"] = _build_i18n(default=name, zh_cn=name_cn, en_us=name_en)

        role    = _get_field(identity, "role")
        role_cn = _get_field(identity, "role_cn", "role-cn")
        role_en = _get_field(identity, "role_en", "role-en")
        metadata["role_i18n"] = _build_i18n(default=role, zh_cn=role_cn, en_us=role_en)

        desc    = _get_field(identity, "description")
        desc_cn = _get_field(identity, "description_cn", "description-cn")
        desc_en = _get_field(identity, "description_en", "description-en")
        metadata["description_i18n"] = _build_i18n(default=desc, zh_cn=desc_cn, en_us=desc_en)

    # TOOLS.md — tools list（只读 frontmatter，不走运行时工具合成规则）
    tools_fm = _read_frontmatter(workspace_dir / "TOOLS.md")
    if tools_fm is not None:
        tools: Any = tools_fm.get("tools", [])
        if isinstance(tools, list):
            metadata["tools"] = [_str(t) for t in tools if t is not None]

    # SKILLS.md — skills list
    skills_fm = _read_frontmatter(workspace_dir / "SKILLS.md")
    if skills_fm is not None:
        skills: Any = skills_fm.get("skills", [])
        if isinstance(skills, list):
            metadata["skills"] = [s for s in skills if isinstance(s, str)]
        references = skills_fm.get("market_skills", [])
        if isinstance(references, list):
            metadata["skills"] = list(dict.fromkeys(metadata.get("skills", []) + [
                entry["name"] for entry in references if isinstance(entry, dict)
                and isinstance(entry.get("name"), str) and entry["name"]
            ]))

    return metadata


def extract_skill_metadata(workspace_dir: Path) -> Dict[str, Any]:
    """Extract skill_creator metadata from SKILL.md.

    The file is silently skipped if it does not exist.

    Args:
        workspace_dir: root directory where SKILL.md lives.

    Returns:
        Metadata dict with keys subset of: name_i18n, description_i18n.
    """
    metadata: Dict[str, Any] = {}

    skill_fm = _read_frontmatter(workspace_dir / "SKILL.md")
    if skill_fm is None:
        return metadata

    name    = _get_field(skill_fm, "name")
    # 兼容社区 skill 仍在使用的 name-cn/description-cn 字段
    name_cn = _get_field(skill_fm, "name-cn", "name_cn")
    name_en = _get_field(skill_fm, "name-en", "name_en")
    metadata["name_i18n"] = _build_i18n(default=name, zh_cn=name_cn, en_us=name_en)

    desc    = _get_field(skill_fm, "description")
    desc_cn = _get_field(skill_fm, "description-cn", "description_cn")
    desc_en = _get_field(skill_fm, "description-en", "description_en")
    metadata["description_i18n"] = _build_i18n(default=desc, zh_cn=desc_cn, en_us=desc_en)

    return metadata


# ---------------------------------------------------------------------------
# ZIP + upload
# ---------------------------------------------------------------------------

async def _package_and_upload(
    workspace_dir: Path,
    file_key: str,
    upload_config: Dict[str, Any],
    arcdir: str = "",
    exclude_paths: list[str] | None = None,
    skills_md_hash: str | None = None,
    on_package_completed: Callable[[], Awaitable[None]] | None = None,
) -> None:
    """Zip workspace_dir contents and upload the archive to object storage.

    Creates a fresh storage uploader instance from the supplied credentials so
    that the global singleton is not affected.

    Args:
        workspace_dir: directory whose contents will be packaged.
        file_key: destination object key in the storage bucket.
        upload_config: raw upload_config dict from the API request.
        arcdir: folder name placed at the root of the ZIP (see _zip_directory).
                When set, extracting the archive produces a single named folder.

    Raises:
        ValueError: if the platform specified in upload_config is not supported.
    """
    from app.infrastructure.storage.aliyun import AliyunOSSUploader
    from app.infrastructure.storage.s3 import S3Uploader
    from app.infrastructure.storage.types import (
        AliyunCredentials,
        PlatformType,
        S3Credentials,
        VolcEngineCredentials,
    )
    from app.infrastructure.storage.volcengine import VolcEngineUploader

    platform_str = upload_config.get("platform", "tos")
    try:
        platform = PlatformType(platform_str)
    except ValueError:
        raise ValueError(f"Unsupported storage platform: {platform_str!r}")

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".zip")
    os.close(tmp_fd)

    try:
        logger.info(f"Creating workspace ZIP from {workspace_dir} → {tmp_path} (arcdir={arcdir!r})")
        await asyncio.to_thread(_zip_directory, workspace_dir, tmp_path, arcdir=arcdir, exclude_paths=exclude_paths, skills_md_hash=skills_md_hash)
        if on_package_completed is not None:
            await on_package_completed()

        if platform == PlatformType.tos:
            credentials = VolcEngineCredentials(**upload_config)
            uploader = VolcEngineUploader()
        elif platform == PlatformType.aliyun:
            credentials = AliyunCredentials(**upload_config)
            uploader = AliyunOSSUploader()
        elif platform == PlatformType.minio:
            credentials = S3Credentials(**upload_config)
            uploader = S3Uploader()
        else:
            raise ValueError(
                f"Platform {platform_str!r} is not yet supported for workspace export."
            )
        uploader.set_credentials(credentials)

        logger.info(f"Uploading workspace ZIP to {file_key}")
        await uploader.upload(file=tmp_path, key=file_key)
        logger.info(f"Upload complete: {file_key}")

    finally:
        try:
            os.unlink(tmp_path)
        except Exception as exc:
            logger.warning(f"Failed to delete temp file {tmp_path}: {exc}")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def export_workspace(
    export_type: str,
    code: str,
    upload_config: Dict[str, Any],
    public_upload_config: Optional[Dict[str, Any]] = None,
    source_path: str = "",
    archive_root: str = "",
    file_name: str = "",
    exclude_paths: list[str] | None = None,
    skills_md_hash: str | None = None,
    progress_callback: Callable[[], Awaitable[None]] | None = None,
) -> Dict[str, Any]:
    """Package the workspace, upload it, and return the file key with extracted metadata.

    Args:
        export_type: "agent_creator", "skill_creator", or "slides_template_creator".
        code: agent/skill identifier used in the archive filename (e.g. "SMA_XXXXXX").
        upload_config: upload_config block from the API request body.
        source_path: relative path within the workspace root to export.
                     When empty, the entire workspace root is exported.
                     Path traversal (e.g. "../") is rejected with ValueError.
        archive_root: optional root directory name inside the ZIP archive.
        file_name: optional ZIP file name to upload.

    Returns:
        Dict with keys:
            "file_key"  — full object key of the uploaded archive.
            "metadata"  — extracted i18n metadata dict.

    Raises:
        ValueError: for unknown export_type, unsupported storage platform,
                    or invalid/unsafe source_path.
    """
    workspace_root = PathManager.get_workspace_dir()

    normalized_export_type = {
        "custom_agent": "agent_creator",
        "custom_skill": "skill_creator",
    }.get(export_type, export_type)

    _validate_path_segment(archive_root, "archive_root")
    _validate_zip_file_name(file_name)

    if source_path:
        candidate = (workspace_root / source_path).resolve()
        workspace_root_resolved = workspace_root.resolve()
        try:
            candidate.relative_to(workspace_root_resolved)
        except ValueError:
            raise ValueError(
                f"source_path {source_path!r} resolves outside the workspace root."
            )
        if not candidate.exists():
            raise ValueError(f"source_path {source_path!r} does not exist.")
        if not candidate.is_dir():
            raise ValueError(f"source_path {source_path!r} is not a directory.")
        workspace_dir = candidate
    else:
        workspace_dir = workspace_root

    if normalized_export_type == "slides_template_creator":
        if not public_upload_config:
            raise ValueError("public_upload_config is required for slides_template_creator.")
        return await export_slides_template(
            workspace_dir=workspace_dir,
            code=code,
            private_upload_config=upload_config,
            public_upload_config=public_upload_config,
            archive_root=archive_root or code,
            file_name=file_name or f"{code}.zip",
        )

    # Build the object key.
    # ZIP filename : {code}_{timestamp}.zip  (e.g. SMA-abc_20260319205908.zip)
    # Folder inside ZIP: {code}              (e.g. SMA-abc/)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")

    # tos keeps dir inside temporary_credential; aliyun has it at top level
    dir_prefix: str = (
        upload_config.get("temporary_credential", {}).get("dir", "")
        or upload_config.get("dir", "")
    )
    if dir_prefix and not dir_prefix.endswith("/"):
        dir_prefix += "/"
    if file_name:
        file_key = f"{dir_prefix}{file_name}"
    else:
        file_key = f"{dir_prefix}{normalized_export_type}/{code}_{timestamp}.zip"

    # Extract metadata (skips missing files gracefully)
    if normalized_export_type == "agent_creator":
        metadata = extract_agent_metadata(workspace_dir)
    elif normalized_export_type == "skill_creator":
        if not (workspace_dir / "SKILL.md").exists():
            raise ValueError("SKILL.md is required for skill_creator export.")
        metadata = extract_skill_metadata(workspace_dir)
        skill_dir = archive_root or code
        metadata["package_name"] = skill_dir
        metadata["skill_dir"] = skill_dir
        metadata["files_count"] = _count_descendants(workspace_dir)
    else:
        raise ValueError(
            f"Unknown export type: {export_type!r}. Expected 'agent_creator', 'skill_creator', or 'slides_template_creator'."
        )

    # Package and upload.
    # arcdir=code means the ZIP extracts to a folder named after code (without timestamp).
    await _package_and_upload(
        workspace_dir,
        file_key,
        upload_config,
        arcdir=archive_root or code,
        on_package_completed=progress_callback,
        exclude_paths=exclude_paths,
        skills_md_hash=skills_md_hash,
    )

    return {
        "file_key": file_key,
        "metadata": metadata,
    }
