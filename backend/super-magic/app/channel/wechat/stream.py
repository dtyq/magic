"""
WechatStream — 侦听 agent 事件，在 after_main_agent_run 时发送最终回复。

支持：
- 纯文本回复
- `MEDIA:` 协议驱动的图片 / 视频 / 文件发送
"""
import json
from typing import Optional

import aiohttp

from agentlang.logger import get_logger
from app.channel.wechat import api
from app.channel.wechat.reply_media_parser import parse_reply_media
from app.channel.wechat.send_media import send_media_file
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
        self._finished = False
        self._last_content = ""

    async def write(self, data: str, data_type: str = "json") -> int:
        if self._finished:
            return 0
        try:
            msg = json.loads(data)
            payload = msg.get("payload", {})
            event = payload.get("event", "")

            # 捕获最终内容（非流式模型兜底）
            if payload.get("type") == "agent_reply" and payload.get("content_type") == "content":
                content = payload.get("content", "")
                if content:
                    self._last_content = content

            elif event == "after_main_agent_run":
                self._finished = True
                try:
                    if self._last_content:
                        parsed_reply = parse_reply_media(self._last_content)
                        visible_text = api.markdown_to_plain_text(parsed_reply.text)

                        if parsed_reply.media_urls:
                            await self._send_media_reply(
                                caption_text=visible_text,
                                media_urls=parsed_reply.media_urls,
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
                        logger.info(f"[WechatStream] 已发送回复, stream_id={self._stream_id}")
                except Exception as e:
                    logger.error(f"[WechatStream] 发送回复失败: {e}")
                finally:
                    await self._stop_typing()

        except Exception as e:
            logger.error(f"[WechatStream] write 失败: {e}")
        return len(data)

    def read(self, size: Optional[int] = None) -> str:
        raise NotImplementedError("WechatStream is write-only")

    async def _stop_typing(self) -> None:
        if self._typing_controller is None:
            return
        controller = self._typing_controller
        self._typing_controller = None
        await controller.stop()

    async def _send_media_reply(self, *, caption_text: str, media_urls: list[str]) -> None:
        pending_caption = caption_text
        for index, media_url in enumerate(media_urls, 1):
            logger.info(
                f"[WechatStream] 发送媒体 {index}/{len(media_urls)}, "
                f"stream_id={self._stream_id} media={media_url}"
            )
            await send_media_file(
                self._http_session,
                base_url=self._base_url,
                token=self._bot_token,
                to_user_id=self._to_user_id,
                context_token=self._context_token,
                media_target=media_url,
                cdn_base_url=self._cdn_base_url,
                caption_text=pending_caption,
            )
            pending_caption = ""
