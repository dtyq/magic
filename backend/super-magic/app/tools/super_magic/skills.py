"""技能项目的创建、发现及确认发布。模型工作流见 agents/skills/super-magic/references/skills.md。"""

from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path
from typing import Literal

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from pydantic import Field, model_validator

from app.i18n import i18n
from app.path_manager import PathManager
from app.service.prepared_operation_confirmation import PreparedOperationConfirmation, PreparedOperationError
from app.tools.core import tool
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive
from app.utils.agfs_mount_path import get_referenced_project_mount_base
from app.utils.async_file_utils import (
    async_chmod,
    async_exists,
    async_mkdir,
    async_read_bytes,
    async_stat,
    async_write_bytes,
)
from app.utils.runtime_storage import (
    RuntimeEvictionPolicy,
    evict_runtime_directories,
    get_runtime_config_int,
    get_runtime_config_size_bytes,
)

from .display import ProductTool
from .models import ProductParams, projected_page, resource_id

SKILL_FIELDS = ("id", "code", "skill_code", "name", "description", "project_id", "user_role", "version", "version_code", "publish_type", "allowed_publish_target_types")


def skill_result(data: dict) -> ToolResult:
    if "versions" in data:
        lines = [f"Recent versions of skill {data['skill_code']} (total: {data.get('total', 'unknown')})."]
        for version in data["versions"]:
            lines.append(f"- {version.get('version')}: publication={version.get('publish_status')}, review={version.get('review_status')}, audience={version.get('publish_target_type')}.")
        return ToolResult(content="\n".join(lines), data=data)
    if "items" in data:
        lines = [f"Found {len(data['items'])} skills on this page; total: {data.get('total', 'unknown')}."]
        for item in data["items"]:
            lines.append(f"- {item.get('name', 'Unnamed')}: skill_code={item.get('skill_code', item.get('code'))}, project_id={item.get('project_id')}, role={item.get('user_role', 'unknown')}.")
        return ToolResult(content="\n".join(lines), data=data)
    state = data.get("status", "draft")
    lines = [f"Skill {data.get('skill_code', data.get('code', ''))}; project_id={data.get('project_id', 'not bound')}; status={state}."]
    for field in ("name", "description", "version", "version_code", "publish_target_type", "review_status", "user_role", "snapshot_path", "prepared_tool_call_id", "publish_task_id", "request_id"):
        if data.get(field) is not None:
            lines.append(f"{field}: {data[field]}")
    if state == "ready":
        lines.append("Not published. Review every file in snapshot_path, then call ask_user with prepared_tool_call_id. Only its explicit human approval can authorize publish_skill.")
    elif state == "under_review":
        lines.append("Submitted for review; not yet published to the selected audience.")
    elif state == "processing":
        lines.append("Export is still processing. Retry prepare_skill_publish with the returned publish_task_id to resume; no release has been created.")
    elif state == "not_submitted":
        lines.append("This preparation has not produced a release. It must still be confirmed before publication.")
    elif state == "draft":
        lines.append("This is an editable draft. A project reference or skill listing does not itself grant write permission.")
    return ToolResult(content="\n".join(lines), ok=state != "failed", data=data)


class ListSkillsParams(ProductParams):
    keyword: str = Field("", max_length=255)
    scope: Literal["created", "collaborated"] = "created"
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


@tool(name="list_skills", code_mode_only=True)
class ListSkills(ProductTool[ListSkillsParams]):
    """Find skill projects accessible to the current user."""
    name = "list_skills"

    async def execute(self, tool_context: ToolContext, params: ListSkillsParams) -> ToolResult:
        async def operation(ctx):
            return projected_page(await ctx.sdk.skill.list_drafts_async(ctx.auth, params.model_dump()), SKILL_FIELDS)
        return await self.run_product(tool_context, "Skill discovery", operation, format_result=skill_result)


class GetSkillParams(ProductParams):
    code: str | None = Field(None, min_length=1, max_length=64)
    project_id: str | None = None

    @model_validator(mode="after")
    def one_identifier(self):
        if (self.code is None) == (self.project_id is None):
            raise ValueError("Supply exactly one code or project_id")
        if self.project_id is not None:
            resource_id(self.project_id, "project_id")
        return self


