"""
cron 完成通知管理

当 cron 任务执行完毕且 notify_main_agent=True 时，将通知记录追加到固定的
.pending-notifications.jsonl 文件中（每行一条 JSON）。
主 agent 触发点（tick 检测 / 任务完成时）读取并消费这些通知，发送给主 agent。

并发安全：模块级 asyncio.Lock 序列化所有追加和消费操作，防止多个 cron task
同时完成时出现写入竞争或追加与清空之间的数据丢失。
"""
from __future__ import annotations

import asyncio
import json
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path
from typing import List, Optional

from agentlang.logger import get_logger
from app.core.context.execution_source import EXECUTION_SOURCE_DYNAMIC_CONFIG_KEY, SuperMagicExecutionSource
from app.path_manager import PathManager
from app.service.cron.models import CronJob, CronRunResult
from app.service.cron.utils import CRON_LOG_INTERVAL_S, format_job_label
from app.utils.async_file_utils import (
    async_exists,
    async_mkdir,
    async_read_text,
    async_write_text,
)

logger = get_logger(__name__)

# 模块级锁：所有追加和消费操作共用，保证 asyncio 并发安全
_lock: asyncio.Lock = asyncio.Lock()

# 通知 summary 最大字符数（全文在 result 文件里，这里只存摘要）
_SUMMARY_MAX_CHARS = 200


class _NotificationWaitReason(StrEnum):
    NOT_READY = "主 Agent 尚未准备好"
    BUSY = "主 Agent 正在执行其它任务"


_last_wait_reason: _NotificationWaitReason | None = None
_last_wait_log_at: float = 0.0


def _log_notification_wait(reason: _NotificationWaitReason | None) -> None:
    """只记录等待原因变化和低频提醒，不改变通知的消费与重试时机。"""
    global _last_wait_reason, _last_wait_log_at
    if reason is None:
        _last_wait_reason = None
        _last_wait_log_at = 0.0
        return
    now = time.monotonic()
    if reason != _last_wait_reason or now - _last_wait_log_at >= CRON_LOG_INTERVAL_S:
        # 同一事件循环内判断和记录之间不 await，避免两个通知触发点重复打印。
        _last_wait_reason = reason
        _last_wait_log_at = now
        logger.info(f"定时任务通知：已有结果等待处理，{reason.value}，稍后重试。")


@dataclass
class CronNotificationRecord:
    """单条 cron 完成通知记录，序列化为 JSONL 文件中的一行。"""
    job_id: str
    job_name: str
    status: str            # "ok" | "error"
    finished_at: str       # ISO 8601，UTC
    job_body: str          # 原始任务正文，即用户设定的任务内容
    summary: str           # result 或 error 的前 200 字符
    result_file: str       # 完整结果文件的绝对路径

    def to_json_line(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)

    @classmethod
    def from_dict(cls, data: dict) -> Optional["CronNotificationRecord"]:
        """从字典安全构建，缺少必填字段时返回 None。"""
        try:
            return cls(
                job_id=str(data["job_id"]),
                job_name=str(data["job_name"]),
                status=str(data["status"]),
                finished_at=str(data["finished_at"]),
                job_body=str(data.get("job_body", "")),
                summary=str(data.get("summary", "")),
                result_file=str(data.get("result_file", "")),
            )
        except (KeyError, TypeError):
            return None


def _build_record(job: CronJob, result: CronRunResult, result_file: Path) -> CronNotificationRecord:
    """从 CronJob 和 CronRunResult 构建通知记录。"""
    finished_at = datetime.now(timezone.utc).isoformat()
    raw_text = result.result or result.error or ""
    summary = raw_text[:_SUMMARY_MAX_CHARS]
    if len(raw_text) > _SUMMARY_MAX_CHARS:
        summary += "..."
    return CronNotificationRecord(
        job_id=job.id,
        job_name=job.name or job.id,
        status=result.status,
        finished_at=finished_at,
        job_body=job.body or "",
        summary=summary,
        result_file=str(result_file),
    )


async def append_notification(job: CronJob, result: CronRunResult, result_file: Path) -> None:
    """将一条 cron 完成通知追加到 pending-notifications.jsonl。"""
    record = _build_record(job, result, result_file)
    line = record.to_json_line()

    async with _lock:
        path = PathManager.get_cron_pending_notifications_file()
        await async_mkdir(path.parent, parents=True, exist_ok=True)
        existing = ""
        if await async_exists(path):
            existing = await async_read_text(path)
        if existing and not existing.endswith("\n"):
            existing += "\n"
        await async_write_text(path, existing + line + "\n")
        logger.debug(f"定时任务{format_job_label(job)}：执行结果已加入待处理通知。")


