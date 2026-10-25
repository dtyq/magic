"""按人设从官方头像库挑选并绑定头像；不调用付费生图。

# 模型使用说明维护在 agents/skills/persona-research/reference/persona-portraits.md，
# 工具代码只保留 schema 语义和运行时错误信息（code_mode_only 工具的约定）。

数据流：open 接口取全部头像的标签清单 → 本地打分选图 → 按图取签名地址并下载到内存
→ 规整成 320px WebP → 写入 personas/portraits/<人设>/ 并绑定。
下载的原图不落临时文件；只有最终头像写入工作区，刷新后前端和报告都从这里读取。
"""

from __future__ import annotations

import asyncio
import hashlib
import random
from typing import Any, Literal

from PIL import Image
from pydantic import BaseModel, Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.infrastructure.magic_service.client import MagicServiceClient
from app.tools.core import BaseToolParams, tool
from app.tools.persona_research.contracts import MAX_PERSONAS
from app.tools.persona_research.persona_portraits import (
    PERSONA_ID,
    PORTRAIT_FILE,
    DuplicatePortraitError,
    bind_portrait_bytes,
    existing_portrait,
    portrait_detail,
    portrait_feedback,
    portraits_in_use,
    to_portrait_webp,
)
from app.tools.persona_research.portrait_matching import (
    PortraitEntry,
    parse_catalog,
    query_from_fields,
    rank,
)
from app.tools.persona_research.study_files import (
    StudyFilesError,
    read_json_file,
    resolve_in_workspace,
    transcript_lock,
)
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_realpath

logger = get_logger(__name__)

# 单张头像库图片是 320px 的小 WebP；放宽到 2 MB 只是防止异常大文件占满内存。
MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024
# 同一人设最多尝试几张候选：个别图下载失败、或与其它人设重复时顺延，不无限重试。
MAX_CANDIDATES_PER_PERSONA = 8

IndustryCode = Literal[
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K",
    "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V",
]  # fmt: skip


class PersonaPortraitRequest(BaseModel):
    persona_id: str = Field(..., pattern=PERSONA_ID)
    age: int | None = Field(default=None, ge=18, le=120, description="Known adult age; omit when unknown.")
    gender: Literal["masculine", "feminine", "neutral"] | None = Field(
        default=None, description="Explicit gender presentation only; never infer it from a name."
    )
    country: str | None = Field(
        default=None, pattern=r"^[A-Z]{2}$", description="Known country context as ISO 3166-1 alpha-2."
    )
    industry: IndustryCode | None = Field(
        default=None,
        description="ISIC Rev.5 section code of the persona's own industry; omit when unknown or not covered.",
    )
    hair: Literal["short", "medium", "long", "tied_back", "curly", "wavy", "straight", "bald", "covered"] | None = None
    facial_hair: Literal["none", "stubble", "beard", "mustache"] | None = None
    accessories: list[Literal["glasses", "earrings", "headwear"]] = Field(default_factory=list)


class AssignPersonaPortraitsParams(BaseToolParams):
    requests: list[PersonaPortraitRequest] = Field(
        ..., min_length=1, max_length=MAX_PERSONAS, description="One entry per saved persona; list the whole panel."
    )
    replace: bool = Field(default=False, description="True only when the user asked for new appearances.")

    @model_validator(mode="after")
    def validate_unique(self):
        ids = [item.persona_id for item in self.requests]
        if len(set(ids)) != len(ids):
            raise ValueError("Persona ids must be unique.")
        return self


def _access_context(tool_context: ToolContext) -> dict[str, Any]:
    task_id = str(tool_context.get_metadata("super_magic_task_id") or "").strip()
    if not task_id:
        task_id = str(tool_context.get_metadata("task_id") or "").strip()
    return {
        "topic_id": tool_context.get_metadata("topic_id"),
        "chat_topic_id": tool_context.get_metadata("chat_topic_id"),
        "project_id": tool_context.get_metadata("project_id"),
        "task_id": task_id,
        "message_id": tool_context.get_metadata("message_id"),
        "source": "super_magic_tool",
    }


