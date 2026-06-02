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
            return await cls._validate_ooxml(path, header, "Word OOXML", "word/")
        if suffix in {".pptx", ".pptm", ".ppsx", ".ppsm", ".potx", ".potm"}:
            return await cls._validate_ooxml(path, header, "PowerPoint OOXML", "ppt/")
        if suffix in {".xlsx", ".xlsm", ".xltx", ".xltm", ".xlsb"}:
            return await cls._validate_ooxml(path, header, "Spreadsheet OOXML", "xl/")
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
    async def _validate_ooxml(cls, path: Path, header: bytes, label: str, required_prefix: str) -> str | None:
        if not header.startswith(cls.ZIP_MAGIC):
            return cls._message(path, label, "a ZIP/OOXML header")
        stat = await async_stat(path)
        if stat.st_size > cls.MAX_ZIP_DETAIL_BYTES:
            return None
        data = await async_read_bytes(path)
        try:
            with zipfile.ZipFile(BytesIO(data)) as archive:
                names = set(archive.namelist())
        except zipfile.BadZipFile:
            return cls._message(path, label, "a valid ZIP/OOXML package")
        if "[Content_Types].xml" not in names or not any(name.startswith(required_prefix) for name in names):
            return cls._message(path, label, f"an OOXML package containing `{required_prefix}` entries")
        return None

    @classmethod
    async def _legacy_extension_ooxml_message(cls, path: Path, header: bytes) -> str | None:
        if not header.startswith(cls.ZIP_MAGIC):
            return None
        stat = await async_stat(path)
        if stat.st_size > cls.MAX_ZIP_DETAIL_BYTES:
            return None
        try:
            names = await cls._read_zip_names(path)
        except zipfile.BadZipFile:
            return None

        detected = cls._detect_ooxml_type(names)
        if not detected:
            return None
        label, suggested_extension = detected
        return (
            f"File format mismatch: `{path}` has extension `{path.suffix}` but the content looks like "
            f"{label} (`{suggested_extension}`). Rename or copy the file with the correct extension, then run "
            "inspect_document again on the corrected absolute path. If the file must be normalized first, use "
            "convert_document_format to convert it to pdf or the matching Office format before parsing."
        )

    @classmethod
    async def _read_zip_names(cls, path: Path) -> set[str]:
        data = await async_read_bytes(path)
        with zipfile.ZipFile(BytesIO(data)) as archive:
            return set(archive.namelist())

    @staticmethod
    def _detect_ooxml_type(names: set[str]) -> tuple[str, str] | None:
        if "[Content_Types].xml" not in names:
            return None
        if any(name.startswith("word/") for name in names):
            return ("Word OOXML macro-enabled document", ".docm") if "word/vbaProject.bin" in names else ("Word OOXML document", ".docx")
        if any(name.startswith("ppt/") for name in names):
            return ("PowerPoint OOXML macro-enabled presentation", ".pptm") if "ppt/vbaProject.bin" in names else ("PowerPoint OOXML presentation", ".pptx")
        if any(name.startswith("xl/") for name in names):
            return ("Spreadsheet OOXML macro-enabled workbook", ".xlsm") if "xl/vbaProject.bin" in names else ("Spreadsheet OOXML workbook", ".xlsx")
        return None

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
