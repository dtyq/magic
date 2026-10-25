#!/usr/bin/env python
"""真实请求模型验证聊天记录压缩链路。

这个脚本专门给「全真上下文压缩测试」使用，不是 mock，也不是只测本地逻辑。
它会加载项目 `.env`、读取 `config/config.yaml`、通过 magic-service `/v1/models`
加载动态模型列表，然后构造一段真实长聊天记录并向模型发送真实 LLM 请求。

推荐测试顺序：

```bash
# 1. 手动 /compact 路径：验证 compact 请求、工具调用、压缩应用、模型恢复。
source .venv/bin/activate
python scripts/verify_real_compaction.py foreground --json

# 2. 预压缩路径：这是风险最高的新功能路径。
# first_check_result=false 表示第一次检查只启动后台摘要，不立即改写历史；
# second_check_result=true 表示后台摘要完成后，第二次检查成功应用预压缩结果。
python scripts/verify_real_compaction.py precompact --json

# 3. 后台压缩路径：验证后台 subagent 能独立生成摘要并应用到主历史。
python scripts/verify_real_compaction.py background --json
```

当前默认模型：
- 主模型 `--runtime-model`：deepseek-v4-flash
- 压缩模型 `--compact-model`：deepseek-v4-flash

默认 `--load-dynamic-models` 已开启，并且脚本默认要求 runtime/compact 两个模型都来自
magic-service。只有在排查静态 config.yaml provider 时才使用 `--allow-static-models` 或
`--skip-dynamic-models`，否则真实测试会被削弱。

默认压测规模不是小样本：
- foreground/background: 120,000 target tokens
- precompact: 190,000 target tokens

判断结果时重点看这些字段：
- `ok=true`：整体验证通过。
- `runtime_provider_source` / `compact_provider_source`：应该是 `magic-service`。
- `tokens_before > tokens_after` 且 `history_message_count_before > history_message_count_after`。
- `main_model_after` / `runtime_model_after`：压缩完成后当前文本模型应恢复为 runtime model。
- precompact 额外看 `background_started=true`、`background_completed=true`、
  `summary_ok=true`、`apply_ok=true`、`first_check_result=false`、`second_check_result=true`。

需要人工检查压缩质量时，加 `--keep-artifacts`。脚本会保留主 Agent 的压缩后
chat history、`compacted/{agent_name}<{agent_id}>_{YYYYMMDDHHMMSS}.json`，以及 `.runtime/background_compact/` 下对应
subagent 的历史和 token usage。检查完临时产物后用 `trash` 清理，不要用 `rm`。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal, Optional


Mode = Literal["background", "precompact", "foreground"]

_VERIFICATION_MAX_DIR_COUNT = 10
_VERIFICATION_TARGET_DIR_COUNT = 8
_VERIFICATION_MAX_TOTAL_BYTES = 512 * 1024 * 1024
_VERIFICATION_TARGET_TOTAL_BYTES = 384 * 1024 * 1024
_VERIFICATION_RETENTION_SECONDS = 7 * 24 * 60 * 60
_VERIFICATION_ACTIVE_GRACE_SECONDS = 60 * 60


@dataclass
class VerificationResult:
    ok: bool
    mode: str
    agent_name: str
    agent_id: str
    artifact_dir: str
    runtime_model: str
    compact_model: str
    runtime_api_model: str
    runtime_base_url: str
    runtime_provider_source: str
    compact_api_model: str
    compact_base_url: str
    compact_provider_source: str
    tokens_before: int
    tokens_after: int
    hard_threshold: int
    early_threshold: int
    threshold_rule: Optional[str]
    background_started: bool
    background_completed: bool
    summary_ok: bool
    summary_chars: int
    apply_ok: bool
    first_check_result: Optional[bool]
    second_check_result: Optional[bool]
    history_message_count_before: int
    history_message_count_after: int
    main_model_after: Optional[str]
    runtime_model_after: Optional[str]
    subagent_id: Optional[str]
    subagent_status: Optional[str]
    subagent_error: Optional[str]
    artifacts_cleaned: bool
    elapsed_seconds: float
    error: Optional[str]


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _load_env(project_root: Path) -> None:
    try:
        from dotenv import load_dotenv
    except ImportError as exc:
        raise RuntimeError("python-dotenv is required to load the project .env file") from exc

    load_dotenv(project_root / ".env", override=False)
    os.environ.setdefault("SANDBOX_ID", "default")
    os.environ.setdefault("SUPER_MAGIC_PROJECT_ROOT", str(project_root))
    os.environ.setdefault("AUTO_REGENERATE_TOOL_DEFINITIONS", "false")


async def _bootstrap(project_root: Path, *, load_dynamic_models: bool) -> None:
    _load_env(project_root)
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    from agentlang.context.application_context import ApplicationContext
    from agentlang.config.config import config
    from agentlang.config.models.model_config_manager import model_config_manager
    from agentlang.config.models.providers.config_yaml_provider import ConfigYamlProvider
    from app.core.model_providers.model_filter import should_skip_model
    from app.path_manager import PathManager

    PathManager.set_project_root(project_root)
    ApplicationContext.set_path_manager(PathManager)
    config.load_config(str(project_root / "config" / "config.yaml"))
    providers = [ConfigYamlProvider(model_filter=should_skip_model)]
    if load_dynamic_models:
        from app.core.model_providers.magic_service_provider import MagicServiceProvider

        class EnvMagicServiceProvider(MagicServiceProvider):
            def _get_credentials(self):
                return os.environ.get("MAGIC_API_BASE_URL", "").rstrip("/"), (
                    os.environ.get("MAGIC_USER_AUTHORIZATION") or None
                )

        providers.append(EnvMagicServiceProvider())

    await model_config_manager.initialize(providers)
    if load_dynamic_models:
        from app.core.model_providers.magic_service_provider import PROVIDER_TYPE

        if not model_config_manager.is_provider_loaded(PROVIDER_TYPE):
            raise RuntimeError("magic-service model provider did not load; real dynamic model verification is unavailable")

    # 脚本不是 ws_server 启动路径，必须显式导入工具包并扫描，否则 LLM 看不到 compact_chat_history。
    import app.service  # noqa: F401
    import app.tools  # noqa: F401
    from app.tools.core.tool_factory import tool_factory

    tool_factory.initialize()
    if not tool_factory.get_tool_param_from_definition("compact_chat_history"):
        raise RuntimeError("compact_chat_history tool is not registered")


def _make_run_id(mode: Mode) -> str:
    return f"verify-{mode}-{uuid.uuid4().hex[:12]}"


def _verification_root() -> Path:
    from app.path_manager import PathManager

    return PathManager.get_runtime_dir() / "verification" / "real_compaction"


def _verification_artifact_dir(agent_id: str) -> Path:
    if not agent_id or Path(agent_id).name != agent_id or agent_id in {".", ".."}:
        raise ValueError("agent_id must be a non-empty single path segment")
    return _verification_root() / agent_id


@dataclass(frozen=True, slots=True)
class _VerificationArtifact:
    path: Path
    size: int
    modified_at: float


async def _prepare_verification_artifacts() -> None:
    from app.utils.async_file_utils import async_rmtree, async_scandir, async_stat
    from app.utils.runtime_storage import ensure_runtime_directory

    root = await ensure_runtime_directory(_verification_root())
    artifacts: list[_VerificationArtifact] = []
    for entry in await async_scandir(root):
        if entry.is_symlink() or not entry.is_dir(follow_symlinks=False):
            continue
        path = Path(entry.path)
        stat = await async_stat(path)
        artifacts.append(
            _VerificationArtifact(
                path=path,
                size=await _directory_size(path),
                modified_at=stat.st_mtime,
            )
        )

    artifacts.sort(key=lambda item: item.modified_at)
    now = time.time()
    expired = [
        item
        for item in artifacts
        if item.modified_at < now - _VERIFICATION_RETENTION_SECONDS
    ]
    for item in expired:
        await async_rmtree(item.path)

    expired_paths = {item.path for item in expired}
    remaining = [item for item in artifacts if item.path not in expired_paths]
    total_bytes = sum(item.size for item in remaining)
    if (
        len(remaining) <= _VERIFICATION_MAX_DIR_COUNT
        and total_bytes <= _VERIFICATION_MAX_TOTAL_BYTES
    ):
        return

    remaining_count = len(remaining)
    capacity_candidates = [
        item
        for item in remaining
        if item.modified_at < now - _VERIFICATION_ACTIVE_GRACE_SECONDS
    ]
    for item in capacity_candidates:
        if (
            remaining_count <= _VERIFICATION_TARGET_DIR_COUNT
            and total_bytes <= _VERIFICATION_TARGET_TOTAL_BYTES
        ):
            break
        await async_rmtree(item.path)
        remaining_count -= 1
        total_bytes -= item.size


async def _directory_size(directory: Path) -> int:
    from app.utils.async_file_utils import async_scandir, async_stat

    total = 0
    for entry in await async_scandir(directory):
        if entry.is_symlink():
            continue
        path = Path(entry.path)
        if entry.is_dir(follow_symlinks=False):
            total += await _directory_size(path)
        elif entry.is_file(follow_symlinks=False):
            try:
                total += (await async_stat(path)).st_size
            except FileNotFoundError:
                continue
    return total


async def _make_agent(
    *,
    agent_name: str,
    agent_id: str,
    runtime_model: str,
):
    from app.core.context.agent_context import AgentContext
    from app.core.models.agent_model_selection import AgentModelSelection
    from app.magic.agent import Agent
    from app.utils.runtime_storage import ensure_runtime_directory

    artifact_dir = await ensure_runtime_directory(
        _verification_artifact_dir(agent_id)
    )
    context = AgentContext(isolated=True)
    context.set_agent_name(agent_name)
    context.set_sandbox_id(os.environ.get("SANDBOX_ID", "default"))
    context.set_chat_history_dir(str(artifact_dir))

    agent = Agent(agent_name, agent_id=agent_id, agent_context=context)
    agent.agent_context.model_context.apply_selection(
        AgentModelSelection(
            configured_text_model_id=runtime_model,
            text_model_id=runtime_model,
        )
    )
    await agent.chat_history.load()
    return agent


async def _populate_history(agent, target_tokens: int) -> None:
    from agentlang.chat_history.chat_history_models import AssistantMessage, SystemMessage, UserMessage

    if target_tokens <= 0:
        raise ValueError("--target-tokens must be positive")

    base_user = (
        "User request: analyze the current implementation, preserve all important decisions, "
        "include file paths, errors, command outputs, and next actions. "
    )
    base_assistant = (
        "Assistant work log: inspected model routing, compaction thresholds, tool registration, "
        "configuration loading, real provider calls, and pending verification steps. "
    )
    block = (
        "This is realistic long-running engineering context with repeated but varied operational notes. "
        "The compaction summary must keep model names, config values, thresholds, failures, and decisions. "
    )

    messages = [SystemMessage(content=agent.system_prompt, show_in_ui=False)]
    turn = 0

    while True:
        user_repeat = 180 + (turn % 7) * 10
        assistant_repeat = 180 + (turn % 5) * 12
        messages.append(
            UserMessage(
                content=f"{base_user}Turn {turn}.\n" + block * user_repeat,
                show_in_ui=True,
            )
        )
        messages.append(
            AssistantMessage(
                content=f"{base_assistant}Turn {turn}.\n" + block * assistant_repeat,
                show_in_ui=True,
            )
        )
        await agent.chat_history.replace_messages(messages)
        tokens = await agent.chat_history.tokens_count()
        if tokens >= target_tokens:
            return
        turn += 1
        if turn > 200:
            raise RuntimeError(f"Unable to reach target tokens: current={tokens}, target={target_tokens}")


def _subagent_id(agent) -> Optional[str]:
    state = agent._bg_compact_state
    generation = getattr(state, "generation", "")
    if not generation:
        return None
    parent_context_id = getattr(agent.agent_context, "context_id", "") or "unknown-parent"
    return f"bg-compact-{parent_context_id}-{generation[:12]}"


async def _load_subagent_state(agent_name: str, subagent_id: Optional[str]):
    if not subagent_id:
        return None
    from app.tools.subagent_runtime_store import SubagentRuntimeStore

    return await SubagentRuntimeStore.load_state(agent_name, subagent_id)


async def _snapshot_debug_files() -> set[Path]:
    from app.path_manager import PathManager
    from app.utils.async_file_utils import async_exists, async_iterdir

    debug_dir = PathManager.get_llm_requests_dir()
    if not await async_exists(debug_dir):
        return set()
    return set(await async_iterdir(debug_dir))


async def _cleanup_run_artifacts(
    *,
    agent,
    agent_name: str,
    subagent_id: Optional[str],
    debug_files_before: set[Path],
) -> bool:
    from app.path_manager import PathManager
    from app.utils.async_file_utils import async_exists, async_iterdir, async_rmtree, async_unlink

    cleaned = False
    if agent is not None:
        chat_history_dir = Path(agent.chat_history.chat_history_dir)
        if await async_exists(chat_history_dir):
            await async_rmtree(chat_history_dir)
            cleaned = True

    if subagent_id:
        subagent_dir = PathManager.get_subagent_chat_history_dir(agent_name, subagent_id)
        if await async_exists(subagent_dir):
            await async_rmtree(subagent_dir)
            cleaned = True

    debug_dir = PathManager.get_llm_requests_dir()
    if await async_exists(debug_dir):
        for path in await async_iterdir(debug_dir):
            if path not in debug_files_before:
                await async_unlink(path)
                cleaned = True

    return cleaned


async def _cancel_agent_background_task(agent, timeout: float = 10.0) -> None:
    task = getattr(getattr(agent, "_bg_compact_state", None), "_task", None)
    if task is None or task.done():
        return
    task.cancel()
    try:
        await asyncio.wait_for(asyncio.shield(task), timeout=timeout)
    except asyncio.TimeoutError:
        return
    except asyncio.CancelledError:
        return
    except Exception:
        return


def _is_magic_service_model(model_config) -> bool:
    return getattr(model_config, "provider_source", "") == "magic-service"


async def _await_background(agent, timeout: int) -> tuple[bool, Optional[str], Optional[str]]:
    task = agent._bg_compact_state._task
    if task is None:
        return False, None, None

    try:
        await asyncio.wait_for(asyncio.shield(task), timeout=timeout)
    except asyncio.TimeoutError:
        return False, None, f"background compaction timed out after {timeout}s"

    summary = agent._bg_compact_state.get_summary()
    if isinstance(summary, str) and summary.strip():
        return True, summary, None
    return True, None, "background compaction finished without a valid summary"


def _get_model_config(model_id: str):
    from agentlang.llms.factory import LLMFactory

    return LLMFactory.get_model_config(model_id, expected_type="llm", allow_fallback=False)


def _get_registry_model_config(model_id: str):
    from agentlang.config.models.model_config_manager import model_config_manager

    model_config = model_config_manager.get(model_id)
    if model_config is None:
        raise RuntimeError(f"model is not registered: {model_id}")
    return model_config


def _current_compact_model() -> str:
    from app.core.ai_abilities import get_compact_model_id

    return get_compact_model_id() or ""


def _thresholds(agent, runtime_model: str) -> tuple[int, int, Optional[str]]:
    result = agent.compaction_config.resolve_threshold_for_model(runtime_model)
    agent.compaction_config.agent_model_id = runtime_model
    agent.compaction_config.token_threshold = result.token_threshold
    agent.compaction_config._resolved_token_threshold_model_id = runtime_model
    return result.token_threshold, agent.compaction_config.early_compact_threshold, result.matched_rule_name


async def _run_verification(args: argparse.Namespace) -> VerificationResult:
    started_at = time.time()
    project_root = _project_root()
    await _bootstrap(project_root, load_dynamic_models=args.load_dynamic_models)
    from agentlang.agent.models import AgentRunRequest

    await _prepare_verification_artifacts()
    debug_files_before = await _snapshot_debug_files()

    runtime_model = args.runtime_model
    compact_model = args.compact_model or _current_compact_model()
    if args.compact_model:
        from agentlang.config.config import config

        config.set("ai_abilities.compact.model_id", args.compact_model)

    runtime_config = _get_model_config(runtime_model)
    compact_config = _get_model_config(compact_model)
    runtime_registry_config = _get_registry_model_config(runtime_model)
    compact_registry_config = _get_registry_model_config(compact_model)
    if args.require_magic_service:
        not_magic: list[str] = []
        if not _is_magic_service_model(runtime_registry_config):
            not_magic.append(
                f"runtime model source is {runtime_registry_config.provider_source or 'unknown'}"
            )
        if not _is_magic_service_model(compact_registry_config):
            not_magic.append(
                f"compact model source is {compact_registry_config.provider_source or 'unknown'}"
            )
        if not_magic:
            raise RuntimeError("; ".join(not_magic))

    agent_id = args.agent_id or _make_run_id(args.mode)
    agent = None
    result: Optional[VerificationResult] = None

    subagent_id: Optional[str] = None
    subagent_status: Optional[str] = None
    subagent_error: Optional[str] = None
    first_check_result: Optional[bool] = None
    second_check_result: Optional[bool] = None
    background_completed = False
    summary: Optional[str] = None
    apply_ok = False
    error: Optional[str] = None

    try:
        agent = await _make_agent(
            agent_name=args.agent_name,
            agent_id=agent_id,
            runtime_model=runtime_model,
        )
        await _populate_history(agent, args.target_tokens)
        tokens_before = await agent.chat_history.tokens_count()
        messages_before = len(agent.chat_history.messages)
        hard_threshold, early_threshold, threshold_rule = _thresholds(agent, runtime_model)

        if args.mode == "background":
            await agent._start_background_compact()
            subagent_id = _subagent_id(agent)
        elif args.mode == "precompact":
            first_check_result = await agent._try_compact_chat_history(threshold_model_id=runtime_model)
            subagent_id = _subagent_id(agent)
        else:
            await agent.run(AgentRunRequest(query="/compact"))
            apply_ok = (
                len(agent.chat_history.messages) < messages_before
                and not agent._has_pending_compact_request()
                and not agent.agent_context.model_context.has_active_compact_text_model()
            )

        background_started = agent._bg_compact_state._task is not None
        if args.mode in {"background", "precompact"} and background_started:
            background_completed, summary, error = await _await_background(agent, args.timeout)

        subagent_state = await _load_subagent_state(args.agent_name, subagent_id)
        if subagent_state is not None:
            subagent_status = str(getattr(subagent_state.status, "value", subagent_state.status))
            subagent_error = subagent_state.last_error
            if not summary and isinstance(subagent_state.last_result, str) and subagent_state.last_result.strip():
                summary = subagent_state.last_result

        if summary:
            if args.mode == "precompact":
                second_check_result = await agent._try_compact_chat_history(threshold_model_id=runtime_model)
                apply_ok = bool(second_check_result)
            else:
                apply_ok = await agent._apply_background_compact(summary)

        tokens_after = await agent.chat_history.tokens_count()
        messages_after = len(agent.chat_history.messages)
        summary_ok = bool(summary and summary.strip()) if args.mode != "foreground" else apply_ok
        validation_errors: list[str] = []
        if args.mode in {"background", "precompact"}:
            if not background_started:
                validation_errors.append("background compact did not start")
            if not background_completed:
                validation_errors.append(error or "background compact did not complete")
            if not summary_ok:
                validation_errors.append(subagent_error or "compact summary is empty")
            if not apply_ok:
                validation_errors.append("background compact summary was not applied")
        elif not apply_ok:
            validation_errors.append("foreground compact did not apply through agent.run('/compact')")
        if tokens_after >= tokens_before:
            validation_errors.append(f"tokens did not decrease: before={tokens_before}, after={tokens_after}")
        if hard_threshold > 0 and tokens_after >= hard_threshold:
            validation_errors.append(f"tokens_after is still above hard threshold: after={tokens_after}, hard={hard_threshold}")
        current_text_model = agent.agent_context.model_context.current_text_model_id
        if current_text_model != runtime_model:
            validation_errors.append(f"main model was not restored: current={current_text_model}, expected={runtime_model}")
        runtime_model_after = current_text_model
        if runtime_model_after != runtime_model:
            validation_errors.append(
                f"runtime model was not restored: current={runtime_model_after}, expected={runtime_model}"
            )
        if args.expected_threshold_rule and threshold_rule != args.expected_threshold_rule:
            validation_errors.append(
                f"threshold rule mismatch: actual={threshold_rule}, expected={args.expected_threshold_rule}"
            )
        error = "; ".join(validation_errors) or None

        result = VerificationResult(
            ok=not validation_errors,
            mode=args.mode,
            agent_name=args.agent_name,
            agent_id=agent_id,
            artifact_dir=agent.chat_history.chat_history_dir,
            runtime_model=runtime_model,
            compact_model=compact_model,
            runtime_api_model=runtime_config.name,
            runtime_base_url=runtime_config.api_base_url,
            runtime_provider_source=runtime_registry_config.provider_source,
            compact_api_model=compact_config.name,
            compact_base_url=compact_config.api_base_url,
            compact_provider_source=compact_registry_config.provider_source,
            tokens_before=tokens_before,
            tokens_after=tokens_after,
            hard_threshold=hard_threshold,
            early_threshold=early_threshold,
            threshold_rule=threshold_rule,
            background_started=background_started,
            background_completed=background_completed,
            summary_ok=summary_ok,
            summary_chars=len(summary or ""),
            apply_ok=apply_ok,
            first_check_result=first_check_result,
            second_check_result=second_check_result,
            history_message_count_before=messages_before,
            history_message_count_after=messages_after,
            main_model_after=current_text_model,
            runtime_model_after=runtime_model_after,
            subagent_id=subagent_id,
            subagent_status=subagent_status,
            subagent_error=subagent_error,
            artifacts_cleaned=False,
            elapsed_seconds=time.time() - started_at,
            error=error,
        )
        return result
    finally:
        if agent is not None:
            await _cancel_agent_background_task(agent)
            agent.close()
        if args.cleanup_artifacts:
            cleaned = await _cleanup_run_artifacts(
                agent=agent,
                agent_name=args.agent_name,
                subagent_id=subagent_id,
                debug_files_before=debug_files_before,
            )
            if result is not None:
                result.artifacts_cleaned = cleaned


def _target_default(mode: Mode) -> int:
    if mode == "precompact":
        return 190_000
    if mode == "foreground":
        return 120_000
    return 120_000


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify real chat-history compaction by sending actual model requests.",
    )
    parser.add_argument("mode", choices=("background", "precompact", "foreground"))
    parser.add_argument("--agent-name", default="magic")
    parser.add_argument("--agent-id", default="")
    parser.add_argument("--runtime-model", default="deepseek-v4-flash")
    parser.add_argument("--compact-model", default="deepseek-v4-flash")
    parser.add_argument("--target-tokens", type=int)
    parser.add_argument("--timeout", type=int, default=600)
    parser.add_argument(
        "--load-dynamic-models",
        action="store_true",
        dest="load_dynamic_models",
        default=True,
        help="Load the magic-service /v1/models list before verification. This is enabled by default.",
    )
    parser.add_argument(
        "--skip-dynamic-models",
        action="store_false",
        dest="load_dynamic_models",
        help="Use only config.yaml providers. This weakens real magic-service verification.",
    )
    parser.add_argument(
        "--allow-static-models",
        action="store_false",
        dest="require_magic_service",
        default=True,
        help="Allow runtime/compact models from config.yaml instead of requiring magic-service provider source.",
    )
    parser.add_argument("--keep-artifacts", action="store_false", dest="cleanup_artifacts", default=True)
    parser.add_argument(
        "--expected-threshold-rule",
        default="threshold_230k",
        help="Expected compaction threshold rule. Pass an empty string to skip this check.",
    )
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args(argv)
    if args.target_tokens is None:
        args.target_tokens = _target_default(args.mode)
    return args


def _emit_result(result: VerificationResult, as_json_output: bool) -> None:
    payload = asdict(result)
    if as_json_output:
        print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
        return

    for key, value in payload.items():
        print(f"{key}: {value}")


async def _async_main(argv: list[str]) -> int:
    args = _parse_args(argv)
    try:
        result = await _run_verification(args)
    except Exception as exc:
        result = VerificationResult(
            ok=False,
            mode=args.mode,
            agent_name=args.agent_name,
            agent_id=args.agent_id or "",
            artifact_dir="",
            runtime_model=args.runtime_model,
            compact_model=args.compact_model,
            runtime_api_model="",
            runtime_base_url="",
            runtime_provider_source="",
            compact_api_model="",
            compact_base_url="",
            compact_provider_source="",
            tokens_before=0,
            tokens_after=0,
            hard_threshold=0,
            early_threshold=0,
            threshold_rule=None,
            background_started=False,
            background_completed=False,
            summary_ok=False,
            summary_chars=0,
            apply_ok=False,
            first_check_result=None,
            second_check_result=None,
            history_message_count_before=0,
            history_message_count_after=0,
            main_model_after=None,
            runtime_model_after=None,
            subagent_id=None,
            subagent_status=None,
            subagent_error=None,
            artifacts_cleaned=False,
            elapsed_seconds=0.0,
            error=str(exc),
        )
    _emit_result(result, args.as_json)
    return 0 if result.ok else 1


def main() -> int:
    return asyncio.run(_async_main(sys.argv[1:]))


if __name__ == "__main__":
    raise SystemExit(main())
