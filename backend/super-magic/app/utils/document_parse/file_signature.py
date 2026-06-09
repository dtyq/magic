"""Lightweight document file signature checks."""

from __future__ import annotations

import json
import zipfile
from io import BytesIO
from pathlib import Path

from app.utils.async_file_utils import async_read_bytes, async_stat


class DocumentFileSignature:
    """Validate obvious extension/content mismatches before expensive parsing."""

    OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
    ZIP_MAGIC = b"PK\x03\x04"
    MAX_ZIP_DETAIL_BYTES = 20 * 1024 * 1024

    @classmethod
    async def validate(cls, path: Path) -> str | None:
        suffix = path.suffix.lower()
        header = await async_read_bytes(path, size=16)
        if suffix == ".pdf" and not header.startswith(b"%PDF"):
            return cls._message(path, "PDF", "a %PDF header")
        if suffix in {".docx", ".docm", ".dotx", ".dotm"}:
            return await cls._validate_ooxml(path, header, "Word OOXML", "word/", cls._expected_word_extensions(suffix))
        if suffix in {".pptx", ".pptm", ".ppsx", ".ppsm", ".potx", ".potm"}:
            return await cls._validate_ooxml(path, header, "PowerPoint OOXML", "ppt/", cls._expected_powerpoint_extensions(suffix))
        if suffix in {".xlsx", ".xlsm", ".xltx", ".xltm", ".xlsb"}:
            return await cls._validate_ooxml(path, header, "Spreadsheet OOXML", "xl/", cls._expected_spreadsheet_extensions(suffix))
        if suffix in {".doc", ".dot", ".ppt", ".pps", ".pot", ".xls", ".xlt"} and not header.startswith(cls.OLE_MAGIC):
            ooxml_message = await cls._legacy_extension_ooxml_message(path, header)
            if ooxml_message:
                return ooxml_message
            return cls._message(path, "legacy Office", "an OLE compound file header")
        if suffix == ".rtf" and not header.lstrip().startswith(b"{\\rtf"):
            return cls._message(path, "RTF", "an RTF header")
        if suffix == ".ipynb":
            return await cls._validate_notebook(path)
        return None

    @classmethod
    async def _validate_ooxml(
        cls,
        path: Path,
        header: bytes,
        label: str,
        required_prefix: str,
        expected_extensions: set[str],
    ) -> str | None:
        if not header.startswith(cls.ZIP_MAGIC):
            return cls._message(path, label, "a ZIP/OOXML header")
        stat = await async_stat(path)
        if stat.st_size > cls.MAX_ZIP_DETAIL_BYTES:
            return None
        try:
            names, content_types = await cls._read_zip_manifest(path)
        except zipfile.BadZipFile:
            return cls._message(path, label, "a valid ZIP/OOXML package")
        if "[Content_Types].xml" not in names or not any(name.startswith(required_prefix) for name in names):
            return cls._message(path, label, f"an OOXML package containing `{required_prefix}` entries")
        detected = cls._detect_ooxml_type(names, content_types)
        if detected:
            detected_label, detected_extension = detected
            if detected_extension not in expected_extensions:
                return cls._ooxml_extension_mismatch_message(path, detected_label, detected_extension)
        return None

    @classmethod
    async def _legacy_extension_ooxml_message(cls, path: Path, header: bytes) -> str | None:
        if not header.startswith(cls.ZIP_MAGIC):
            return None
        stat = await async_stat(path)
        if stat.st_size > cls.MAX_ZIP_DETAIL_BYTES:
            return None
        try:
            names, content_types = await cls._read_zip_manifest(path)
        except zipfile.BadZipFile:
            return None

        detected = cls._detect_ooxml_type(names, content_types)
        if not detected:
            return None
        label, suggested_extension = detected
        return cls._ooxml_extension_mismatch_message(path, label, suggested_extension)

    @classmethod
    async def _read_zip_manifest(cls, path: Path) -> tuple[set[str], str]:
        data = await async_read_bytes(path)
        with zipfile.ZipFile(BytesIO(data)) as archive:
            names = set(archive.namelist())
            content_types = ""
            if "[Content_Types].xml" in names:
                content_types = archive.read("[Content_Types].xml").decode("utf-8", errors="ignore")
            return names, content_types

    @staticmethod
    def _detect_ooxml_type(names: set[str], content_types: str = "") -> tuple[str, str] | None:
        if "[Content_Types].xml" not in names:
            return None
        if any(name.startswith("word/") for name in names):
            if "word/vbaProject.bin" in names or "macroEnabled.main+xml" in content_types:
                return ("Word OOXML macro-enabled document", ".docm")
            return ("Word OOXML document", ".docx")
        if any(name.startswith("ppt/") for name in names):
            if "ppt/vbaProject.bin" in names or "macroEnabled.main+xml" in content_types:
                return ("PowerPoint OOXML macro-enabled presentation", ".pptm")
            return ("PowerPoint OOXML presentation", ".pptx")
        if any(name.startswith("xl/") for name in names):
            if "xl/vbaProject.bin" in names or "macroEnabled.main+xml" in content_types:
                return ("Spreadsheet OOXML macro-enabled workbook", ".xlsm")
            return ("Spreadsheet OOXML workbook", ".xlsx")
        return None

    @staticmethod
    def _expected_word_extensions(suffix: str) -> set[str]:
        if suffix in {".docm", ".dotm"}:
            return {suffix}
        return {".docx"} if suffix == ".docx" else {".dotx"}

    @staticmethod
    def _expected_powerpoint_extensions(suffix: str) -> set[str]:
        if suffix in {".pptm", ".ppsm", ".potm"}:
            return {suffix}
        if suffix == ".pptx":
            return {".pptx"}
        if suffix == ".ppsx":
            return {".ppsx"}
        return {".potx"}

    @staticmethod
    def _expected_spreadsheet_extensions(suffix: str) -> set[str]:
        if suffix in {".xlsm", ".xltm"}:
            return {suffix}
        if suffix == ".xltx":
            return {".xltx"}
        return {".xlsx", ".xlsb"} if suffix == ".xlsb" else {".xlsx"}

    @staticmethod
    def _ooxml_extension_mismatch_message(path: Path, label: str, suggested_extension: str) -> str:
        target_hint = DocumentFileSignature._normalization_target_hint(suggested_extension)
        return (
            f"File format mismatch: `{path}` has extension `{path.suffix}` but the content looks like "
            f"{label} (`{suggested_extension}`). Recommended next actions: "
            "1. Call `convert_document_format` with the original `input_path`, a stable `output_dir`, "
            f"and `target_format` {target_hint}. "
            "2. Run `inspect_document` on the converted file returned by `convert_document_format`. "
            "3. Continue with `export_document_markdown` for small documents, or `sample_document_content` "
            "and `plan_document_reading` for large documents."
        )

    @staticmethod
    def _normalization_target_hint(suggested_extension: str) -> str:
        if suggested_extension in {".docm", ".docx", ".dotm", ".dotx"}:
            return "`docx` or `pdf`"
        if suggested_extension in {".pptm", ".pptx", ".ppsm", ".ppsx", ".potm", ".potx"}:
            return "`pptx` or `pdf`"
        if suggested_extension in {".xlsm", ".xlsx", ".xltm", ".xltx", ".xlsb"}:
            return "`xlsx`"
        return "the matching non-macro Office format or `pdf`"

    @staticmethod
    async def _validate_notebook(path: Path) -> str | None:
        try:
            data = json.loads((await async_read_bytes(path)).decode("utf-8"))
        except Exception:
            return DocumentFileSignature._message(path, "Jupyter notebook", "valid UTF-8 JSON")
        if not isinstance(data, dict) or "cells" not in data:
            return DocumentFileSignature._message(path, "Jupyter notebook", "a JSON object with `cells`")
        return None

    @staticmethod
    def _message(path: Path, label: str, expected: str) -> str:
        return (
            f"File format mismatch: `{path}` has extension `{path.suffix}` but does not look like {label}. "
            f"Expected {expected}. Check the file name, extension, or convert the file before parsing."
        )