async def consume_notifications() -> List[CronNotificationRecord]:
    """
    读取所有待发送通知并清空文件。
    逐行解析，跳过格式损坏的行。
    返回解析成功的记录列表，若无待发通知则返回空列表。
    """
    async with _lock:
        path = PathManager.get_cron_pending_notifications_file()
        if not await async_exists(path):
            return []

        content = await async_read_text(path)
        await async_write_text(path, "")

    records: List[CronNotificationRecord] = []
    for line_number, line in enumerate(content.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
            record = CronNotificationRecord.from_dict(data)
            if record is not None:
                records.append(record)
            else:
                logger.warning(f"定时任务通知：第 {line_number} 行缺少必需字段，已跳过，请检查通知记录。")
        except json.JSONDecodeError:
            logger.warning(f"定时任务通知：第 {line_number} 行不是有效 JSON，已跳过，请检查通知记录。")

    return records


async def has_pending_notifications() -> bool:
    """快速检查是否存在待发送通知（不加锁，仅用于决策是否触发消费）。"""
    path = PathManager.get_cron_pending_notifications_file()
    if not await async_exists(path):
        return False
    content = await async_read_text(path)
    return bool(content.strip())


async def try_notify_main_agent() -> None:
    """
    检测主 agent 运行状态，若未运行且存在待发通知，则消费通知并触发主 agent。
    在两个触发点调用：
    1. executor.execute_agent_turn 完成后（任务刚结束时立即尝试）
    2. CronService._tick() 每次调度后（定期兜底检测）
    """
    if not await has_pending_notifications():
        _log_notification_wait(None)
        return

    from app.service.agent_dispatcher import AgentDispatcher
    from app.service.agent_runtime import AgentRuntime
    dispatcher = AgentDispatcher.get_instance()
    agent_context = dispatcher.agent_context
    if agent_context is None:
        _log_notification_wait(_NotificationWaitReason.NOT_READY)
        return

    if AgentRuntime.get_instance().is_context_running(agent_context.context_id):
        _log_notification_wait(_NotificationWaitReason.BUSY)
        return

    records = await consume_notifications()
    if not records:
        return

    from app.i18n import i18n

    def t(code: str, **kwargs: object) -> str:
        return i18n.translate(code, category="common.messages", **kwargs)

    task_blocks: list[str] = []
    for i, r in enumerate(records, start=1):
        status_label = t("cron.notify.status_ok") if r.status == "ok" else t("cron.notify.status_error")
        block_lines = [
            t("cron.notify.task_header", index=i),
            t("cron.notify.field_name", value=r.job_name),
        ]
        if r.job_body:
            block_lines.append(t("cron.notify.field_job_body", value=r.job_body))
        block_lines.append(t("cron.notify.field_status", value=status_label))
        block_lines.append(t("cron.notify.field_finished_at", value=r.finished_at))
        if r.result_file:
            block_lines.append(t("cron.notify.field_result_file", value=r.result_file))
        # 仅当执行结果与任务正文有实质差异时才附上摘要（研究、汇报类任务）
        if r.summary and r.summary.strip() != r.job_body.strip():
            block_lines.append(t("cron.notify.field_summary", value=r.summary))
        task_blocks.append("\n".join(block_lines))

    prompt = t("cron.notify.intro") + "\n\n" + "\n\n---\n\n".join(task_blocks)

    import uuid
    from app.core.entity.message.client_message import ChatClientMessage
    chat_msg = ChatClientMessage(
        message_id=f"cron_{uuid.uuid4().hex[:16]}",
        prompt=prompt,
        dynamic_config={
            EXECUTION_SOURCE_DYNAMIC_CONFIG_KEY: SuperMagicExecutionSource.CRON.value,
        },
    )
    # submit_message 内部会先 stop_run 再 reset_run_state，完成后 run_cleanup_registry 已清空。
    # 必须在 submit_message 返回后再调用 register_run_cleanup（即 create_proactive_streams），
    # 否则 stop_run 会把刚注册的 cleanup 触发一遍，把 WechatStream 提前移除。
    await dispatcher.submit_message(chat_msg)
    _log_notification_wait(None)

    # 为所有已连接且有缓存上下文的 IM 渠道注册主动推送 stream/sink，
    # 使 agent 的回复能同步推送到 IM，而不仅仅写入聊天历史文件。
    from app.channel.base.registry import build_default_channel_registry
    registry = build_default_channel_registry()
    registered_channels: list[str] = []
    for channel in registry.get_all():
        try:
            if not channel.is_connected:
                continue
            cleanup_key = f"cron_proactive_{channel.key}"
            ok = await channel.create_proactive_streams(dispatcher.agent_context, cleanup_key)
            if ok:
                registered_channels.append(channel.key)
        except Exception as e:
            logger.warning(f"定时任务通知：无法准备 {channel.key} 渠道输出，已跳过该渠道。原因：{type(e).__name__}: {e}")

    if registered_channels:
        logger.info(
            f"定时任务通知：已将 {len(records)} 项结果交给主 Agent 处理，"
            f"输出渠道为 {'、'.join(registered_channels)}；尚未确认送达。"
        )
    else:
        logger.info(
            f"定时任务通知：已将 {len(records)} 项结果交给主 Agent 处理，"
            "未连接可用推送渠道，回复仅进入会话记录。"
        )