@tool(name="get_skill", code_mode_only=True)
class GetSkill(ProductTool[GetSkillParams]):
    """Read a skill and resolve its source project without creating anything."""
    name = "get_skill"

    async def execute(self, tool_context: ToolContext, params: GetSkillParams) -> ToolResult:
        async def operation(ctx):
            return await ctx.sdk.skill.get_draft_async(ctx.auth, **params.model_dump())
        return await self.run_product(tool_context, "Skill lookup", operation, format_result=skill_result)


class CreateSkillParams(ProductParams):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, max_length=1024)
    existing_skill_code: str | None = Field(None, min_length=1, max_length=64)
    request_id: str | None = Field(None, min_length=1, max_length=128, description="Reuse the original request_id only to recover an uncertain creation.")


def request_id(tool_context: ToolContext, agent) -> str:
    return hashlib.sha256(f"{agent.get_metadata().get('topic_id')}:{tool_context.tool_call_id}".encode()).hexdigest()


@tool(name="create_skill", code_mode_only=True)
class CreateSkill(ProductTool[CreateSkillParams]):
    """Create a private skill draft and its source project, or restore a missing binding."""
    name = "create_skill"

    async def execute(self, tool_context: ToolContext, params: CreateSkillParams) -> ToolResult:
        async def operation(ctx):
            rid = params.request_id or request_id(tool_context, ctx.agent)
            result = await ctx.sdk.skill.create_draft_async(ctx.auth, {**params.model_dump(exclude_none=True), "request_id": rid})
            return {**result, "request_id": rid}
        result = await self.run_product(tool_context, "Skill draft creation", operation, write=True, format_result=skill_result)
        if not result.ok and result.data.get("code") == "outcome_unknown":
            # The original identity is available even if the response was lost.
            from .context import current_product_context
            ctx = current_product_context(tool_context)
            rid = params.request_id or request_id(tool_context, ctx.agent)
            result.data["request_id"] = rid
            result.content += f" Recover an uncertain creation using request_id={rid}; do not create another draft."
        return result


class PrepareSkillPublishParams(ProductParams):
    code: str = Field(..., min_length=1, max_length=64)
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1024)
    publish_target_type: Literal["PRIVATE", "ORGANIZATION", "MARKET"] | None = None
    version: str | None = Field(None, min_length=1, max_length=32)
    publish_task_id: str | None = Field(None, pattern=r"^[a-f0-9]{64}$")


async def interruptible(ctx, awaitable):
    """HTTP 等待和轮询都响应用户中断；finally 回收子任务。"""
    work = asyncio.create_task(awaitable)
    interrupted = asyncio.create_task(ctx.agent.get_interruption_event().wait())
    try:
        done, _ = await asyncio.wait([work, interrupted], return_when=asyncio.FIRST_COMPLETED)
        if interrupted in done:
            raise asyncio.CancelledError
        return await work
    finally:
        for task in (work, interrupted):
            if not task.done():
                task.cancel()
        await asyncio.gather(work, interrupted, return_exceptions=True)


