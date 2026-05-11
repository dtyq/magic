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
from app.channel.base.reply_content import extract_reply_content
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
        self._finished = False
        self._last_content = ""

    async def write(self, data: str, data_type: str = "json") -> int:
        if self._finished:
            return 0
        try:
            msg = json.loads(data)
            payload = msg.get("payload", {})
            event = payload.get("event", "")

            # 捕获最终 assistant 正文，兼容 v1 agent_reply 与 v2 super_magic_message。
            content = extract_reply_content(payload)
            if content:
                self._last_content = content

            if event == "after_main_agent_run":
                self._finished = True
                try:
                    if not self._last_content:
                        logger.warning(f"[WechatStream] 未捕获到可发送回复，跳过微信发送, stream_id={self._stream_id}")
                        return len(data)

                    segments = split_reply(self._last_content)
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
