"""persona-research 工具共用的读写、引文定位和小计算。

写入规则：研究文件在 .workspace 网络挂载目录里，同一逻辑文件要直接覆盖原文件，
不能「写临时文件再 rename」，否则会生成新的 file_id，前端缓存和分享页会错位
（见 backend/super-magic/AGENTS.md §11）。所以统一走 write_json_file / write_text_file。
"""

from __future__ import annotations

import asyncio
import json
import re
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from pydantic import ValidationError

from app.core.skill_utils.skill_sources import get_system_skills_dir
from app.tools.persona_research.contracts import (
    DEFAULT_REPORT_TEMPLATE,
    DISCUSSIONS_DIR,
    INTERVIEWS_DIR,
    STUDIES_DIR,
    TEMPLATES_DIR,
    Study,
    TranscriptStatus,
)
from app.utils.async_file_utils import (
    async_exists,
    async_mkdir,
    async_read_text,
    async_realpath,
    async_scandir,
    async_write_text,
)

INFERRED_MARK = "(inferred)"
_SENTENCE_SPLIT = re.compile(r"(?<=[。！？!?；;])|(?<=\.)\s+|\n+")
_SOURCE_REF = re.compile(r"\[(S\d+)\]")
# 引文两端常被模型加上的引号；只去两端，不改正文。
_QUOTE_WRAPPERS = "\"'“”‘’「」『』"


class StudyFilesError(ValueError):
    """给模型看的可修正错误：说明哪里不对、应该怎么改。"""


# ── 路径 ───────────────────────────────────────────────────────────────────


async def resolve_in_workspace(base_dir: Path, raw_path: str) -> Path:
    """解析为工作区内路径；绝对路径、.. 越界和软链接越界一律拒绝。"""
    text = (raw_path or "").strip().strip("/")
    if not text:
        raise StudyFilesError("Path must not be empty.")
    if Path(text).is_absolute() or ".." in Path(text).parts:
        raise StudyFilesError(f"Use a workspace-relative path without '..': {raw_path}")
    workspace = await async_realpath(base_dir)
    resolved = await async_realpath(workspace / text)
    if not resolved.is_relative_to(workspace):
        raise StudyFilesError(f"Path is outside the workspace: {raw_path}")
    return resolved


async def resolve_study_dir(base_dir: Path, study_dir: str) -> Path:
    """study_dir 必须是 studies/<slug>，且 study.json 已存在。"""
    parts = Path((study_dir or "").strip().strip("/")).parts
    if len(parts) != 2 or parts[0] != STUDIES_DIR:
        raise StudyFilesError(f"study_dir must look like studies/<slug>, got: {study_dir!r}")
    path = await resolve_in_workspace(base_dir, study_dir)
    if not await async_exists(path / "study.json"):
        raise StudyFilesError(f"{study_dir}/study.json does not exist. Create the study with update_study event=created first.")
    return path


def workspace_relative(base_dir: Path, path: Path) -> str:
    return path.relative_to(base_dir).as_posix()


# ── 读写 ───────────────────────────────────────────────────────────────────


async def read_json_file(path: Path) -> Optional[Dict[str, Any]]:
    """文件不存在返回 None；存在但不是 JSON 对象时报错，不静默当成空文件。"""
    if not await async_exists(path):
        return None
    text = await async_read_text(path)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise StudyFilesError(f"{path.name} is not valid JSON ({exc.msg} at line {exc.lineno}).") from exc
    if not isinstance(data, dict):
        raise StudyFilesError(f"{path.name} must contain a JSON object.")
    return data


async def write_json_file(path: Path, data: Dict[str, Any]) -> None:
    await async_write_text(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


async def write_text_file(path: Path, content: str, encoding: str = "utf-8") -> None:
    await async_write_text(path, content, encoding=encoding)


async def seed_report_template(base_dir: Path) -> Optional[str]:
    """项目里还没有任何报告模板时，把内置模板复制为 templates/voices.html，返回其工作区相对路径。

    | templates/ 现状              | 结果                     |
    | 不存在，或没有 .html         | 复制内置模板，返回路径   |
    | 已有任意 .html（含用户自建） | 不动，返回 None          |

    用户删掉 voices.html 但保留自建模板时不会被重新放入；未指定模板的研究此时直接读内置模板。
    """
    templates_dir = base_dir / TEMPLATES_DIR
    if await async_exists(templates_dir):
        entries = await async_scandir(templates_dir)
        if any(entry.is_file() and entry.name.lower().endswith(".html") for entry in entries):
            return None
    source = get_system_skills_dir() / "persona-research" / "reference" / "report-template.html"
    await async_mkdir(templates_dir, parents=True, exist_ok=True)
    await write_text_file(templates_dir / DEFAULT_REPORT_TEMPLATE, await async_read_text(source))
    return f"{TEMPLATES_DIR}/{DEFAULT_REPORT_TEMPLATE}"


async def load_study(study_path: Path) -> Study:
    data = await read_json_file(study_path / "study.json")
    if data is None:
        raise StudyFilesError(f"{study_path.name}/study.json does not exist.")
    try:
        return Study.model_validate(data)
    except ValidationError as exc:
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc']) or 'study.json'}: {err['msg']}" for err in exc.errors()[:6]
        )
        raise StudyFilesError(
            f"study.json does not match the file contract ({problems}). "
            "It was not written by update_study; recreate the study with update_study event=created."
        ) from exc


async def save_study(study_path: Path, study: Study) -> None:
    await write_json_file(study_path / "study.json", study.to_file())


# ── 访谈记录 ───────────────────────────────────────────────────────────────