async def materialize_snapshot(record: dict, agent) -> Path:
    """复制经云端哈希校验的内容供审查；不改写被引用项目。"""
    project_id = resource_id(str(record["project_id"]), "project_id")
    # 与文件工具共享网关注入的 FUSE 根；未显式配置跨项目根时也必须跟随它。
    root = get_referenced_project_mount_base() / project_id / ".magic" / "skills" / record["skill_dir"]
    root = await asyncio.to_thread(root.resolve, strict=True)
    destination = PathManager.get_runtime_dir() / "skill-publish" / record["prepare_token"]
    await async_mkdir(destination, parents=True, exist_ok=True)
    await async_chmod(destination.parent, 0o700)
    await async_chmod(destination, 0o700)
    total = 0
    for relative, digest in record["manifest"].items():
        path = Path(relative)
        if path.is_absolute() or ".." in path.parts:
            raise ValueError("The skill snapshot contains an invalid path")
        source = await asyncio.to_thread((root / path).resolve, strict=True)
        if not source.is_relative_to(root):
            raise ValueError("Skill references cannot escape the skill directory")
        total += (await async_stat(source)).st_size
        if total > 100 * 1024 * 1024:
            raise ValueError("Skill source exceeds the 100 MiB package limit")
        data = await async_read_bytes(source)
        if hashlib.sha256(data).hexdigest() != digest:
            raise ValueError("Source files changed or have not synced. Prepare the skill again.")
        output = destination / path
        await async_mkdir(output.parent, parents=True, exist_ok=True)
        await async_chmod(output.parent, 0o700)
        await async_write_bytes(output, data)
        await async_chmod(output, 0o600)
    await evict_runtime_directories(
        destination.parent,
        policy=RuntimeEvictionPolicy(
            max_entries=get_runtime_config_int("runtime_cleanup.skill_publish.max_directory_count"),
            target_entries=get_runtime_config_int("runtime_cleanup.skill_publish.target_directory_count"),
            max_total_bytes=get_runtime_config_size_bytes("runtime_cleanup.skill_publish.max_total_size"),
            target_total_bytes=get_runtime_config_size_bytes("runtime_cleanup.skill_publish.target_total_size"),
            max_age_seconds=get_runtime_config_int("runtime_cleanup.skill_publish.max_age_hours") * 3600,
        ),
        protected_paths=frozenset({destination}),
    )
    return destination


@tool(name="prepare_skill_publish", code_mode_only=True)
class PrepareSkillPublish(ProductTool[PrepareSkillPublishParams]):
    """Freeze source files for review and human confirmation without publishing."""
    name = "prepare_skill_publish"

    async def execute(self, tool_context: ToolContext, params: PrepareSkillPublishParams) -> ToolResult:
        recovery = {}
        async def operation(ctx):
            confirmation = PreparedOperationConfirmation.from_tool(tool_context)
            if await async_exists(confirmation._path(tool_context.tool_call_id)):
                previous = await confirmation.read(tool_context.tool_call_id)
                if previous.operation != "skill_publish" or previous.payload["skill_code"] != params.code:
                    raise ValueError("The tool call already prepared another operation")
                return {**previous.payload, "prepared_tool_call_id": tool_context.tool_call_id}
            rid = request_id(tool_context, ctx.agent)
            recovery["publish_task_id"] = params.publish_task_id or hashlib.sha256(
                f"{ctx.auth.organization_code}:{ctx.auth.user_id}:{params.code}:{rid}".encode()
            ).hexdigest()
            if params.publish_task_id:
                record = await interruptible(ctx, ctx.sdk.skill.check_preparation_async(ctx.auth, params.code, params.publish_task_id))
            else:
                body = params.model_dump(exclude_none=True, exclude={"code", "publish_task_id"})
                body["request_id"] = rid
                record = await interruptible(ctx, ctx.sdk.skill.prepare_publish_async(ctx.auth, params.code, body))
            for _ in range(30):
                if record["status"] != "processing":
                    break
                await interruptible(ctx, asyncio.sleep(2))
                record = await interruptible(ctx, ctx.sdk.skill.check_preparation_async(ctx.auth, params.code, record["prepare_token"]))
            recovery["publish_task_id"] = record["prepare_token"]
            if record["status"] != "ready":
                return record
            snapshot = await materialize_snapshot(record, ctx.agent)
            record["snapshot_path"] = str(snapshot)
            question = i18n.translate(
                "skill.confirm", category="tool.product", name=record["name"], description=record["description"],
                version=record["version"], count=len(record["manifest"]),
                audience=i18n.translate("skill.audience." + record["publish_target_type"], category="tool.product"),
                previous=i18n.translate("skill.audience." + (record.get("current_publish_target_type") or "none"), category="tool.product"),
            )
            await confirmation.prepare(tool_context.tool_call_id, "skill_publish", record, record["package_sha256"], question)
            return {**record, "prepared_tool_call_id": tool_context.tool_call_id}
        keepalive = start_tool_keep_alive(tool_context)
        try:
            result = await self.run_product(tool_context, "Skill publication preparation", operation, write=True, format_result=skill_result)
            if not result.ok and recovery:
                result.data.update(recovery)
                result.content += f" Preparation task: publish_task_id={recovery['publish_task_id']}. No release has been submitted."
                if result.data.get("code") in {"outcome_unknown", "network_error"}:
                    result.content += " Check or resume this task to recover the uncertain request."
                elif result.data.get("code") in {"resource_files_unavailable", "unexpected_error"}:
                    result.content += " Do not keep polling or create another export with unchanged inputs. Resolve the reported problem first, then resume this same task."
            return result
        finally:
            stop_tool_keep_alive(keepalive)


