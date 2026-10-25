"""企微接收附件使用 url + aeskey；media_id 属于发送素材协议。"""

from app.channel.base.media import MediaDownloadError, MediaSource, prepare_media_message
from app.channel.base.models import ChannelMediaType


async def prepare_wecom_message(body: dict, ws_client=None):
    if body.get("msgtype") == "text" and not body.get("quote"):
        return await prepare_media_message("wecom", (body.get("text", {}).get("content") or "").strip(), [])
    pieces = []
    sources = []
    async def download(content):
        url, key = content.get("url"), content.get("aeskey")
        if not url:
            raise MediaDownloadError("WeCom attachment URL is missing.")
        if ws_client is None:
            raise MediaDownloadError("WeCom SDK client is unavailable.")
        try:
            result = await ws_client.download_file(url, key)
        except Exception as error:
            raise MediaDownloadError("WeCom attachment download failed.") from error
        return result["buffer"], result.get("filename") or ""

    async def parse_all():
        def parse(item, from_quote=False):
            kind = item.get("msgtype", "")
            content = item.get(kind) or {}
            if kind == "text":
                if content.get("content"):
                    pieces.append(content["content"])
            elif kind == "mixed":
                for child in content.get("msg_item", []):
                    parse(child, from_quote)
                if not content.get("msg_item"):
                    pieces.append("[Unsupported or empty WeCom mixed message.]")
            elif kind in ("image", "file", "voice", "video"):
                if kind == "voice" and content.get("content"):
                    pieces.append(content["content"])
                    # 官方机器人语音回调提供识别文本，未必提供音频文件。
                    if not content.get("url"):
                        pieces.append("[Original voice attachment is unavailable; transcription is included above.]")
                        return
                media_type = {
                    "image": ChannelMediaType.IMAGE,
                    "file": ChannelMediaType.FILE,
                    "voice": ChannelMediaType.VOICE,
                    "video": ChannelMediaType.VIDEO,
                }[kind]
                name = ""

                async def fetch():
                    data, _ = await download(content)
                    return data

                sources.append(
                    MediaSource(media_type=media_type, file_name=name, mime_type="", fetch=fetch, from_quote=from_quote)
                )
            else:
                pieces.append("[Unsupported WeCom message type. Please resend as text or a supported attachment.]")

        parse(body)
        if isinstance(body.get("quote"), dict):
            pieces.append("[Quoted message]")
            parse(body["quote"], from_quote=True)
        return await prepare_media_message("wecom", "\n".join(pieces).strip(), sources)

    return await parse_all()
