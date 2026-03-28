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
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.service.cron.models import CronJob, CronRunResult
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


@dataclass
class CronNotificationRecord:
    """单条 cron 完成通知记录，序列化为 JSONL 文件中的一行。"""
    job_id: str
    job_name: str
    status: str            # "ok" | "error"
    finished_at: str       # ISO 8601，UTC
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
        logger.info(f"cron notification appended: job={job.id} status={result.status}")


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
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
            record = CronNotificationRecord.from_dict(data)
            if record is not None:
                records.append(record)
            else:
                logger.warning(f"cron notification: missing required fields, skipping: {line[:80]!r}")
        except json.JSONDecodeError:
            logger.warning(f"cron notification: malformed JSON line, skipping: {line[:80]!r}")

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
        return

    from app.service.agent_dispatcher import AgentDispatcher
    dispatcher = AgentDispatcher.get_instance()
    if dispatcher is None:
        logger.debug("cron notify: AgentDispatcher not initialized, skip")
        return

    if any(agent.is_agent_running() for agent in dispatcher.agents.values()):
        logger.debug("cron notify: main agent is running, skip")
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
            t("cron.notify.field_status", value=status_label),
            t("cron.notify.field_finished_at", value=r.finished_at),
        ]
        if r.result_file:
            block_lines.append(t("cron.notify.field_result_file", value=r.result_file))
        if r.summary:
            block_lines.append(t("cron.notify.field_summary", value=r.summary))
        task_blocks.append("\n".join(block_lines))

    prompt = t("cron.notify.intro") + "\n\n" + "\n\n---\n\n".join(task_blocks)

    import uuid
    from app.core.entity.message.client_message import ChatClientMessage
    chat_msg = ChatClientMessage(
        message_id=f"cron_{uuid.uuid4().hex[:16]}",
        prompt=prompt,
    )
    # submit_message 内部会先 stop_run 再 reset_run_state，完成后 run_cleanup_registry 已清空。
    # 必须在 submit_message 返回后再调用 register_run_cleanup（即 create_proactive_streams），
    # 否则 stop_run 会把刚注册的 cleanup 触发一遍，把 WechatStream 提前移除。
    await dispatcher.submit_message(chat_msg)
    logger.info(f"cron notify: submitted {len(records)} notification(s) to main agent")

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
            logger.warning(f"cron notify: channel {channel.key} error, skipping: {e}")

    if registered_channels:
        logger.info(f"cron notify: proactive streams registered for channels: {registered_channels}")
    else:
        logger.info("cron notify: no connected channels with cached context, reply goes to history only")
