from pathlib import Path

import pytest

from app.utils.file_parse.utils.libreoffice_util import LibreOfficeUtil


@pytest.mark.asyncio
async def test_libreoffice_conversion_uses_separate_input_and_output_dirs(tmp_path: Path, monkeypatch):
    source = tmp_path / "macro_named_as_docx.docx"
    source.write_bytes(b"office bytes")
    seen_paths: list[tuple[Path, Path, str]] = []

    async def fake_check_available() -> bool:
        return True

    async def fake_run_conversion(input_file: Path, output_dir: Path, target_format: str) -> None:
        seen_paths.append((input_file, output_dir, target_format))
        assert input_file.parent != output_dir
        assert input_file.parent.name == "input"
        assert output_dir.name == "output"
        (output_dir / f"{input_file.stem}.{target_format}").write_bytes(b"converted bytes")

    monkeypatch.setattr(LibreOfficeUtil, "check_libreoffice_available", fake_check_available)
    monkeypatch.setattr(LibreOfficeUtil, "_run_libreoffice_conversion", fake_run_conversion)

    converted = await LibreOfficeUtil.convert_document(source, "docx", "test_conversion")

    assert seen_paths
    assert converted.exists()
    assert converted.suffix == ".docx"
    assert converted.read_bytes() == b"converted bytes"