class PublishSkillParams(ProductParams):
    prepared_tool_call_id: str = Field(..., min_length=1)
    # 兼容旧调用；新调用从准备记录读取实际绑定的真人提问，无须模型传递第二个 ID。
    confirmation_tool_call_id: str | None = Field(None, min_length=1)


@tool(name="publish_skill", code_mode_only=True)
class PublishSkill(ProductTool[PublishSkillParams]):
    """Publish the exact skill snapshot approved through the bound human question."""
    name = "publish_skill"

    async def execute(self, tool_context: ToolContext, params: PublishSkillParams) -> ToolResult:
        async def operation(ctx):
            confirmation = PreparedOperationConfirmation.from_tool(tool_context)
            async with confirmation._locks.setdefault(str(confirmation._path(params.prepared_tool_call_id)), asyncio.Lock()):
                record = await confirmation.read(params.prepared_tool_call_id)
                if params.confirmation_tool_call_id is not None and record.confirmation_tool_call_id != params.confirmation_tool_call_id:
                    raise PreparedOperationError(
                        "CONFIRMATION_MISMATCH",
                        "The supplied confirmation ID does not match the bound human question. "
                        "Retry publish_skill with only prepared_tool_call_id; do not ask the user again.",
                    )
                if record.operation != "skill_publish" or not record.confirmation_tool_call_id or record.state not in {"approved", "executing", "completed"}:
                    raise PreparedOperationError(
                        "CONFIRMATION_REQUIRED",
                        "This exact skill snapshot requires explicit human confirmation through its bound ask_user question. "
                        "If the question is pending, wait for the user's answer; do not prepare or ask again.",
                    )
                if record.state == "completed":
                    return record.result
                record.state = "executing"
                await confirmation.save(record)
                # Retry uses the same token. The server recovers a committed version before attempting another write.
                result = await interruptible(ctx, ctx.sdk.skill.publish_prepared_async(ctx.auth, record.payload["skill_code"], record.payload["prepare_token"]))
                record.state, record.result = "completed", result
                await confirmation.save(record)
                return result
        keepalive = start_tool_keep_alive(tool_context)
        try:
            return await self.run_product(tool_context, "Skill publication", operation, write=True, format_result=skill_result)
        finally:
            stop_tool_keep_alive(keepalive)


class SkillPublishResultParams(ProductParams):
    code: str = Field(..., min_length=1, max_length=64)
    publish_task_id: str | None = Field(None, pattern=r"^[a-f0-9]{64}$")


@tool(name="get_skill_publish_result", code_mode_only=True)
class GetSkillPublishResult(ProductTool[SkillPublishResultParams]):
    """Check the actual release or review state without submitting another release."""
    name = "get_skill_publish_result"

    async def execute(self, tool_context: ToolContext, params: SkillPublishResultParams) -> ToolResult:
        async def operation(ctx):
            result = await ctx.sdk.skill.publish_result_async(ctx.auth, params.code, params.publish_task_id)
            if "list" in result:
                page = projected_page(result, ("id", "version", "publish_status", "review_status", "publish_target_type"))
                return {"skill_code": params.code, "versions": page.pop("items"), **page}
            return result
        return await self.run_product(tool_context, "Skill publication status", operation, format_result=skill_result)
