"""已连接微信的龙虾主 Agent 有序投递；微信结果与 Web 镜像共享同一正文和附件。"""
from __future__ import annotations

import asyncio
import mimetypes
from dataclasses import dataclass
from pathlib import Path

from agentlang.config.config import config
from agentlang.context.tool_context import ToolContext
from bs4 import BeautifulSoup

from app.channel.wechat import api
from app.channel.wechat.channel import WechatChannel
from app.channel.wechat.models import (
    TextFileMessageItem, TextFormat, TextMessageItem,
    WechatDeliveryResult, WechatMessageItem,
)
from app.channel.wechat.reply_media_parser import MediaItem, MediaKind
from app.channel.wechat.stream import WechatStream
from app.core.context.agent_context import AgentContext
from app.core.entity.attachment import Attachment
from app.core.entity.event.event_context import EventContext, OutboundMessageRecord
from app.service.agent_event.file_storage_listener_service import FileStorageListenerService
from app.tools.share.workspace import get_workspace_root, normalize_workspace_path
from app.utils.async_file_utils import async_is_file, async_is_symlink, async_read_text, async_stat


@dataclass(frozen=True)
class PreparedMessage:
    text: str = ""
    media: MediaItem | None = None
    attachment: Attachment | None = None


def check_send_permission(context: AgentContext) -> None:
    # 例：网页对话和 cron 完成通知都可由龙虾主 Agent 发送；cron 子 Agent 只返回结果。
    # 权限依据项目模式、主 Agent 身份和连接状态，不依据本轮消息来源。
    if not context.is_interactive_main_agent_context() or not context.is_magiclaw():
        raise ValueError("Only the main agent in Claw mode can send WeChat messages.")
    if not WechatChannel.get_instance().is_connected:
        raise ValueError("WeChat is disconnected. Connect it before sending messages.")


def resolve_current_stream(context: AgentContext) -> WechatStream:
    check_send_permission(context)
    return WechatChannel.get_instance().get_tool_delivery_stream(context)


def format_text(text: str, text_format: TextFormat) -> str:
    if text_format == TextFormat.MARKDOWN:
        text = api.markdown_to_plain_text(text)
    elif text_format == TextFormat.HTML:
        soup = BeautifulSoup(text, "html.parser")
        for node in soup.select("script, style, template"):
            node.decompose()
        text = soup.get_text(separator="\n").strip()
    if not text.strip():
        raise ValueError("The message has no visible text after formatting.")
    api.validate_text_length(text)
    return text


async def prepare_message(tool_context: ToolContext, item: WechatMessageItem) -> PreparedMessage:
    if isinstance(item, TextMessageItem):
        return PreparedMessage(text=format_text(item.text, item.format))
    root = get_workspace_root(tool_context)
    path = normalize_workspace_path(root, item.path)
    current = root
    for part in path.relative_to(root).parts:
        current /= part
        if await async_is_symlink(current):
            raise ValueError("Workspace delivery paths cannot contain symbolic links.")
    if not await async_is_file(path):
        raise ValueError("The requested workspace file does not exist or is not a regular file.")
    if isinstance(item, TextFileMessageItem):
        size = (await async_stat(path)).st_size
        read_limit = int(config.get("wechat.text_file_max_bytes", 1048576))
        if size > read_limit:
            raise ValueError(f"The text file exceeds the local read budget of {read_limit} bytes. Read selected sections and send text items.")
        return PreparedMessage(text=format_text(await async_read_text(path, encoding="utf-8", errors="strict"), item.format))
    attachment = await FileStorageListenerService.create_workspace_attachment(str(path))
    if item.filename and (Path(item.filename).name != item.filename or "\\" in item.filename):
        raise ValueError("filename must be a display name without directory separators.")
    if item.filename:
        attachment.display_filename = item.filename
    mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    kind: MediaKind = "file"
    if mime.startswith("image/"):
        kind = "image"
    elif mime.startswith("video/"):
        kind = "video"
    elif mime.startswith("audio/"):
        kind = "audio"
    return PreparedMessage(
        media=MediaItem(kind=kind, src=str(path), filename=item.filename),
        attachment=attachment,
    )


