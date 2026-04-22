"""calendar_utils: magic_calendar 按月分片读写与 ID 生成

数据架构：
  magic.project.js  — 元数据 + categories + event_files 索引（JSONP 格式）
  events/YYYY-MM.json — 按月存放的事件数组（纯 JSON）

magic.project.js 不存放事件数据，仅维护月份文件索引列表 event_files。
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.utils.async_file_utils import (
    async_exists,
    async_mkdir,
    async_read_text,
    async_unlink,
    async_write_text,
)

# JSONP 解析：提取 window.magicProjectConfig = {...}; 部分的 JSON
_JSONP_PATTERN = re.compile(
    r"window\.magicProjectConfig\s*=\s*(?P<json>\{.*\})\s*;",
    re.DOTALL,
)


# ── 元数据读写（magic.project.js） ───────────────────────────────────────────


async def read_calendar_meta(project_path: Path) -> Dict[str, Any]:
    """读取 magic.project.js 元数据（不含事件）。"""
    js_path = project_path / "magic.project.js"
    if not await async_exists(js_path):
        raise FileNotFoundError(f"magic.project.js not found in {project_path}")

    content = await async_read_text(js_path)
    match = _JSONP_PATTERN.search(content)
    if not match:
        raise ValueError(f"Invalid magic.project.js format in {project_path}")

    return json.loads(match.group("json"))


async def write_calendar_meta(project_path: Path, meta: Dict[str, Any]) -> None:
    """将元数据写回 magic.project.js（JSONP 格式）。"""
    js_path = project_path / "magic.project.js"
    config_json = json.dumps(meta, indent=2, ensure_ascii=False)
    content = f"""\
window.magicProjectConfig = {config_json};
window.magicProjectConfigure(window.magicProjectConfig)
"""
    await async_write_text(js_path, content)


# ── 月份事件读写（events/YYYY-MM.json） ──────────────────────────────────────


def get_month_key(date_str: str) -> str:
    """从日期/时间字符串提取月份键 'YYYY-MM'。

    接受 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:MM' 格式。
    """
    return date_str[:7]


def _month_file_path(project_path: Path, month_key: str) -> Path:
    """返回月份事件文件路径：events/YYYY-MM.json"""
    return project_path / "events" / f"{month_key}.json"


async def ensure_events_dir(project_path: Path) -> None:
    """确保 events/ 目录存在。"""
    events_dir = project_path / "events"
    if not await async_exists(events_dir):
        await async_mkdir(events_dir, parents=True)


async def read_month_events(project_path: Path, month_key: str) -> List[Dict[str, Any]]:
    """读取指定月份的事件列表。文件不存在则返回空列表。"""
    path = _month_file_path(project_path, month_key)
    if not await async_exists(path):
        return []
    content = await async_read_text(path)
    return json.loads(content)


async def write_month_events(
    project_path: Path, month_key: str, events: List[Dict[str, Any]]
) -> None:
    """写入指定月份的事件列表。空列表时删除文件。"""
    await ensure_events_dir(project_path)
    path = _month_file_path(project_path, month_key)
    if not events:
        if await async_exists(path):
            await async_unlink(path)
        return
    content = json.dumps(events, indent=2, ensure_ascii=False)
    await async_write_text(path, content)


async def read_events_for_range(
    project_path: Path, month_keys: List[str]
) -> List[Dict[str, Any]]:
    """读取多个月份的事件并合并返回。"""
    all_events: List[Dict[str, Any]] = []
    for mk in month_keys:
        all_events.extend(await read_month_events(project_path, mk))
    return all_events


async def read_all_events(project_path: Path, meta: Dict[str, Any]) -> List[Dict[str, Any]]:
    """根据 meta 中的 event_files 索引读取全部事件。"""
    month_keys = [_extract_month_key(f) for f in meta.get("event_files", [])]
    return await read_events_for_range(project_path, month_keys)


def _extract_month_key(event_file: str) -> str:
    """从 'events/2026-04.json' 提取 '2026-04'。"""
    # 取文件名去掉 .json
    return Path(event_file).stem


def get_month_keys_in_range(
    meta: Dict[str, Any], date_from: Optional[str], date_to: Optional[str]
) -> List[str]:
    """根据日期范围筛选出需要加载的月份键列表。

    无过滤条件时返回所有已知月份。
    """
    all_months = sorted(_extract_month_key(f) for f in meta.get("event_files", []))
    if not date_from and not date_to:
        return all_months

    from_month = get_month_key(date_from) if date_from else "0000-00"
    to_month = get_month_key(date_to) if date_to else "9999-99"
    return [m for m in all_months if from_month <= m <= to_month]


async def sync_event_files_index(project_path: Path, meta: Dict[str, Any]) -> None:
    """同步 event_files 索引：扫描 events/ 目录，更新 meta 中的 event_files 列表。"""
    events_dir = project_path / "events"
    month_files: List[str] = []
    if await async_exists(events_dir):
        import asyncio
        entries = await asyncio.to_thread(lambda: sorted(events_dir.glob("*.json")))
        month_files = [f"events/{p.name}" for p in entries]
    meta["event_files"] = month_files


# ── ID 生成 ───────────────────────────────────────────────────────────────────


def generate_event_id() -> str:
    """生成 evt_ + 6 位随机 hex 的日程 ID。"""
    return f"evt_{os.urandom(3).hex()}"


# ── 事件定位（跨月搜索） ─────────────────────────────────────────────────────


async def find_event_by_id(
    project_path: Path, meta: Dict[str, Any], event_id: str
) -> Optional[Tuple[str, List[Dict[str, Any]], Dict[str, Any]]]:
    """在所有月份文件中查找指定 ID 的事件。

    返回 (month_key, month_events_list, event_dict) 或 None。
    """
    for event_file in meta.get("event_files", []):
        month_key = _extract_month_key(event_file)
        events = await read_month_events(project_path, month_key)
        for ev in events:
            if ev.get("id") == event_id:
                return month_key, events, ev
    return None


# ── 项目查找 ──────────────────────────────────────────────────────────────────


async def find_calendar_project(workspace_path: Path) -> Optional[Path]:
    """在 workspace 下查找第一个 type=calendar 的 magic.project.js 所在目录。

    仅扫描一级子目录，不递归。返回 None 表示未找到。
    """
    if not await async_exists(workspace_path):
        return None

    # 先检查 workspace 根目录
    try:
        data = await read_calendar_meta(workspace_path)
        if data.get("type") == "calendar":
            return workspace_path
    except (FileNotFoundError, ValueError):
        pass

    # 扫描一级子目录
    for entry in sorted(workspace_path.iterdir()):
        if not entry.is_dir():
            continue
        try:
            data = await read_calendar_meta(entry)
            if data.get("type") == "calendar":
                return entry
        except (FileNotFoundError, ValueError):
            continue

    return None
