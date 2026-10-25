"""人设头像绑定与报告快照；提示词见 persona-research/reference/persona-portraits.md。"""

from __future__ import annotations

import asyncio
import hashlib
import io
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import BaseToolParams, tool
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.persona_research.study_files import (
    StudyFilesError,
    now_iso,
    read_json_file,
    resolve_in_workspace,
    transcript_lock,
    write_json_file,
)
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import (
    async_exists,
    async_mkdir,
    async_read_bytes,
    async_realpath,
    async_stat,
    async_scandir,
    async_write_bytes,
    get_file_id_from_xattr,
)

PERSONA_ID = r"^p_[a-zA-Z0-9_-]+$"
PORTRAIT_FILE = re.compile(r"^personas/portraits/p_[a-zA-Z0-9_-]+/([a-f0-9]{20})\.webp$")
MAX_SOURCE_BYTES = 20 * 1024 * 1024


def to_portrait_webp(data: bytes) -> bytes:
    """统一交付小尺寸真实图片；只做裁切压缩，不用代码生成或改绘人脸。"""
    with Image.open(io.BytesIO(data)) as image:
        if image.format not in {"PNG", "JPEG", "WEBP"}:
            raise StudyFilesError("Use a generated PNG, JPEG, or WebP portrait.")
        if image.width * image.height > 25_000_000:
            raise StudyFilesError("The portrait exceeds 25 megapixels.")
        image = ImageOps.exif_transpose(image)
        image = ImageOps.fit(image.convert("RGB"), (320, 320), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format="WEBP", quality=85, method=4)
        return output.getvalue()


class DuplicatePortraitError(StudyFilesError):
    """候选头像与其它人设已有的头像是同一张图。"""


@dataclass(frozen=True)
class PortraitInUse:
    persona_id: str
    digest: str  # 头像文件名即内容摘要的前 20 位
    library_id: str | None  # 来自头像库时记录的素材 ID；生成的头像没有


async def portraits_in_use(base: Path) -> list[PortraitInUse]:
    """工作区里所有人设已绑定的头像。

    `personas/` 是工作区级目录，所有研究共用，所以这里天然覆盖「用户工作区下的所有人设」。
    只读各人设文件里的 portrait 引用，不读图片本身：同一张图无论来自头像库、
    重复入库的副本还是生成结果，只要字节相同，文件名摘要就相同。
    """
    result: list[PortraitInUse] = []
    personas_dir = await resolve_in_workspace(base, "personas")
    if not await async_exists(personas_dir):
        return result
    for entry in await async_scandir(personas_dir):
        if not entry.is_file() or not entry.name.endswith(".json"):
            continue
        try:
            persona = await read_json_file(Path(entry.path))
        except (StudyFilesError, OSError, ValueError):
            continue  # 单个人设文件暂时不可读时不影响判断，其余人设照常检查
        portrait = persona.get("portrait") if isinstance(persona, dict) else None
        file = portrait.get("file") if isinstance(portrait, dict) else None
        match = PORTRAIT_FILE.match(file) if isinstance(file, str) else None
        if match:
            library_id = portrait.get("library_id")
            result.append(
                PortraitInUse(
                    persona_id=entry.name.removesuffix(".json"),
                    digest=match.group(1),
                    library_id=library_id if isinstance(library_id, str) and library_id else None,
                )
            )
    return result


async def other_portrait_digests(base: Path, persona_id: str) -> set[str]:
    """其它人设已用头像的内容摘要，用来在绑定时兜底拦截重复。

    例：周敏已用 3fa9...webp，再给王雪梅绑定同一张图时摘要命中，被拒绝。
    """
    return {item.digest for item in await portraits_in_use(base) if item.persona_id != persona_id}


async def existing_portrait(base: Path, profile: dict) -> dict | None:
    """只复用该人设规范路径中已经存在的头像；损坏的引用留给后续绑定恢复。"""
    previous = profile.get("portrait")
    if not isinstance(previous, dict):
        return None
    relative = previous.get("file", "")
    if not isinstance(relative, str) or not re.fullmatch(
        rf"personas/portraits/{re.escape(profile['id'])}/[a-f0-9]{{20}}\.webp", relative
    ):
        return None
    try:
        existing = await resolve_in_workspace(base, relative)
        if await async_exists(existing):
            header = await async_read_bytes(existing, size=12)
            if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
                return previous
    except (StudyFilesError, OSError, ValueError):
        return None
    return None


