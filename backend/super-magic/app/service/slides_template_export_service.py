"""Export a slide template directory from Sandbox to object storage."""

import json
import os
import tempfile
import time
import zipfile
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Union

from loguru import logger

MANIFEST_FILE_NAME = "template-assets.json"
MAX_FILE_COUNT = 500
MAX_DIRECTORY_SIZE_BYTES = 200 * 1024 * 1024
MAX_PREVIEW_IMAGE_COUNT = 50
EXCLUDED_ARCHIVE_DIRECTORIES = {"previews", ".template-work"}
EXCLUDED_ARCHIVE_FILES = {MANIFEST_FILE_NAME}


def _upload_dir(upload_config: Dict[str, Any]) -> str:
    directory = (
        upload_config.get("temporary_credential", {}).get("dir", "")
        or upload_config.get("dir", "")
    )
    return str(directory).strip("/")


def _join_file_key(upload_config: Dict[str, Any], relative_path: str) -> str:
    directory = _upload_dir(upload_config)
    relative_path = relative_path.lstrip("/")
    return f"{directory}/{relative_path}" if directory else relative_path


def _resolve_template_file(template_dir: Path, relative_path: str) -> Path:
    if not relative_path or Path(relative_path).is_absolute():
        raise ValueError("Template asset path must stay inside the template directory.")

    resolved = (template_dir / relative_path).resolve(strict=False)
    try:
        resolved.relative_to(template_dir.resolve())
    except ValueError as exc:
        raise ValueError("Template asset path must stay inside the template directory.") from exc

    if not resolved.is_file():
        raise ValueError(f"Template asset was not found: {relative_path}")
    return resolved


def _load_manifest(template_dir: Path) -> Dict[str, Any]:
    manifest_path = template_dir / MANIFEST_FILE_NAME
    if not manifest_path.is_file():
        raise ValueError(f"{MANIFEST_FILE_NAME} is required for slides template export.")

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"{MANIFEST_FILE_NAME} is invalid.") from exc

    if not isinstance(manifest, dict) or manifest.get("schema_version") != "1.0":
        raise ValueError(f"{MANIFEST_FILE_NAME} schema_version must be 1.0.")
    if not isinstance(manifest.get("local_files"), dict):
        raise ValueError(f"{MANIFEST_FILE_NAME} local_files must be an object.")
    if not isinstance(manifest.get("backend_fields"), dict):
        raise ValueError(f"{MANIFEST_FILE_NAME} backend_fields must be an object.")
    return manifest


def _validate_directory_limits(template_dir: Path) -> tuple[int, int]:
    files = [path for path in template_dir.rglob("*") if path.is_file()]
    if len(files) > MAX_FILE_COUNT:
        raise ValueError(f"Slide template directory contains more than {MAX_FILE_COUNT} files.")

    total_size = sum(path.stat().st_size for path in files)
    if total_size > MAX_DIRECTORY_SIZE_BYTES:
        raise ValueError("Slide template directory size exceeds the 200 MB limit.")
    return len(files), total_size


def _preview_paths(manifest: Dict[str, Any]) -> list[str]:
    preview_images = manifest["local_files"].get("preview_images", [])
    if not isinstance(preview_images, list):
        raise ValueError("local_files.preview_images must be an array.")
    paths = [str(path).strip() for path in preview_images if str(path).strip()]
    if len(paths) > MAX_PREVIEW_IMAGE_COUNT:
        raise ValueError(f"Slide template contains more than {MAX_PREVIEW_IMAGE_COUNT} preview images.")
    return paths


def _public_relative_path(relative_path: str) -> str:
    normalized = relative_path.replace("\\", "/").lstrip("./")
    if normalized.startswith("previews/"):
        return normalized[len("previews/"):]
    return normalized


def _archive_files(template_dir: Path) -> Iterable[Path]:
    for path in template_dir.rglob("*"):
        if not path.is_file():
            continue
        relative_parts = path.relative_to(template_dir).parts
        if relative_parts and relative_parts[0] in EXCLUDED_ARCHIVE_DIRECTORIES:
            continue
        if path.name in EXCLUDED_ARCHIVE_FILES:
            continue
        yield path


def _create_archive(template_dir: Path, output_path: str, archive_root: str) -> None:
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in _archive_files(template_dir):
            relative_path = path.relative_to(template_dir)
            archive.write(path, Path(archive_root) / relative_path)


def _create_uploader(upload_config: Dict[str, Any]):
    from app.infrastructure.storage.aliyun import AliyunOSSUploader
    from app.infrastructure.storage.s3 import S3Uploader
    from app.infrastructure.storage.types import (
        AliyunCredentials,
        PlatformType,
        S3Credentials,
        VolcEngineCredentials,
    )
    from app.infrastructure.storage.volcengine import VolcEngineUploader

    platform_name = upload_config.get("platform", "tos")
    try:
        platform = PlatformType(platform_name)
    except ValueError as exc:
        raise ValueError(f"Unsupported storage platform: {platform_name!r}") from exc

    if platform == PlatformType.tos:
        uploader = VolcEngineUploader()
        credentials = VolcEngineCredentials(**upload_config)
    elif platform == PlatformType.aliyun:
        uploader = AliyunOSSUploader()
        credentials = AliyunCredentials(**upload_config)
    elif platform == PlatformType.minio:
        uploader = S3Uploader()
        credentials = S3Credentials(**upload_config)
    else:
        raise ValueError(f"Unsupported storage platform: {platform_name!r}")

    uploader.set_credentials(credentials)
    return uploader