async def deliver_messages(
    tool_context: ToolContext, items: list[WechatMessageItem],
) -> list[WechatDeliveryResult]:
    context = tool_context.get_extension_typed("agent_context", AgentContext)
    events = tool_context.get_extension_typed("event_context", EventContext)
    if context is None or events is None or not tool_context.tool_call_id:
        raise ValueError("A tool event and the current Agent context are required for coordinated delivery.")
    try:
        stream = resolve_current_stream(context)
    except ValueError as error:
        return [
            WechatDeliveryResult(
                index=index, kind=item.kind, delivery_id=f"wechat:{tool_context.tool_call_id}:{index}",
                status="failed", error_code="channel_unavailable", message=str(error),
            )
            for index, item in enumerate(items)
        ]
    prepared: list[PreparedMessage | None] = []
    results: list[WechatDeliveryResult] = []
    too_long = False
    for index, item in enumerate(items):
        if context.is_interruption_requested():
            raise asyncio.CancelledError()
        result = WechatDeliveryResult(
            index=index, kind=item.kind, delivery_id=f"wechat:{tool_context.tool_call_id}:{index}",
            status="not_sent",
        )
        try:
            prepared.append(await prepare_message(tool_context, item))
        except api.WechatTextTooLong as error:
            too_long = True
            prepared.append(None)
            result.status, result.error_code, result.message = "failed", "text_too_long", str(error)
        except Exception as error:
            prepared.append(None)
            result.status, result.error_code, result.message = "failed", "preparation_failed", str(error)
        results.append(result)
    if too_long:
        for result in results:
            if result.status == "not_sent":
                result.message = "This batch was not sent because another item exceeds the text budget. Divide it and try again."
        return results

    for index, message in enumerate(prepared):
        result = results[index]
        if message is None:
            continue
        existing = stream.get_tool_delivery(result.delivery_id)
        if existing is not None:
            results[index] = existing
            continue
        if context.is_interruption_requested():
            raise asyncio.CancelledError()
        try:
            check_send_permission(context)
            if not stream.can_send_tool_message:
                raise ValueError("The current WeChat delivery stream is no longer available.")
        except ValueError as error:
            result.status, result.error_code, result.message = "failed", "channel_unavailable", str(error)
            continue
        # 同一批 item 串行投递；网络异常不能假定对端未收到，更不能自动重发。
        try:
            if message.media is not None:
                await stream.send_media(message.media)
            else:
                await stream.send_text(message.text)
            result.status = "sent"
            context.horizon.record_im_delivery()
        except asyncio.CancelledError:
            result.status, result.error_code = "unknown", "interrupted"
            stream.record_tool_delivery(result)
            events.outbound_messages.append(_outbound_record(result, message))
            await _flush_mirrors(tool_context)
            raise
        except api.WechatAPIError as error:
            result.status = "failed" if error.ret is not None or error.errcode is not None else "unknown"
            result.error_code, result.message = "wechat_api_error", str(error)
        except Exception as error:
            result.status, result.error_code, result.message = "unknown", "delivery_unknown", str(error)
        stream.record_tool_delivery(result)
        events.outbound_messages.append(_outbound_record(result, message))
        await _flush_mirrors(tool_context)
    return results


async def _flush_mirrors(tool_context: ToolContext) -> None:
    from app.service.agent_event.stream_listener_service import StreamListenerService

    # 用户中断不能抹掉已经发送的事实；等待本条镜像完成后继续传播取消。
    task = asyncio.create_task(StreamListenerService.flush_channel_outbound_messages(tool_context))
    try:
        await asyncio.shield(task)
    except asyncio.CancelledError:
        await task
        raise


def _outbound_record(result: WechatDeliveryResult, message: PreparedMessage) -> OutboundMessageRecord:
    if result.status == "not_sent":
        raise ValueError("Unattempted messages cannot create delivery records.")
    return OutboundMessageRecord(
        delivery_id=result.delivery_id, channel="wechat", status=result.status,
        content=message.text, attachments=[message.attachment] if message.attachment else [],
        error_code=result.error_code,
    )