async def bind_portrait_bytes(
    base: Path, profile_path: Path, profile: dict, data: bytes, library_id: str | None = None
) -> dict:
    """把已校验的 WebP 写入人设目录并绑定；调用者必须已持有该人设的锁。

    内容寻址的新文件先写完再更新人设；失败不会覆盖旧头像或其引用，也不在网络目录 rename。
    """
    digest = hashlib.sha256(data).hexdigest()[:20]
    # 同一份研究里的人设不能共用一张脸，否则一眼就能看出是模拟的。
    if digest in await other_portrait_digests(base, profile["id"]):
        raise DuplicatePortraitError(
            "Another persona already uses this exact portrait; every persona needs a distinct avatar."
        )
    relative = f"personas/portraits/{profile['id']}/{digest}.webp"
    target = await resolve_in_workspace(base, relative)
    await async_mkdir(target.parent, parents=True, exist_ok=True)
    if not await async_exists(target):
        await async_write_bytes(target, data)
    if await async_read_bytes(target) != data:
        raise StudyFilesError("The portrait file is not fully written; the previous portrait is unchanged.")
    portrait = {"file": relative, "updated_at": now_iso()}
    if library_id:
        # 记录来自头像库的哪一张，之后选图时可以在下载之前就把已被占用的排除。
        portrait["library_id"] = library_id
    file_id = await get_file_id_from_xattr(target)
    if file_id:
        portrait["file_id"] = str(file_id)
    profile["portrait"] = portrait
    profile["updated_at"] = portrait["updated_at"]
    await write_json_file(profile_path, profile)
    return portrait


class AttachPersonaPortraitParams(BaseToolParams):
    persona_id: str = Field(..., pattern=PERSONA_ID)
    image_path: str = Field(..., description="Exact workspace-relative successful generate_images output.")
    replace: bool = Field(default=False, description="True only when the user requested a new appearance.")


@tool(name="attach_persona_portrait", code_mode_only=True)
class AttachPersonaPortrait(WorkspaceTool[AttachPersonaPortraitParams]):
    """Bind a generated portrait to an existing persona without changing its research content."""

    async def execute(self, tool_context: ToolContext, params: AttachPersonaPortraitParams) -> ToolResult:
        try:
            base = await async_realpath(self.base_dir)
            profile_path = await resolve_in_workspace(base, f"personas/{params.persona_id}.json")
            # 串行化同一人设的绑定；第二次非替换调用复用第一次成功结果。
            async with transcript_lock(profile_path):
                profile = await read_json_file(profile_path)
                if not profile or profile.get("id") != params.persona_id or profile.get("schema_version") != 1:
                    raise StudyFilesError("The saved persona does not exist or its id does not match.")
                previous = await existing_portrait(base, profile)
                if previous and not params.replace:
                    return ToolResult(content="Reused the persona's existing portrait.", data={"portrait": previous})
                if Path(params.image_path).is_absolute():
                    raise StudyFilesError("Use a workspace-relative image path.")
                source = await resolve_in_workspace(base, params.image_path)
                stat = await async_stat(source)
                if not 0 < stat.st_size <= MAX_SOURCE_BYTES:
                    raise StudyFilesError("The generated image must be nonempty and at most 20 MB.")
                data = await asyncio.to_thread(to_portrait_webp, await async_read_bytes(source))
                portrait = await bind_portrait_bytes(base, profile_path, profile, data)
                relative = portrait["file"]
            return ToolResult(
                content=f"Portrait attached to {params.persona_id}: {relative}. Reuse it in all views and embed it in the report.",
                data={"portrait": portrait},
            )
        except (StudyFilesError, OSError, ValueError, Image.DecompressionBombError) as exc:
            return ToolResult.error(f"Portrait not attached; keep the existing avatar: {exc}")

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict | None = None
    ) -> ToolDetail:
        return portrait_detail(result)

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict | None = None,
    ) -> dict:
        return portrait_feedback(tool_name, result)


def portrait_detail(result: ToolResult, message: str | None = None) -> ToolDetail:
    key = "persona_portraits.updated" if result.ok else "persona_portraits.failed"
    return ToolDetail(
        type=DisplayType.MD,
        data=FileContent(
            file_name="persona-portraits.md",
            content=message or i18n.translate(key, category="tool.messages"),
        ),
    )


def portrait_feedback(tool_name: str, result: ToolResult, message: str | None = None) -> dict[str, str]:
    key = "persona_portraits.updated" if result.ok else "persona_portraits.failed"
    return {
        "action": i18n.translate(tool_name, category="tool.actions"),
        "remark": message or i18n.translate(key, category="tool.messages"),
    }
