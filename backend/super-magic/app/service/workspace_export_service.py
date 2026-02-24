"""Workspace export service.

Handles metadata extraction from workspace files, ZIP packaging, and upload to object storage.
"""

import os
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from loguru import logger

from app.infrastructure.storage.types import (
    AliyunCredentials,
    PlatformType,
    VolcEngineCredentials,
)
from app.infrastructure.storage.aliyun import AliyunOSSUploader
from app.infrastructure.storage.volcengine import VolcEngineUploader
from app.path_manager import PathManager


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


def _zip_directory(source_dir: Path, output_path: str, arcdir: str = "") -> None:
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
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _dirs, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, source_dir)
                arcname = os.path.join(arcdir, rel_path) if arcdir else rel_path
                zf.write(file_path, arcname)


# ---------------------------------------------------------------------------
# Metadata extraction
# ---------------------------------------------------------------------------

def extract_agent_metadata(workspace_dir: Path) -> Dict[str, Any]:
    """Extract custom_agent metadata from IDENTITY.md, TOOLS.md, and SKILLS.md.

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

    # TOOLS.md — tools list
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
            metadata["skills"] = [_str(s) for s in skills if s is not None]

    return metadata


def extract_skill_metadata(workspace_dir: Path) -> Dict[str, Any]:
    """Extract custom_skill metadata from SKILL.md.

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
    platform_str = upload_config.get("platform", "tos")
    try:
        platform = PlatformType(platform_str)
    except ValueError:
        raise ValueError(f"Unsupported storage platform: {platform_str!r}")

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".zip")
    os.close(tmp_fd)

    try:
        logger.info(f"Creating workspace ZIP from {workspace_dir} → {tmp_path} (arcdir={arcdir!r})")
        _zip_directory(workspace_dir, tmp_path, arcdir=arcdir)

        if platform == PlatformType.tos:
            credentials = VolcEngineCredentials(**upload_config)
            uploader = VolcEngineUploader()
        elif platform == PlatformType.aliyun:
            credentials = AliyunCredentials(**upload_config)
            uploader = AliyunOSSUploader()
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
) -> Dict[str, Any]:
    """Package the workspace, upload it, and return the file key with extracted metadata.

    Args:
        export_type: "custom_agent" or "custom_skill".
        code: agent/skill identifier used in the archive filename (e.g. "SMA_XXXXXX").
        upload_config: upload_config block from the API request body.

    Returns:
        Dict with keys:
            "file_key"  — full object key of the uploaded archive.
            "metadata"  — extracted i18n metadata dict.

    Raises:
        ValueError: for unknown export_type or unsupported storage platform.
    """
    workspace_dir = PathManager.get_workspace_dir()

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
    file_key = f"{dir_prefix}{export_type}/{code}_{timestamp}.zip"

    # Extract metadata (skips missing files gracefully)
    if export_type == "custom_agent":
        metadata = extract_agent_metadata(workspace_dir)
    elif export_type == "custom_skill":
        metadata = extract_skill_metadata(workspace_dir)
    else:
        raise ValueError(
            f"Unknown export type: {export_type!r}. Expected 'custom_agent' or 'custom_skill'."
        )

    # Package and upload.
    # arcdir=code means the ZIP extracts to a folder named after code (without timestamp).
    await _package_and_upload(workspace_dir, file_key, upload_config, arcdir=code)

    return {
        "file_key": file_key,
        "metadata": metadata,
    }
