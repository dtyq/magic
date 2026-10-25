"""执行一次追加问题生成，并通过 SDK 上报状态。"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Any, List, Optional, Sequence

from agentlang.llms.factory import LLMClientConfig, LLMFactory
from agentlang.llms.processors.processor_config import ProcessorConfig
from agentlang.logger import get_logger
from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk
from app.infrastructure.sdk.magic_service.kernel.magic_service_parameter import MagicServiceAuthConfig
from app.infrastructure.sdk.magic_service.parameter.follow_up_suggestion_parameter import (
    FollowUpSuggestionParameter,
)
from app.infrastructure.sdk.magic_service.result.follow_up_suggestion_result import (
    FollowUpSuggestionResult,
)
from app.core.config.debug_config import is_local_debug_mode_enabled
from app.service.follow_up_suggestion.prompts import (
    FOLLOW_UP_USER_INSTRUCTION,
    FOLLOW_UP_SYSTEM_PROMPT,
    RESULT_TOOL_NAME,
    SUBMIT_FOLLOW_UP_SUGGESTIONS_TOOL,
)
from app.service.follow_up_suggestion.store import FollowUpSuggestionStore

logger = get_logger(__name__)

STATUS_GENERATING = 0
STATUS_DONE = 1
STATUS_FAILED = 2
# 解析上限比提示词宽。模型仍按 3 条、200 字符生成；多出来的合法条目保留到 5 条。
MAX_SUGGESTIONS = 5
MAX_SUGGESTION_LENGTH = 200


class FollowUpGenerationError(Exception):
    """本次追加问题生成失败，调用方只上报失败，不再请求模型。"""

    def __init__(self, category: str):
        super().__init__(category)
        self.category = category


@dataclass
class FollowUpGenerationJob:
    """触发时固定的生成输入。后台任务不得再读取已切换的当前消息。"""

    task_id: str
    trigger_reason: str
    reference_context: str
    auth_config: MagicServiceAuthConfig
    llm_config: LLMClientConfig
    model_timeout_seconds: float
    report_timeout_seconds: float
    started_at: float = field(default_factory=time.monotonic)


def parse_follow_up_arguments(arguments: str) -> List[str]:
    """解析唯一结果工具的 arguments。结构非法时失败。超长或超过 5 条时跳过，不截断、不补问。"""
    try:
        payload = json.loads(arguments)
    except json.JSONDecodeError as error:
        raise FollowUpGenerationError("invalid_json") from error
    if not isinstance(payload, dict) or set(payload) != {"suggestions"}:
        raise FollowUpGenerationError("invalid_shape")
    suggestions = payload["suggestions"]
    if not isinstance(suggestions, list):
        raise FollowUpGenerationError("invalid_shape")

    cleaned: List[str] = []
    seen = set()
    for item in suggestions:
        if not isinstance(item, str):
            raise FollowUpGenerationError("invalid_shape")
        text = item.strip()
        if text == "" or text in seen or len(text) > MAX_SUGGESTION_LENGTH:
            continue
        seen.add(text)
        cleaned.append(text)
        if len(cleaned) >= MAX_SUGGESTIONS:
            break
    return cleaned


def suggestions_from_completion(completion: Any) -> List[str]:
    """只接受一个指定工具调用。"""
    choices = getattr(completion, "choices", None) or []
    if len(choices) != 1:
        raise FollowUpGenerationError("invalid_completion")
    message = getattr(choices[0], "message", None)
    tool_calls = list(getattr(message, "tool_calls", None) or [])
    if len(tool_calls) != 1:
        raise FollowUpGenerationError("missing_tool_call")
    function = getattr(tool_calls[0], "function", None)
    if getattr(function, "name", None) != RESULT_TOOL_NAME:
        raise FollowUpGenerationError("unexpected_tool")
    arguments = getattr(function, "arguments", None)
    if not isinstance(arguments, str):
        raise FollowUpGenerationError("invalid_json")
    return parse_follow_up_arguments(arguments)


class FollowUpSuggestionService:
    """同一个 job 只请求一次模型，也不为回传失败重新生成。

    上报 magic-service 的同时，把同一份状态写入 runtime 文件。
    生成中的上报如果发现远端已是终态，就把终态同步到本地文件，不再调用模型。
    线上上报生成中失败时不再调用模型。本地调试上报失败时继续生成，调试客户端仍能查到文件。
    完成和失败先写文件，再上报；上报失败不会删掉已写好的文件。
    """

    def __init__(self, store: Optional[FollowUpSuggestionStore] = None) -> None:
        self._store = store or FollowUpSuggestionStore()

    async def generate(self, job: FollowUpGenerationJob) -> None:
        """为整个后台处理记录开始与结束；取消继续向上层传播。"""
        started = time.monotonic()
        self._log(job, "started")
        try:
            await self._generate(job)
        except asyncio.CancelledError:
            self._log(job, "cancelled", elapsed=time.monotonic() - started)
            raise
        except Exception as error:
            self._log(job, "unexpected_failure", error, elapsed=time.monotonic() - started)
            raise
        finally:
            # 结束仅表示处理生命周期结束，生成与上报结果由各自状态表达。
            self._log(job, "finished", elapsed=time.monotonic() - started)

    async def _generate(self, job: FollowUpGenerationJob) -> None:
        """执行既有生成和上报流程，分别记录模型结果与交付结果。"""
        started = time.monotonic()
        local = await self._load_local(job)
        if local is not None and local.status in (STATUS_DONE, STATUS_FAILED):
            self._log(job, "skipped_local_terminal", status=local.status)
            return

        try:
            stored = await self._report(job, STATUS_GENERATING)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self._log(job, "report_generating_failed", error)
            if not is_local_debug_mode_enabled():
                return
            stored = FollowUpSuggestionResult({
                "type": 1,
                "relation_id": job.task_id,
                "status": STATUS_GENERATING,
                "suggestions": [],
            })
        if stored is None or stored.is_terminal() or stored.status != STATUS_GENERATING:
            if stored is not None and stored.is_terminal():
                await self._save_local(job, stored.status, stored.suggestions)
            self._log(job, "skipped_existing_state", status=None if stored is None else stored.status)
            return

        await self._save_local(job, STATUS_GENERATING, [])

        self._log(job, "model_started")
        try:
            suggestions = await self._request_model(job)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self._log(job, "model_failed", error, elapsed=time.monotonic() - started)
            await self._save_local(job, STATUS_FAILED, [])
            await self._report_failed(job)
            return

        await self._save_local(job, STATUS_DONE, suggestions)
        elapsed = time.monotonic() - started
        self._log(job, "done", status=STATUS_DONE, elapsed=elapsed, count=len(suggestions))
        try:
            await self._report(job, STATUS_DONE, suggestions)
            self._log(job, "reported", status=STATUS_DONE, count=len(suggestions))
        except asyncio.CancelledError:
            raise
        except Exception as error:
            # 生成已经成功；上报失败不能改记成生成失败，也不能据此推断接口未部署。
            self._log(
                job,
                "report_done_failed",
                error,
                status=STATUS_DONE,
                elapsed=elapsed,
                count=len(suggestions),
            )

    async def _load_local(self, job: FollowUpGenerationJob):
        try:
            return await self._store.load(job.task_id)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self._log(job, "load_local_failed", error)
            return None

    async def _save_local(
        self,
        job: FollowUpGenerationJob,
        status: int,
        suggestions: Optional[Sequence[str]],
    ) -> None:
        """文件写入失败不阻断上报。调试查询会继续按生成中重试。"""
        try:
            await self._store.save(
                job.task_id,
                status,
                list(suggestions) if suggestions is not None else None,
            )
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self._log(job, "save_local_failed", error)

    async def _request_model(self, job: FollowUpGenerationJob) -> List[str]:
        """只传递筛选后的参考资料，并要求唯一结果工具，不修改共享模型配置。"""
        if not job.llm_config.supports_tool_use:
            raise FollowUpGenerationError("tool_use_unsupported")
        processor_config = ProcessorConfig(
            use_stream_mode=False,
            non_stream_timeout_seconds=int(job.model_timeout_seconds),
        )
        llm_config = job.llm_config.model_copy(deep=True)
        llm_config.extra_params = {
            **llm_config.extra_params,
            "tool_choice": {"type": "function", "function": {"name": RESULT_TOOL_NAME}},
        }
        completion = await asyncio.wait_for(
            LLMFactory.call_with_tool_support(
                model_id=job.llm_config.model_id,
                messages=[
                    {"role": "system", "content": FOLLOW_UP_SYSTEM_PROMPT},
                    {"role": "user", "content": job.reference_context + "\n\n" + FOLLOW_UP_USER_INSTRUCTION},
                ],
                tools=[SUBMIT_FOLLOW_UP_SUGGESTIONS_TOOL],
                agent_context=None,
                processor_config=processor_config,
                enable_llm_response_events=False,
                llm_config=llm_config,
            ),
            timeout=job.model_timeout_seconds,
        )
        return suggestions_from_completion(completion)

    async def _report_failed(self, job: FollowUpGenerationJob) -> None:
        try:
            await self._report(job, STATUS_FAILED)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self._log(job, "report_failed_failed", error)

    async def _report(
        self,
        job: FollowUpGenerationJob,
        status: int,
        suggestions: Optional[Sequence[str]] = None,
    ) -> FollowUpSuggestionResult:
        parameter = FollowUpSuggestionParameter(
            auth_config=job.auth_config,
            task_id=job.task_id,
            status=status,
            suggestions=list(suggestions) if suggestions is not None else None,
        )
        sdk = create_magic_service_sdk(timeout=int(job.report_timeout_seconds) or 1)
        return await asyncio.wait_for(
            sdk.follow_up_suggestion.report_async(parameter),
            timeout=job.report_timeout_seconds,
        )

    def _log(
        self,
        job: FollowUpGenerationJob,
        state: str,
        error: Optional[BaseException] = None,
        status: Optional[int] = None,
        elapsed: Optional[float] = None,
        count: Optional[int] = None,
    ) -> None:
        """按阶段输出明确文案，保留稳定状态字段用于检索，不输出凭证或错误正文。"""
        messages = {
            "started": "追加问题处理开始",
            "finished": "追加问题处理结束",
            "model_started": "追加问题模型生成开始",
            "done": "追加问题生成成功",
            "model_failed": "追加问题生成失败",
            "cancelled": "追加问题处理已取消",
            "unexpected_failure": "追加问题处理异常",
            "skipped_local_terminal": "追加问题跳过生成：本地已有终态",
            "skipped_existing_state": "追加问题跳过生成：远端状态不允许生成",
            "report_generating_failed": "追加问题生成中状态上报失败",
            "report_done_failed": "追加问题生成结果上报失败",
            "report_failed_failed": "追加问题失败状态上报失败",
            "reported": "追加问题生成结果上报成功",
            "load_local_failed": "追加问题本地状态读取失败",
            "save_local_failed": "追加问题本地状态保存失败",
        }
        category = error.category if isinstance(error, FollowUpGenerationError) else (
            error.__class__.__name__ if error is not None else ""
        )
        # 还没开始生成时不写 0，避免把“没计时”看成生成瞬间完成。
        elapsed_text = "" if elapsed is None else f"{elapsed:.3f}"
        count_text = "" if count is None else count
        logger.info(
            f"{messages[state]} "
            f"task_id={job.task_id} reason={job.trigger_reason} state={state} "
            f"status={status} elapsed={elapsed_text} count={count_text} category={category}"
        )