@dataclass
class Transcript:
    """一份访谈（interviews/<persona_id>.json）或焦点小组（discussions/<id>.json）记录。"""

    file: str  # 相对研究目录，例如 interviews/p_x_1a2b.json
    kind: str  # interview | discussion
    data: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_discussion(self) -> bool:
        return self.kind == "discussion"

    @property
    def persona_id(self) -> str:
        return str(self.data.get("persona_id") or Path(self.file).stem)

    @property
    def status(self) -> str:
        return str(self.data.get("status") or TranscriptStatus.RUNNING)

    @property
    def rounds(self) -> List[Dict[str, Any]]:
        rounds = self.data.get("rounds")
        return rounds if isinstance(rounds, list) else []

    @property
    def moderator_turns(self) -> int:
        return sum(1 for _, speaker, _ in self.utterances() if speaker == "moderator")

    @property
    def inferred_ratio(self) -> Optional[float]:
        quality = self.data.get("quality")
        if isinstance(quality, dict) and isinstance(quality.get("inferred_ratio"), (int, float)):
            return float(quality["inferred_ratio"])
        return None

    def utterances(self) -> Iterator[tuple[int, str, str]]:
        """逐条返回 (round_index, 说话人, 文本)；说话人为 moderator 或 persona_id。"""
        for index, turn in enumerate(self.rounds):
            if not isinstance(turn, dict):
                continue
            speaker = str(turn.get("speaker") or turn.get("role") or "")
            if speaker == "persona":
                speaker = self.persona_id
            yield index, speaker, str(turn.get("text") or "")

    def moderator_texts(self) -> List[str]:
        return [text for _, speaker, text in self.utterances() if speaker == "moderator"]

    def persona_texts(self) -> List[str]:
        return [text for _, speaker, text in self.utterances() if speaker and speaker != "moderator"]


async def load_transcripts(study_path: Path) -> List[Transcript]:
    """读取研究目录下全部访谈和焦点小组记录，按文件名排序；坏文件跳过不中断。"""
    transcripts: List[Transcript] = []
    for sub, kind in ((INTERVIEWS_DIR, "interview"), (DISCUSSIONS_DIR, "discussion")):
        directory = study_path / sub
        if not await async_exists(directory):
            continue
        for entry in sorted(await async_scandir(directory), key=lambda item: item.name):
            if not entry.name.endswith(".json"):
                continue
            try:
                data = await read_json_file(directory / entry.name)
            except StudyFilesError:
                continue
            if data is not None:
                transcripts.append(Transcript(file=f"{sub}/{entry.name}", kind=kind, data=data))
    return transcripts


def clean_quote(text: str) -> str:
    return (text or "").strip().strip(_QUOTE_WRAPPERS).strip()


@dataclass(frozen=True)
class QuoteLocation:
    file: str
    round_index: int
    source: str  # interview | discussion
    text: str


def locate_quote(transcripts: List[Transcript], persona_id: str, text: str) -> Optional[QuoteLocation]:
    """在该人设自己的发言里逐字查找引文，先查一对一访谈，再查焦点小组。

    例：persona p_a 的访谈 rounds[3] 含「换一次太麻烦」，传入该句 → interviews/p_a.json, round_index=3。
    同一句出现在主持人发言里或别人的发言里都不算。
    """
    quote = clean_quote(text)
    if not quote:
        return None
    ordered = sorted(transcripts, key=lambda t: (t.is_discussion, t.file))
    for transcript in ordered:
        if not transcript.is_discussion and transcript.persona_id != persona_id:
            continue
        for index, speaker, utterance in transcript.utterances():
            if speaker == persona_id and quote in utterance:
                return QuoteLocation(transcript.file, index, transcript.kind, quote)
    return None


def compute_inferred_ratio(texts: List[str]) -> float:
    """受访者句子中带 "(inferred)" 的比例，保留两位小数；没有句子时为 0。"""
    sentences = [s for text in texts for s in _SENTENCE_SPLIT.split(text) if s and s.strip()]
    if not sentences:
        return 0.0
    marked = sum(1 for sentence in sentences if INFERRED_MARK in sentence)
    return round(marked / len(sentences), 2)


async def read_source_ids(study_path: Path) -> set[str]:
    """desk-research.md 里出现过的来源编号，例如 {"S1", "S3"}。"""
    path = study_path / "desk-research.md"
    if not await async_exists(path):
        return set()
    return set(_SOURCE_REF.findall(await async_read_text(path)))


# ── 小工具 ─────────────────────────────────────────────────────────────────


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def random_hex() -> str:
    return secrets.token_hex(2)


def ascii_slug(text: str, max_length: int = 40) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return slug[:max_length].strip("-")


def portrait_hint(profile: Dict[str, Any]) -> Dict[str, str]:
    """人设头像需要的性别和年龄原文，供卡片画出和研究页一样的头像。

    例：dimensions.demographics = {"gender": "女", "age": 32} → {"gender": "女", "age": "32"}；
    缺字段或类型不对时给空字符串，由前端按「未知」处理。
    """
    dimensions = profile.get("dimensions")
    demographics = dimensions.get("demographics") if isinstance(dimensions, dict) else None
    if not isinstance(demographics, dict):
        return {"gender": "", "age": ""}
    return {key: str(demographics.get(key) or "").strip() for key in ("gender", "age")}


_TRANSCRIPT_LOCKS: Dict[str, asyncio.Lock] = {}


def transcript_lock(path: Path) -> asyncio.Lock:
    """同一记录文件的读-判-写串行执行，避免并行的两次调用都写成同一轮。"""
    return _TRANSCRIPT_LOCKS.setdefault(str(path), asyncio.Lock())
