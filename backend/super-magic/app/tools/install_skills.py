"""install_skills 工具：统一批量安装/升级 Skill

所有来源的 skill 安装唯一入口；旁路安装路径（shell 直调 skillhub/clawhub/npx 等）
已在 shell_exec handler 层面被拦截并引导至本工具。
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Literal, Optional

import json

from pydantic import Field, field_validator, model_validator

from app.i18n import i18n
from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.skill_utils.installer import InstallResult, InstallService, SkillRef

logger = get_logger(__name__)

_VALID_PROVIDERS = {"my_library", "market", "skillhub", "clawhub", "npx", "github"}
_MAX_CONCURRENCY = 3


class InstallSkillItem(BaseToolParams):
    """单条安装请求"""

    provider: str = Field(
        ...,
        description=(
            "<!--zh: 安装来源。可选值：my_library（我的技能库）| market（Magic 市场）| "
            "skillhub（社区）| clawhub（ClawHub 生态）| npx（npm/npx）| github（GitHub 仓库 URL）-->\n"
            "Install source. Options: my_library | market | skillhub | clawhub | npx | github"
        ),
    )
    id: str = Field(
        ...,
        description=(
            "<!--zh: provider 内唯一标识。my_library/market 用 code；skillhub/clawhub 用 slug；"
            "npx 用 GitHub 仓库路径（owner/repo），如需指定仓库内某个 skill 用 owner/repo#skill-name；"
            "github 用完整仓库 URL（支持子目录）-->\n"
            "Unique ID within the provider: code for my_library/market; "
            "slug for skillhub/clawhub; "
            "for npx: GitHub repo path like 'owner/repo', or 'owner/repo#skill-name' to target a specific skill; "
            "full GitHub URL for github."
        ),
    )
    mode: Literal["install", "upgrade"] = Field(
        "install",
        description=(
            "<!--zh: install=安装（已有同版本时跳过）；upgrade=升级到最新版本-->\n"
            "install: skip if same version exists; upgrade: update to latest version."
        ),
    )
    @field_validator("provider")
    @classmethod
    def _validate_provider(cls, v: str) -> str:
        if v not in _VALID_PROVIDERS:
            raise ValueError(
                f"provider '{v}' 无效，可选值: {', '.join(sorted(_VALID_PROVIDERS))}"
            )
        return v

    @field_validator("id")
    @classmethod
    def _validate_id(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("id 不能为空")
        return v.strip()


class InstallSkillsParams(BaseToolParams):
    """install_skills 工具参数"""

    items: List[InstallSkillItem] = Field(
        ...,
        description=(
            "<!--zh: 要安装/升级的 skill 列表，并发执行，各条独立成败，最多 10 条-->\n"
            "List of skills to install/upgrade (max 10). Executed concurrently; each item succeeds or fails independently."
        ),
        min_length=1,
        max_length=10,
    )

    @field_validator("items", mode="before")
    @classmethod
    def _parse_items(cls, v: object) -> object:
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except (json.JSONDecodeError, ValueError):
                pass
        return v

    @model_validator(mode="after")
    def _check_no_dup_ids(self) -> "InstallSkillsParams":
        """同一批次不允许相同 (provider, id) 重复"""
        seen: set[tuple] = set()
        for item in self.items:
            key = (item.provider, item.id)
            if key in seen:
                raise ValueError(
                    f"批次中存在重复条目：provider='{item.provider}' id='{item.id}'"
                )
            seen.add(key)
        return self


@tool()
class InstallSkillsTool(BaseTool[InstallSkillsParams]):
    """<!--zh
    批量安装或升级 skill 的**唯一入口**。
    支持来源：my_library（我的技能库）、market（Magic 市场）、
    skillhub（外部社区）、clawhub（ClawHub 生态）、npx（npm 包）、github（GitHub 仓库）。
    mode=install：同版本已存在时跳过；mode=upgrade：升级到最新或指定版本。
    各条独立成败，不因单条失败而中止整批。
    -->
    Batch install or upgrade skills — the ONLY entry point for skill installation.
    Supported sources: my_library, market, skillhub, clawhub, npx, github.
    mode=install: skip if same version exists; mode=upgrade: update to latest.
    Items succeed or fail independently; one failure does not abort the batch.
    """

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        args = arguments or {}
        items = args.get("items", [])
        if isinstance(items, str):
            try:
                items = json.loads(items)
            except (json.JSONDecodeError, ValueError):
                items = []
        ids = [item.get("id", "") for item in items if isinstance(item, dict) and item.get("id")]
        ids_str = "、".join(ids) if ids else ""
        return {
            "action": i18n.translate("install_skills", category="tool.actions"),
            "remark": i18n.translate("install_skills.installing", category="tool.messages", ids=ids_str),
            "tool_name": tool_name,
        }

    async def execute(self, tool_context: ToolContext, params: InstallSkillsParams) -> ToolResult:
        # 对 my_library / market，尝试将 skill name 自动解析为 source_id
        _sdk_providers = {"my_library", "market"}

        async def _maybe_resolve(provider: str, skill_id: str) -> str:
            if provider in _sdk_providers:
                return await self._resolve_source_id(provider, skill_id)
            return skill_id

        resolved_ids = await asyncio.gather(*[
            _maybe_resolve(item.provider, item.id) for item in params.items
        ])

        refs = [
            SkillRef(
                provider=item.provider,
                id=resolved_id,
                mode=item.mode,
            )
            for item, resolved_id in zip(params.items, resolved_ids)
        ]

        service = InstallService()
        batch_result = await service.install_many(refs, max_concurrency=_MAX_CONCURRENCY)

        content = _format_batch_result(batch_result)
        ok = batch_result.failed_count == 0
        upgraded_count = sum(1 for r in batch_result.items if r.status == "upgraded")
        installed_count = sum(1 for r in batch_result.items if r.status == "installed")

        return ToolResult(
            ok=ok,
            content=content,
            extra_info={
                "ok_count": batch_result.ok_count,
                "failed_count": batch_result.failed_count,
                "installed_count": installed_count,
                "upgraded_count": upgraded_count,
            },
        )

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        if not result.content:
            return None
        extra = result.extra_info or {}
        ok = extra.get("ok_count", 0)
        failed = extra.get("failed_count", 0)
        file_name = f"install_skills_ok{ok}_failed{failed}.md"
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name=file_name,
                content=f"```xml\n{result.content}\n```",
            ),
        )

    async def _resolve_source_id(self, provider: str, skill_id: str) -> str:
        """将 my_library / market 的 skill name 解析为 source_id。

        LLM 在 read_skills 时只能获取 skill name，而这两个 provider 的安装接口需要 source_id。
        扫描已安装 skill 目录的 manifest，若找到 name 匹配且 provider 一致的条目，返回其 source_id；
        否则原值返回（兼容 LLM 直接传入正确 source_id 的场景）。
        """
        from app.core.skill_utils.constants import get_skillhub_install_dir
        from app.core.skill_utils.manifest import read_manifest

        install_dir = get_skillhub_install_dir()
        try:
            entries = await asyncio.to_thread(lambda: [
                e for e in install_dir.iterdir() if e.is_dir()
            ] if install_dir.exists() else [])
            for entry in entries:
                manifest = await asyncio.to_thread(read_manifest, entry)
                if (
                    manifest
                    and manifest.provider == provider
                    and manifest.name == skill_id
                    and manifest.source_id
                    and manifest.source_id != skill_id
                ):
                    logger.info(
                        f"[install_skills] 将 skill name '{skill_id}' 解析为 source_id '{manifest.source_id}'"
                    )
                    return manifest.source_id
        except Exception as e:
            logger.debug(f"[install_skills] 解析 source_id 失败: {e}")
        return skill_id

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        extra = result.extra_info or {}
        ok = extra.get("ok_count", 0)
        failed = extra.get("failed_count", 0)
        installed = extra.get("installed_count", 0)
        upgraded = extra.get("upgraded_count", 0)
        if failed == 0:
            if upgraded > 0 and installed == 0:
                return i18n.translate("install_skills.upgraded", category="tool.messages", count=upgraded)
            if upgraded > 0 and installed > 0:
                return i18n.translate("install_skills.mixed_success", category="tool.messages", installed=installed, upgraded=upgraded)
            return i18n.translate("install_skills.success", category="tool.messages", count=ok)
        if ok == 0:
            return i18n.translate("install_skills.failed", category="tool.messages", count=failed)
        return i18n.translate("install_skills.partial", category="tool.messages", ok=ok, failed=failed)


def _format_batch_result(batch_result) -> str:
    lines = [
        f'<install_batch ok="{batch_result.ok_count}" failed="{batch_result.failed_count}">'
    ]
    for r in batch_result.items:
        attrs = (
            f'provider="{r.provider}" id="{r.skill_id}" mode="{r.mode}" '
            f'result="{r.status}" version="{r.version}"'
        )
        if r.path:
            attrs += f' path="{r.path}"'
        msg = r.message.replace('"', "&quot;")
        lines.append(f'  <item {attrs} message="{msg}" />')
    lines.append("</install_batch>")
    return "\n".join(lines)