@tool(name="assign_persona_portraits", code_mode_only=True)
class AssignPersonaPortraits(WorkspaceTool[AssignPersonaPortraitsParams]):
    """Match saved personas to the official avatar library and bind the chosen avatars. Never generates images."""

    async def execute(self, tool_context: ToolContext, params: AssignPersonaPortraitsParams) -> ToolResult:
        base = await async_realpath(self.base_dir)
        access = _access_context(tool_context)
        results: list[dict[str, Any]] = []
        catalog: list[PortraitEntry] | None = None
        catalog_error = ""
        rng = random.Random()
        # 工作区里所有人设已占用的头像库素材，加上本次分配出去的，都不再参与选择；
        # 要换形象的人设自己的旧头像也在其中，所以不会选回原来那张。
        taken_ids: set[str] = {item.library_id for item in await portraits_in_use(base) if item.library_id}
        async with MagicServiceClient() as client:
            for request in params.requests:
                persona_id = request.persona_id
                try:
                    path = await resolve_in_workspace(base, f"personas/{persona_id}.json")
                    async with transcript_lock(path):
                        profile = await read_json_file(path)
                        if not profile or profile.get("id") != persona_id or profile.get("schema_version") != 1:
                            raise StudyFilesError("The saved persona does not exist or its id does not match.")
                        old = await existing_portrait(base, profile)
                        if old and not params.replace:
                            results.append({"persona_id": persona_id, "status": "reused", "portrait": old})
                            continue
                        # 目录只在第一次真正需要选图时取，整批共用；取不到时全部保持原显示。
                        if catalog is None and not catalog_error:
                            try:
                                catalog = parse_catalog(await client.get_persona_avatar_catalog(access)) or None
                                if catalog is None:
                                    catalog_error = "The avatar library has no usable avatars."
                            except Exception as exc:  # 边界层：网络、鉴权、接口未上线都按「图库暂不可用」处理
                                logger.warning(f"Persona avatar catalog unavailable: {exc}")
                                catalog_error = "The avatar library is currently unavailable."
                        if catalog is None:
                            results.append({"persona_id": persona_id, "status": "unavailable", "reason": catalog_error})
                            continue
                        fields = request.model_dump(exclude={"persona_id"}, exclude_none=True)
                        ranked = rank(catalog, query_from_fields(fields), rng)
                        # 被检查标为「看起来像同一个人」的头像归为一个相似组，已用掉其中一张，其余也不再选
                        taken_groups = self._lookalike_groups(catalog, taken_ids)
                        candidates = [
                            match
                            for match in ranked
                            if match.entry.id not in taken_ids
                            and not (match.entry.tags.get("lookalike", frozenset()) & taken_groups)
                        ]
                        if not candidates:
                            results.append(
                                {
                                    "persona_id": persona_id,
                                    "status": "no_match",
                                    "reason": (
                                        "Every suitable avatar is already used by another persona; a distinct one is needed."
                                        if ranked
                                        else "No avatar satisfies the explicit age and gender constraints."
                                    ),
                                }
                            )
                            continue
                        results.append(
                            await self._bind_first_available(
                                client,
                                access,
                                base,
                                path,
                                profile,
                                persona_id,
                                candidates[:MAX_CANDIDATES_PER_PERSONA],
                                taken_ids,
                                self._digest_of(old) if params.replace else None,
                            )
                        )
                except (StudyFilesError, OSError, ValueError) as exc:
                    results.append({"persona_id": persona_id, "status": "failed", "reason": str(exc)})

        bound = sum(item["status"] in {"assigned", "reused"} for item in results)
        failed = sum(item["status"] in {"failed", "unavailable"} for item in results)
        unresolved = len(results) - bound
        summary = "; ".join(self._line(item) for item in results)
        return ToolResult(
            ok=failed == 0,
            content=(
                f"Avatars: {bound} bound or reused, {unresolved} unresolved ({failed} errors). {summary}. "
                "Unresolved personas keep their existing avatar or SVG fallback. No images were generated. "
                "Consider generation only for a genuine coverage gap and only within the user's image budget."
            ),
            data={"results": results, "bound": bound, "unresolved": unresolved},
        )

    @staticmethod
    async def _bind_first_available(
        client, access, base, path, profile, persona_id, candidates, taken_ids: set[str], previous_digest: str | None
    ) -> dict[str, Any]:
        errors: list[str] = []
        duplicates = 0
        for match in candidates:
            # 本次已分给别的人设的头像直接跳过，不再下载；跨次、跨来源的重复由绑定函数按内容摘要拦截。
            if match.entry.id in taken_ids:
                duplicates += 1
                continue
            try:
                payload = await client.get_persona_avatar_file_url(match.entry.id, access)
                url = str(payload.get("file_url") or "").strip()
                if not url:
                    raise ValueError("no file_url")
                raw = await client.download_url_bytes(url, MAX_DOWNLOAD_BYTES)
                data = await asyncio.to_thread(to_portrait_webp, raw)
                # 用户要求换形象时，选回原来那张等于没换。
                if previous_digest and hashlib.sha256(data).hexdigest()[:20] == previous_digest:
                    raise DuplicatePortraitError("Same portrait as the current one.")
                portrait = await bind_portrait_bytes(base, path, profile, data, library_id=match.entry.id)
            except DuplicatePortraitError:
                duplicates += 1
                taken_ids.add(match.entry.id)
                continue
            except (StudyFilesError, ValueError, Image.DecompressionBombError) as exc:
                errors.append(f"{match.entry.id}: {exc}")
                continue
            except Exception as exc:  # 边界层：下载失败顺延到下一张候选
                logger.warning(f"Persona avatar {match.entry.id} unavailable: {exc}")
                errors.append(f"{match.entry.id}: download failed")
                continue
            taken_ids.add(match.entry.id)
            return {
                "persona_id": persona_id,
                "status": "assigned",
                "portrait": portrait,
                "asset_id": match.entry.id,
                "match": match.level.value,
                "unmet": list(match.unmet),
            }
        if duplicates and not errors:
            # 合适的头像都被别的人设用掉了：这是库的覆盖不足，不是故障，交给调用方决定是否另行生成。
            return {
                "persona_id": persona_id,
                "status": "no_match",
                "reason": "Every suitable avatar is already used by another persona; a distinct one is needed.",
            }
        return {"persona_id": persona_id, "status": "unavailable", "reason": "; ".join(errors[:3])}

    @staticmethod
    def _lookalike_groups(catalog: list[PortraitEntry], taken_ids: set[str]) -> frozenset[str]:
        groups: set[str] = set()
        for entry in catalog:
            if entry.id in taken_ids:
                groups |= entry.tags.get("lookalike", frozenset())
        return frozenset(groups)

    @staticmethod
    def _digest_of(portrait: dict | None) -> str | None:
        match = PORTRAIT_FILE.match(portrait.get("file", "")) if portrait else None
        return match.group(1) if match else None

    @staticmethod
    def _line(item: dict[str, Any]) -> str:
        text = f"{item['persona_id']}: {item['status']}"
        if item.get("match"):
            text += f" ({item['match']}"
            if item.get("unmet"):
                text += f"; unmet: {', '.join(item['unmet'])}"
            text += ")"
        if item.get("reason"):
            text += f" ({item['reason']})"
        return text

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict | None = None
    ) -> ToolDetail:
        return portrait_detail(result, self._summary(result))

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict | None = None,
    ) -> dict:
        return portrait_feedback(tool_name, result, self._summary(result))

    @staticmethod
    def _summary(result: ToolResult) -> str:
        data = result.data or {}
        if not data:
            return i18n.translate("persona_portraits.failed", category="tool.messages")
        return i18n.translate(
            "persona_portraits.library_summary",
            category="tool.messages",
            bound=data.get("bound", 0),
            unresolved=data.get("unresolved", 0),
        )
