from __future__ import annotations

import hashlib
import html
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import TYPE_CHECKING

from agentlang.chat_history.chat_history import ChatHistory
from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from app.service.memory.policies.memory_file_budget import get_memory_md_budget
from app.service.memory.policies.memory_scope import MemoryScopeKind, resolve_memory_scopes
from app.service.memory.policies.memory_skill_policy import is_auto_memory_enabled, is_memory_skill_available
from app.service.channel_context_service import ChannelContextService
from agentlang.tools.tool_result import ToolResult
from app.tools.read_file import ReadFile, ReadFileParams
from app.utils.async_file_utils import (
    async_exists,
    async_is_dir,
)

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from app.utils.file_utils import WorkspaceEntry

logger = get_logger(__name__)

_AUTO_READ_SOURCE_PREFIX = "auto_read_file:"
_INSTRUCTION_INDEX_SOURCE_PREFIX = "project_instruction_index:"
_INSTRUCTION_INDEX_MAX_CHARS = 24 * 1024


class AutoReadLoadPolicy(StrEnum):
    """自动文件规则的正文加载策略。"""

    ALWAYS = "always"
    DISCOVER_ONLY = "discover_only"


class AutoReadRuleId(StrEnum):
    """模型可见的自动文件角色。"""

    PROJECT_INSTRUCTIONS = "project_instructions"
    GLOBAL_MEMORY = "global_memory"
    PROJECT_MEMORY = "project_memory"
    CLAW_MEMORY = "claw_memory"
    CHANNEL_SKILL = "channel_skill"


class AutoReadPathKind(StrEnum):
    """规则候选路径的解析方式。"""

    WORKSPACE_ROOT_AGENTS = "workspace_root_agents"
    NESTED_AGENTS = "nested_agents"
    GLOBAL_MEMORY = "global_memory"
    PROJECT_MEMORY = "project_memory"
    CLAW_MEMORY = "claw_memory"
    CHANNEL_SKILL_FILES = "channel_skill_files"


@dataclass(frozen=True)
class AutoReadFileRule:
    """声明自动文件的角色、加载方式和路径来源。"""

    rule_id: AutoReadRuleId
    load_policy: AutoReadLoadPolicy
    path_kind: AutoReadPathKind
    priority: int


@dataclass(frozen=True)
class AutoReadFileCandidate:
    """已完成作用域和安全校验的自动文件候选。"""

    rule_id: AutoReadRuleId
    load_policy: AutoReadLoadPolicy
    absolute_path: Path
    display_path: str
    scope: str
    priority: int


AUTO_READ_FILE_RULES: tuple[AutoReadFileRule, ...] = (
    AutoReadFileRule(
        rule_id=AutoReadRuleId.PROJECT_INSTRUCTIONS,
        load_policy=AutoReadLoadPolicy.ALWAYS,
        path_kind=AutoReadPathKind.WORKSPACE_ROOT_AGENTS,
        priority=10,
    ),
    AutoReadFileRule(
        rule_id=AutoReadRuleId.GLOBAL_MEMORY,
        load_policy=AutoReadLoadPolicy.ALWAYS,
        path_kind=AutoReadPathKind.GLOBAL_MEMORY,
        priority=20,
    ),
    AutoReadFileRule(
        rule_id=AutoReadRuleId.PROJECT_MEMORY,
        load_policy=AutoReadLoadPolicy.ALWAYS,
        path_kind=AutoReadPathKind.PROJECT_MEMORY,
        priority=30,
    ),
    AutoReadFileRule(
        rule_id=AutoReadRuleId.CLAW_MEMORY,
        load_policy=AutoReadLoadPolicy.ALWAYS,
        path_kind=AutoReadPathKind.CLAW_MEMORY,
        priority=40,
    ),
    AutoReadFileRule(
        rule_id=AutoReadRuleId.PROJECT_INSTRUCTIONS,
        load_policy=AutoReadLoadPolicy.DISCOVER_ONLY,
        path_kind=AutoReadPathKind.NESTED_AGENTS,
        priority=50,
    ),
    AutoReadFileRule(
        rule_id=AutoReadRuleId.CHANNEL_SKILL,
        load_policy=AutoReadLoadPolicy.ALWAYS,
        path_kind=AutoReadPathKind.CHANNEL_SKILL_FILES,
        priority=60,
    ),
)


