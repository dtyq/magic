"""
WechatStream — 侦听 agent 事件，在 after_main_agent_run 时发送最终回复。

支持：
- 纯文本回复
- 标签驱动的媒体发送：<img>、<video>、<audio>、<file>、<voice>
- `<split delay="N" />` 标记拆成多段延时发送
"""
import asyncio
import json
from typing import Optional

import aiohttp

from agentlang.logger import get_logger
from app.channel.base.message_splitter import split_reply
from app.channel.base.no_send import filter_no_send
from app.channel.base.reply_content import extract_reply_content
from app.channel.wechat.models import WechatDeliveryResult
from app.channel.wechat import api
from app.channel.wechat.reply_media_parser import MediaItem, parse_reply_media
from app.channel.wechat.send_media import send_media_item
from app.channel.wechat.typing import WechatTypingController
from app.core.stream import Stream

logger = get_logger(__name__)


class WechatStream(Stream):
    def __init__(
        self,
        http_session: aiohttp.ClientSession,
        bot_token: str,
        to_user_id: str,
        context_token: str,
        base_url: str,
        cdn_base_url: str,
        stream_id: str,
        typing_controller: WechatTypingController | None = None,
        is_proactive: bool = False,
        send_final_reply: bool = True,
    ) -> None:
        super().__init__()
        self._http_session = http_session
        self._bot_token = bot_token
        self._to_user_id = to_user_id
        self._context_token = context_token
        self._base_url = base_url
        self._cdn_base_url = cdn_base_url
        self._stream_id = stream_id
        self._typing_controller = typing_controller
        self._is_proactive = is_proactive
        self._send_final_reply = send_final_reply
        self._finished = False
        self._last_content = ""
        self._tool_delivery_results: dict[str, WechatDeliveryResult] = {}

    async def write(self, data: str, data_type: str = "json") -> int:
        if self._finished:
            return 0
        try:
            msg = json.loads(data)
            payload = msg.get("payload", {})
            event = payload.get("event", "")
            # 网页运行按需创建的 stream 只发送显式工具消息，不自动转发网页最终回复。
            # 入站与 cron 通知的 stream 仍负责最终回复；两者均可复用工具投递记录。
            if not self._send_final_reply:
                if event == "after_main_agent_run":
                    self._finished = True
                return len(data)
            if event == "before_tool_call":
                # 工具调用表示本轮还会继续处理，之前的正文不能作为最终答复发送。
                self._last_content = ""

            # 捕获最终 assistant 正文，兼容 v1 agent_reply 与 v2 super_magic_message。
            if event == "after_agent_reply" and payload.get("content_type") == "content":
                self._last_content = extract_reply_content(payload)

            if event == "after_main_agent_run":
                self._finished = True
                try:
                    if not self._last_content:
                        logger.warning(f"[WechatStream] 未捕获到可发送回复，跳过微信发送, stream_id={self._stream_id}")
                        return len(data)

                    # 先派生微信副本，再解析分段与媒体；标签内的附件也不能触发发送。
                    # 不改原始正文，网页、模型历史和任务终态仍保留完整内容。
                    filtered = filter_no_send(self._last_content)
                    if filtered.region_count or filtered.orphan_closing_count:
                        logger.info(
                            f"[WechatStream] no_send: stream_id={self._stream_id}, "
                            f"regions={filtered.region_count}, unclosed={filtered.unclosed}, "
                            f"orphan_closings={filtered.orphan_closing_count}, "
                            f"original_length={len(self._last_content)}, delivery_length={len(filtered.content)}"
                        )
                    if not filtered.content.strip():
                        return len(data)

                    segments = split_reply(filtered.content)
                    # 先校验整批正文与 caption，避免发出前半篇后才发现后半篇本地超限。
                    for seg_text, _ in segments:
                        api.validate_text_length(api.markdown_to_plain_text(parse_reply_media(seg_text).text))
                    for i, (seg_text, delay) in enumerate(segments):
                        if i > 0 and delay > 0:
                            await asyncio.sleep(delay)
                        parsed_reply = parse_reply_media(seg_text)
                        visible_text = api.markdown_to_plain_text(parsed_reply.text)
                        if parsed_reply.media_items:
                            await self._send_media_reply(
                                caption_text=visible_text,
                                media_items=parsed_reply.media_items,
                            )
                        elif visible_text:
                            await api.send_message(
                                self._http_session,
                                base_url=self._base_url,
                                token=self._bot_token,
                                to_user_id=self._to_user_id,
                                context_token=self._context_token,
                                text=visible_text,
                            )
                    logger.info(f"[WechatStream] 已发送回复({len(segments)}段), stream_id={self._stream_id}")
                except api.WechatTextTooLong as e:
                    self._push_delivery_failure_notification(
                        api.WechatAPIError(str(e), label="text_too_long", errmsg=str(e))
                    )
                except api.WechatAPIError as e:
                    log = logger.warning if self._is_proactive else logger.error
                    visibility_note = (
                        "official_channels_visible=True"
                        if self._is_proactive
                        else "delivery_status=failed"
                    )
                    log(
                        "[WechatStream] 微信发送失败: "
                        f"stream_id={self._stream_id}, proactive={self._is_proactive}, "
                        f"label={e.label}, ret={e.ret}, errcode={e.errcode}, errmsg={e.errmsg!r}, "
                        f"{visibility_note}"
                    )
                    self._push_delivery_failure_notification(e)
                except Exception as e:
                    logger.error(f"[WechatStream] 发送回复失败: {e}")
                finally:
                    await self._stop_typing()

        except Exception as e:
            logger.error(f"[WechatStream] write 失败: {e}")
        return len(data)

    def read(self, size: Optional[int] = None) -> str:
        raise NotImplementedError("WechatStream is write-only")

    @property
    def can_send_tool_message(self) -> bool:
        return not self._finished and not self._http_session.closed and bool(self._context_token)

    def get_tool_delivery(self, delivery_id: str) -> WechatDeliveryResult | None:
        return self._tool_delivery_results.get(delivery_id)

    def record_tool_delivery(self, result: WechatDeliveryResult) -> None:
        self._tool_delivery_results[result.delivery_id] = result

    async def send_text(self, text: str) -> None:
        if not self.can_send_tool_message:
            raise ValueError("The current WeChat run no longer accepts tool messages.")
        await api.send_message(
            self._http_session, base_url=self._base_url, token=self._bot_token,
            to_user_id=self._to_user_id, context_token=self._context_token, text=text,
        )

    async def send_media(self, item: MediaItem) -> None:
        if not self.can_send_tool_message:
            raise ValueError("The current WeChat run no longer accepts tool messages.")
        await send_media_item(
            self._http_session, base_url=self._base_url, token=self._bot_token,
            to_user_id=self._to_user_id, context_token=self._context_token,
            cdn_base_url=self._cdn_base_url, media_item=item,
        )

    def _push_delivery_failure_notification(self, error: api.WechatAPIError) -> None:
        """把微信出站投递失败写入 Agent 运行时通知，供后续任意场景的模型判断渠道可见性。"""
        try:
            from app.service.agent_dispatcher import AgentDispatcher

            ctx = AgentDispatcher.get_instance().agent_context
            if ctx is None:
                return

            visibility = (
                "For proactive messages, the final reply may still be visible in official app or web channels."
                if self._is_proactive
                else "The user may not have seen the reply in WeChat."
            )
            ctx.horizon.push_notification(
                source="wechat_delivery",
                content=(
                    "A WeChat outbound delivery attempt failed. "
                    f"label={error.label or 'unknown'}, ret={error.ret}, errcode={error.errcode}, "
                    f"errmsg={error.errmsg!r}, stream_id={self._stream_id}, proactive={self._is_proactive}. "
                    f"{visibility} "
                    "Do not assume the user saw the message in WeChat. "
                    "Use this only when reasoning about message delivery; do not add it to unrelated user-facing content. "
                    "If WeChat delivery matters, the user can send a new message in WeChat to refresh the session context."
                ),
            )
        except Exception as notification_error:
            logger.warning(f"[WechatStream] 推送微信投递失败通知失败: {notification_error}")

    async def _stop_typing(self) -> None:
        if self._typing_controller is None:
            return
        controller = self._typing_controller
        self._typing_controller = None
        await controller.stop()

    async def _send_media_reply(self, *, caption_text: str, media_items: list[MediaItem]) -> None:
        """逐条发送媒体项；第一条带 caption，后续不带。"""
        pending_caption = caption_text
        for index, item in enumerate(media_items, 1):
            logger.info(
                f"[WechatStream] 发送媒体 {index}/{len(media_items)}, "
                f"stream_id={self._stream_id} kind={item.kind} src={item.src}"
            )
            await send_media_item(
                self._http_session,
                base_url=self._base_url,
                token=self._bot_token,
                to_user_id=self._to_user_id,
                context_token=self._context_token,
                media_item=item,
                cdn_base_url=self._cdn_base_url,
                caption_text=pending_caption,
            )
            pending_caption = ""
