"""使用合成容器验证音频文件的轻量损坏检测。

检测器遍历 ISO BMFF 容器的顶层 box，识别声明大小超出文件边界的截断情况。
测试仅在隔离目录中构造字节样例，不读取个人音频文件或依赖开发者本地路径。
"""

import struct
from pathlib import Path

import pytest

from app.tools.audio_understanding import AudioUnderstanding

def _box32(box_type: bytes, payload: bytes) -> bytes:
    """Build an ISO BMFF box with a 32-bit size header."""
    return struct.pack(">I", 8 + len(payload)) + box_type + payload


def _box64(box_type: bytes, payload: bytes) -> bytes:
    """Build an ISO BMFF box with a 64-bit extended size header (size field == 1)."""
    return struct.pack(">I", 1) + box_type + struct.pack(">Q", 16 + len(payload)) + payload


def _write(tmp_path: Path, name: str, data: bytes) -> Path:
    path = tmp_path / name
    path.write_bytes(data)
    return path


def _make_tool(tmp_path: Path) -> AudioUnderstanding:
    return AudioUnderstanding(base_dir=str(tmp_path))


@pytest.mark.asyncio
async def test_detects_truncated_moov_overflow(tmp_path):
    """Mirrors the corrupted sample: 64-bit mdat is valid, but moov overflows EOF."""
    ftyp = _box32(b"ftyp", b"3gp4" + b"\x00\x00\x00\x00" + b"isom3gp4")
    mdat = _box64(b"mdat", b"\xab" * 2000)
    # moov header claims 5000 bytes but only 200 are actually present -> truncated.
    moov = struct.pack(">I", 5000) + b"moov" + b"\x00" * 200
    audio = _write(tmp_path, "corrupted.m4a", ftyp + mdat + moov)

    reason = await _make_tool(tmp_path)._detect_corruption(audio)

    assert reason is not None
    assert "moov" in reason
    assert "truncated" in reason


@pytest.mark.asyncio
async def test_passes_well_formed_container(tmp_path):
    """Mirrors the healthy sample: every box stays within the file bounds."""
    ftyp = _box32(b"ftyp", b"isom" + b"\x00\x00\x00\x00" + b"isommp42")
    mdat = _box64(b"mdat", b"\xcd" * 2000)
    moov = _box32(b"moov", b"\x00" * 300)
    audio = _write(tmp_path, "healthy.m4a", ftyp + mdat + moov)

    reason = await _make_tool(tmp_path)._detect_corruption(audio)

    assert reason is None


@pytest.mark.asyncio
async def test_reports_missing_byte_count(tmp_path):
    """The reason should quantify how many bytes are missing for actionable feedback."""
    ftyp = _box32(b"ftyp", b"isom" + b"\x00\x00\x00\x00" + b"isommp42")
    # Declared 1000 but only 100 bytes of payload present -> 900 - 200(present diff) missing.
    moov = struct.pack(">I", 1000) + b"moov" + b"\x00" * 100
    audio = _write(tmp_path, "short.m4a", ftyp + moov)

    reason = await _make_tool(tmp_path)._detect_corruption(audio)

    assert reason is not None
    # ftyp(24) + moov header(8) + 100 payload = 132; declared end = 24 + 1000 = 1024.
    assert "892 bytes missing" in reason


@pytest.mark.asyncio
async def test_too_small_file_is_corrupted(tmp_path):
    audio = _write(tmp_path, "tiny.m4a", b"\x00\x00")

    reason = await _make_tool(tmp_path)._detect_corruption(audio)

    assert reason is not None
    assert "too small" in reason


@pytest.mark.asyncio
async def test_non_iso_extension_is_skipped(tmp_path):
    """Non mp4-family formats (e.g. mp3) are not ISO BMFF and must not be flagged."""
    audio = _write(tmp_path, "audio.mp3", b"not-an-iso-container" * 10)

    reason = await _make_tool(tmp_path)._detect_corruption(audio)

    assert reason is None