class AutoReadFileService:
    """在每次真实模型调用前统一发现并读取声明式自动文件。"""

    @classmethod
    async def resolve_memory_file_candidates(
        cls,
        agent_context: "AgentContext",
    ) -> tuple[AutoReadFileCandidate, ...]:
        """解析当前 Agent 可访问的全局和项目记忆文件候选。"""
        candidates = await cls._resolve_candidates(agent_context, None)
        return tuple(
            candidate
            for candidate in candidates
            if candidate.rule_id
            in {AutoReadRuleId.GLOBAL_MEMORY, AutoReadRuleId.PROJECT_MEMORY}
        )

    @classmethod
    async def prepare_before_llm(
        cls,
        agent_context: "AgentContext",
        chat_history: ChatHistory,
        *,
        workspace_entries: list["WorkspaceEntry"] | None = None,
    ) -> None:
        """使用现有工作区快照追加规则索引，并通过 ReadFile 交付自动文件。"""
        if not chat_history._is_tool_call_sequence_complete():
            return
        try:
            candidates = await cls._resolve_candidates(agent_context, workspace_entries, chat_history)
            await cls._append_instruction_index(chat_history, candidates)
            await cls._append_always_read_files(agent_context, chat_history, candidates)
        except Exception as error:
            logger.warning(f"自动文件准备失败，本轮继续执行: {error}", exc_info=True)

    @classmethod
    async def _resolve_candidates(
        cls,
        agent_context: "AgentContext",
        workspace_entries: list["WorkspaceEntry"] | None,
        chat_history: ChatHistory | None = None,
    ) -> tuple[AutoReadFileCandidate, ...]:
        candidates: list[AutoReadFileCandidate] = []
        for rule in AUTO_READ_FILE_RULES:
            try:
                candidates.extend(await cls._resolve_rule(agent_context, rule, workspace_entries))
            except Exception as error:
                logger.warning(
                    "自动文件规则解析失败，已跳过: "
                    f"rule_id={rule.rule_id.value} path_kind={rule.path_kind.value} error={error}",
                    exc_info=True,
                )
                if chat_history is not None:
                    notice = (
                        f"AutoRead could not resolve '{rule.rule_id.value}' ({type(error).__name__}). "
                        "Its required knowledge has not been loaded. Continue the task, but do not assume "
                        "this rule's files were read; use the available skill or file-reading tools when needed."
                    )
                    source = f"{_AUTO_READ_SOURCE_PREFIX}notice:{hashlib.sha256(notice.encode('utf-8')).hexdigest()[:20]}"
                    if not cls._has_source(chat_history, source):
                        await chat_history.append_user_message(
                            f"<system_injected_context>\n{notice}\n</system_injected_context>",
                            show_in_ui=False, source=source,
                        )

        deduplicated: dict[str, AutoReadFileCandidate] = {}
        for candidate in sorted(
            candidates,
            key=lambda item: (item.priority, len(Path(item.display_path).parts), item.display_path),
        ):
            path_key = str(candidate.absolute_path.absolute())
            existing = deduplicated.get(path_key)
            if existing is None or candidate.load_policy == AutoReadLoadPolicy.ALWAYS:
                deduplicated[path_key] = candidate

        return tuple(
            sorted(
                deduplicated.values(),
                key=lambda item: (item.priority, len(Path(item.display_path).parts), item.display_path),
            )
        )

    @classmethod
    async def _resolve_rule(
        cls,
        agent_context: "AgentContext",
        rule: AutoReadFileRule,
        workspace_entries: list["WorkspaceEntry"] | None,
    ) -> list[AutoReadFileCandidate]:
        if (
            rule.rule_id in {AutoReadRuleId.GLOBAL_MEMORY, AutoReadRuleId.PROJECT_MEMORY}
            and not (is_auto_memory_enabled(agent_context) and is_memory_skill_available(agent_context))
        ):
            return []

        workspace_dir = Path(agent_context.get_workspace_dir()).absolute()

        if rule.path_kind == AutoReadPathKind.CHANNEL_SKILL_FILES:
            candidates: list[AutoReadFileCandidate] = []
            for file_path in await ChannelContextService.resolve_auto_read_files(agent_context):
                candidates.extend(await cls._single_candidate(
                    rule, file_path, display_path=str(file_path), scope="active-im-channels",
                    require_exists=False,
                ))
            return candidates

        if rule.path_kind == AutoReadPathKind.WORKSPACE_ROOT_AGENTS:
            return await cls._single_candidate(
                rule,
                workspace_dir / "AGENTS.md",
                display_path="AGENTS.md",
                scope=".",
            )
        if rule.path_kind == AutoReadPathKind.NESTED_AGENTS:
            return cls._resolve_nested_agents_from_snapshot(workspace_dir, rule, workspace_entries)
        if rule.path_kind in {AutoReadPathKind.GLOBAL_MEMORY, AutoReadPathKind.PROJECT_MEMORY}:
            """
            自动读取只挑作用域解析器给出的主文件，不自行生成另一套 project_id 路径。
            Claw 没有普通项目作用域，稍后的 CLAW_MEMORY 分支仍处理它自己的启动记忆。
            """
            scope_kind = MemoryScopeKind.GLOBAL if rule.path_kind == AutoReadPathKind.GLOBAL_MEMORY else MemoryScopeKind.PROJECT
            memory_scope = next((scope for scope in resolve_memory_scopes(agent_context) if scope.kind == scope_kind), None)
            if memory_scope is None:
                return []
            return await cls._single_candidate(
                rule,
                memory_scope.memory_file,
                display_path=str(memory_scope.memory_file),
                scope="user-global" if scope_kind == MemoryScopeKind.GLOBAL else f"user-project:{memory_scope.root.name[2:]}",
            )
        if rule.path_kind == AutoReadPathKind.CLAW_MEMORY:
            if not agent_context.is_magiclaw():
                return []
            claw_path = workspace_dir / ".magic" / "MEMORY.md"
            return await cls._single_candidate(
                rule,
                claw_path,
                display_path=".magic/MEMORY.md",
                scope="claw-runtime",
            )
        return []

    @classmethod
    async def _single_candidate(
        cls,
        rule: AutoReadFileRule,
        file_path: Path,
        *,
        display_path: str,
        scope: str,
        require_exists: bool = True,
    ) -> list[AutoReadFileCandidate]:
        if require_exists and not await cls._is_safe_regular_file(file_path):
            return []
        return [
            AutoReadFileCandidate(
                rule_id=rule.rule_id,
                load_policy=rule.load_policy,
                absolute_path=file_path.absolute(),
                display_path=display_path,
                scope=scope,
                priority=rule.priority,
            )
        ]

    @classmethod
    def _resolve_nested_agents_from_snapshot(
        cls,
        workspace_dir: Path,
        rule: AutoReadFileRule,
        workspace_entries: list["WorkspaceEntry"] | None,
    ) -> list[AutoReadFileCandidate]:
        if not workspace_entries:
            return []

        candidates: list[AutoReadFileCandidate] = []
        for entry in workspace_entries:
            relative_path = str(entry["path"]).strip()
            if not relative_path or relative_path.endswith("/"):
                continue
            path = Path(relative_path)
            if path.name != "AGENTS.md" or relative_path == "AGENTS.md":
                continue
            if ".magic" in path.parts:
                continue
            scope_path = path.parent.as_posix()
            candidates.append(
                AutoReadFileCandidate(
                    rule_id=rule.rule_id,
                    load_policy=rule.load_policy,
                    absolute_path=(workspace_dir / path).absolute(),
                    display_path=relative_path,
                    scope=f"{scope_path}/",
                    priority=rule.priority,
                )
            )
        return candidates

    @staticmethod
    async def _is_safe_regular_file(file_path: Path) -> bool:
        candidate = file_path.expanduser().absolute()
        return await async_exists(candidate) and not await async_is_dir(candidate)

    @classmethod
    async def _append_instruction_index(
        cls,
        chat_history: ChatHistory,
        candidates: tuple[AutoReadFileCandidate, ...],
    ) -> None:
        nested_candidates = [
            candidate
            for candidate in candidates
            if candidate.load_policy == AutoReadLoadPolicy.DISCOVER_ONLY
        ]
        index_lines = [
            "<system_injected_context>",
            '<available_project_instructions state="current">',
            (
                "These nested AGENTS.md files are discoverable project instructions. Their paths are indexed, "
                "but their contents have not been read. After locating a target path, read every applicable "
                "indexed AGENTS.md from the shallowest scope to the deepest scope before reading in detail, "
                "modifying files, or running commands that affect that path."
            ),
        ]
        omitted_count = 0
        truncation_reasons: set[str] = set()
        for order, candidate in enumerate(nested_candidates, start=1):
            line = (
                f'<instruction path="{html.escape(candidate.display_path, quote=True)}" '
                f'scope="{html.escape(candidate.scope, quote=True)}" order="{order}" />'
            )
            projected_content = "\n".join(
                (*index_lines, line, "</available_project_instructions>", "</system_injected_context>")
            )
            if len(projected_content) > _INSTRUCTION_INDEX_MAX_CHARS:
                omitted_count += 1
                truncation_reasons.add("max_index_chars")
                continue
            index_lines.append(line)
        if omitted_count:
            reason = ",".join(sorted(truncation_reasons)) or "max_index_chars"
            index_lines.append(
                f'<index_status truncated="true" reason="{html.escape(reason, quote=True)}" '
                f'omitted_count="{omitted_count}">'
                "Use file search to locate additional AGENTS.md files before changing an unlisted directory."
                "</index_status>"
            )
        index_lines.extend(("</available_project_instructions>", "</system_injected_context>"))
        content = "\n".join(index_lines)
        fingerprint = hashlib.sha256(content.encode("utf-8")).hexdigest()[:20]
        source = f"{_INSTRUCTION_INDEX_SOURCE_PREFIX}{fingerprint}"
        if cls._has_source(chat_history, source):
            return
        await chat_history.append_user_message(content, show_in_ui=False, source=source)

    @classmethod
    async def _append_always_read_files(
        cls,
        agent_context: "AgentContext",
        chat_history: ChatHistory,
        candidates: tuple[AutoReadFileCandidate, ...],
    ) -> None:
        workspace_dir = Path(agent_context.get_workspace_dir())
        tool_context = ToolContext(metadata=agent_context.get_metadata())
        tool_context.register_extension("agent_context", agent_context)
        read_file = ReadFile(base_dir=workspace_dir)

        for candidate in candidates:
            if candidate.load_policy != AutoReadLoadPolicy.ALWAYS:
                continue
            source = cls._build_file_source(candidate.absolute_path)
            if await agent_context.horizon.has_complete_file_read(candidate.absolute_path):
                continue

            version_before = await agent_context.horizon.get_current_file_version(candidate.absolute_path)
            delivery_source = f"{source}:version:{version_before}"
            # 自动交付一次截断前缀也能避免重复读取，但不赋予全文凭据或限制手动续读。
            # source 随当前聊天窗口保存；文件变化或窗口重置后自然允许重新交付。
            if version_before is not None and cls._has_source(chat_history, delivery_source):
                continue

            source_max_tokens = None
            if candidate.rule_id in {AutoReadRuleId.GLOBAL_MEMORY, AutoReadRuleId.PROJECT_MEMORY, AutoReadRuleId.CLAW_MEMORY}:
                """
                每份主文件独立给额度；这里限制本次自动交付，不删除或截短磁盘上的记忆。
                超限内容如何保留到 notes，由后续维护 Skill 决定，不由读取服务做摘要。
                """
                budget = get_memory_md_budget()
                if budget is None:
                    continue
                source_max_tokens = budget.max_tokens
            result = await read_file.execute(
                tool_context,
                ReadFileParams(
                    file_path=str(candidate.absolute_path),
                    offset=0,
                    limit=-1,
                ),
                source_max_tokens=source_max_tokens,
                allow_fuzzy_match=False,
                record_read=False,
            )
            if not result.ok:
                logger.warning(
                    "自动读取文件失败: "
                    f"rule_id={candidate.rule_id.value} path={candidate.display_path} content={result.content}"
                )

            info = result.extra_info or {}
            truncated = bool(info.get("was_truncated"))
            source_content = info.get("source_content")
            version_after = await agent_context.horizon.get_current_file_version(candidate.absolute_path)
            stable_version = version_before is not None and version_before == version_after
            complete = result.ok and stable_version and not truncated and isinstance(source_content, str)
            if not result.ok or not stable_version:
                # 失败可以重试；通知去重与成功交付分开，不把读到 A 的正文登记到新版本 B。
                status = "failed" if not result.ok else "unstable"
                result_hash = hashlib.sha256(result.content.encode("utf-8")).hexdigest()[:20] if not result.ok else ""
                delivery_source = f"{source}:{status}:{version_before}:{version_after}:{result_hash}"
            if cls._has_source(chat_history, delivery_source):
                continue
            state = "current" if complete else "incomplete"
            version_notice = (
                " The file version could not be confirmed stable during reading; this result is incomplete."
                if result.ok and not stable_version else ""
            )

            content = "\n".join(
                (
                    "<system_injected_context>",
                    (
                        f'<auto_read_file state="{state}" rule_id="{candidate.rule_id.value}" '
                        f'path="{html.escape(candidate.display_path, quote=True)}" '
                        f'scope="{html.escape(candidate.scope, quote=True)}">'
                    ),
                    (
                        "The runtime called read_file for this file. Use the delivered content and respect any "
                        "failure or truncation notice; an incomplete result is not a full read. "
                        "The shared file-loading mechanism does not change the file's ownership or authority."
                        + version_notice
                    ),
                    "<read_file_result>",
                    html.escape(result.content, quote=False),
                    "</read_file_result>",
                    "</auto_read_file>",
                    "</system_injected_context>",
                )
            )
            await chat_history.append_user_message(content, show_in_ui=False, source=delivery_source)
            if stable_version:
                await read_file.record_read_result(
                    tool_context,
                    ReadFileParams(file_path=str(candidate.absolute_path), offset=0, limit=-1),
                    result,
                )

    @staticmethod
    async def read_changed_file(file_path: str, max_tokens: int) -> ToolResult:
        """
        Horizon 选择全文表达时仍执行真正的 ReadFile，保留行号和截断说明。
        不传 ToolContext：结果尚未决定是否展示，不能让工具提前改写 Horizon 的已知版本。
        文件记录仍由 Horizon 在原有整包预算判断通过之后更新，不引入跨模块提交协议。
        例：Diff 9K、当前全文 10K，Horizon 选择全文后调用本入口；返回值仍含真实行号与截断标记。
        本方法接受任何已选中的文件，不根据名字判断 AGENTS.md 或 MEMORY.md 是否更重要。
        """
        return await ReadFile(base_dir=Path(file_path).parent).execute_purely(
            ReadFileParams(file_path=file_path, offset=0, limit=-1), max_tokens=max_tokens,
        )

    @staticmethod
    def _build_file_source(file_path: Path) -> str:
        path_hash = hashlib.sha256(str(file_path.absolute()).encode("utf-8")).hexdigest()[:20]
        return f"{_AUTO_READ_SOURCE_PREFIX}{path_hash}"

    @staticmethod
    def _has_source(chat_history: ChatHistory, source: str) -> bool:
        return any(getattr(message, "source", None) == source for message in chat_history.messages)