async def _upload_file(file_path: Union[Path, str], file_key: str, upload_config: Dict[str, Any]) -> None:
    uploader = _create_uploader(upload_config)
    await uploader.upload(file=str(file_path), key=file_key)


async def _upload_public_asset(
    template_dir: Path,
    relative_path: str,
    upload_config: Dict[str, Any],
) -> str:
    local_path = _resolve_template_file(template_dir, relative_path)
    file_key = _join_file_key(upload_config, _public_relative_path(relative_path))
    await _upload_file(local_path, file_key, upload_config)
    return file_key


def _required_i18n(value: Any, field_name: str) -> Dict[str, str]:
    if not isinstance(value, dict):
        raise ValueError(f"backend_fields.{field_name} must be an object.")
    result = {
        "zh_CN": str(value.get("zh_CN") or "").strip(),
        "en_US": str(value.get("en_US") or "").strip(),
    }
    if not all(result.values()):
        raise ValueError(f"backend_fields.{field_name} must contain zh_CN and en_US.")
    return result


def _validate_manifest_before_upload(
    template_dir: Path,
    manifest: Dict[str, Any],
    code: str,
) -> tuple[int, int, str, Optional[str], list[str], Dict[str, str], Dict[str, str], list[str]]:
    files_count, total_size = _validate_directory_limits(template_dir)
    local_files = manifest["local_files"]
    backend_fields = manifest["backend_fields"]

    thumbnail_path = str(local_files.get("thumbnail") or "").strip()
    if not thumbnail_path:
        raise ValueError("local_files.thumbnail is required.")
    collage_path = str(local_files.get("collage") or "").strip() or None
    preview_paths = _preview_paths(manifest)

    for path in [thumbnail_path, collage_path, *preview_paths]:
        if path:
            _resolve_template_file(template_dir, path)

    tag_codes = manifest.get("tag_codes", backend_fields.get("tag_codes", []))
    if not isinstance(tag_codes, list):
        raise ValueError("tag_codes must be an array.")
    normalized_tag_codes = [str(tag_code).strip() for tag_code in tag_codes if str(tag_code).strip()]

    return (
        files_count,
        total_size,
        thumbnail_path,
        collage_path,
        preview_paths,
        _required_i18n(backend_fields.get("label"), "label"),
        _required_i18n(backend_fields.get("description"), "description"),
        normalized_tag_codes,
    )


async def export_slides_template(
    workspace_dir: Path,
    code: str,
    private_upload_config: Dict[str, Any],
    public_upload_config: Dict[str, Any],
    archive_root: str,
    file_name: str,
) -> Dict[str, Any]:
    """Upload public preview assets and a private ZIP for one template directory."""
    started_at = time.monotonic()
    template_dir = workspace_dir.resolve()
    try:
        if not template_dir.is_dir():
            raise ValueError("Slide template source path must be a directory.")

        logger.info(
            "slides template export started: code={}, source_path={}, archive_root={}, file_name={}",
            code,
            template_dir,
            archive_root,
            file_name,
        )
        manifest = _load_manifest(template_dir)
        backend_fields = manifest["backend_fields"]
        (
            files_count,
            total_size,
            thumbnail_path,
            collage_path,
            preview_paths,
            label,
            description,
            tag_codes,
        ) = _validate_manifest_before_upload(template_dir, manifest, code)
        thumbnail_file_key = await _upload_public_asset(
            template_dir, thumbnail_path, public_upload_config
        )
        collage_file_key: Optional[str] = None
        if collage_path:
            collage_file_key = await _upload_public_asset(
                template_dir, collage_path, public_upload_config
            )
        preview_image_file_keys = [
            await _upload_public_asset(template_dir, path, public_upload_config)
            for path in preview_paths
        ]

        template_file_key = _join_file_key(private_upload_config, file_name)
        file_descriptor, archive_path = tempfile.mkstemp(suffix=".zip")
        os.close(file_descriptor)
        try:
            _create_archive(template_dir, archive_path, archive_root)
            await _upload_file(archive_path, template_file_key, private_upload_config)
        finally:
            Path(archive_path).unlink(missing_ok=True)

        metadata = {
            "code": code,
            "category_code": manifest.get("category_code", backend_fields.get("category_code")),
            "label": label,
            "description": description,
            "thumbnail_file_key": thumbnail_file_key,
            "collage_file_key": collage_file_key,
            "preview_image_file_keys": preview_image_file_keys,
            "template_file_key": template_file_key,
            "tag_codes": tag_codes,
            "files_count": files_count,
            "total_size": total_size,
        }
        logger.info(
            "slides template export completed: code={}, template_file_key={}, public_asset_count={}, duration_ms={}",
            code,
            template_file_key,
            1 + (1 if collage_file_key else 0) + len(preview_image_file_keys),
            int((time.monotonic() - started_at) * 1000),
        )
        return {"file_key": template_file_key, "metadata": metadata}
    except Exception:
        logger.exception(
            "slides template export failed: code={}, source_path={}, duration_ms={}",
            code,
            template_dir,
            int((time.monotonic() - started_at) * 1000),
        )
        raise
