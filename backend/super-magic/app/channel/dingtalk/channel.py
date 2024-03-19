"""
DingTalkChannel — 单例，管理钉钉 Stream 模式连接和消息分发。

连接可由 ConnectDingTalkBot Tool 触发，也可在检测到已保存配置后于进程启动时自动发起。
"""
import asyncio
import uuid
from typing import Optional

from dingtalk_stream import AckMessage, ChatbotHandler, ChatbotMessage, CallbackMessage, Credential, DingTalkStreamClient
from dingtalk_stream.card_instance import AIMarkdownCardInstance

from agentlang.logger import get_logger
from app.channel.base.channel import BaseChannel
from app.core.entity.message.client_message import ChatClientMessage, Metadata
from app.channel.base.keepalive import ChannelKeepalive
from app.channel.dingtalk.stream import DingTalkStream
from app.channel.dingtalk.streaming_driver import DingTalkStreamingDriver
from app.channel.config import IMChannelsConfig

logger = get_logger(__name__)


class DingTalkChannel(BaseChannel):
    key = "dingtalk"
    label = "钉钉"

    _instance: Optional["DingTalkChannel"] = None

    def __init__(self) -> None:
        self._client: Optional[DingTalkStreamClient] = None
        self._connect_task: Optional[asyncio.Task] = None
        self._keepalive = ChannelKeepalive("DingTalk", is_active=lambda: self.is_connected)

    @classmethod
    def get_instance(cls) -> "DingTalkChannel":
        if cls._instance is None:
            cls._instance = DingTalkChannel()
        return cls._instance

    @property
    def is_connected(self) -> bool:
        websocket = self._client.websocket if self._client is not None else None
        return websocket is not None and not websocket.closed

    def summarize_config(self, config: IMChannelsConfig) -> str | None:
        credential = config.dingtalk
        if credential is None:
            return None

        return f"Client ID：{credential.client_id}"

    async def start_from_config(self, config: IMChannelsConfig) -> bool:
        credential = config.dingtalk
        if credential is None or not credential.enabled:
            return False

        await self.connect(credential.client_id, credential.client_secret)
        return True

    async def connect(self, client_id: str, client_secret: str) -> None:
        """建立钉钉 Stream 连接（幂等：已连接则先断开再重连）。"""
        if self.is_connected:
            logger.info("[DingTalkChannel] 已有连接，先断开再重连")
            await self.disconnect()

        credential = Credential(client_id, client_secret)
        self._client = DingTalkStreamClient(credential)
        self._client.register_callback_handler(
            ChatbotMessage.TOPIC,
            _DingTalkBotHandler(self),
        )
        self._connect_task = asyncio.create_task(self._run_client())
        self._keepalive.start()
        logger.info(f"[DingTalkChannel] 连接中，client_id={client_id}")

    async def _run_client(self) -> None:
        """持续运行 client，网络断线后 5 秒自动重连。"""
        while True:
            try:
                assert self._client is not None
                await self._client.start()
            except asyncio.CancelledError:
                return
            except Exception as e:
                logger.warning(f"[DingTalkChannel] 连接断开，5 秒后重连: {e}")
                await asyncio.sleep(5)

    async def verify_card_permission(self) -> str | None:
        """测试 AI 卡片相关权限是否已全部开通。

        依次探测两个必需权限：
          1. Card.Instance.Write  — 创建/投放卡片（POST /v1.0/card/instances）
          2. Card.Streaming.Write — 流式更新内容（PUT  /v1.0/card/streaming）

        判断逻辑：
          - HTTP 403 → 权限缺失，返回错误描述（含申请链接）
          - 其他状态（400/404 参数错误等）→ 权限本身正常，继续下一项
          - 请求异常 → 不阻塞连接，视为正常
        """
        import uuid as _uuid
        import aiohttp

        assert self._client is not None
        access_token = self._client.get_access_token()
        if not access_token:
            return "无法获取 access token，请确认 Client ID 和 Client Secret 是否正确"

        headers = {"x-acs-dingtalk-access-token": access_token, "Content-Type": "application/json"}

        def _extract_error(data: dict, fallback_scope: str) -> str:
            scopes = data.get("accessdenieddetail", {}).get("requiredScopes", [fallback_scope])
            msg = data.get("message", "")
            parts = msg.split("https://")
            apply_link = ("https://" + parts[1]) if len(parts) > 1 else "https://open-dev.dingtalk.com"
            return f"钉钉应用缺少权限：{', '.join(scopes)}\n请在开放平台开通后重新连接：{apply_link}"

        async with aiohttp.ClientSession() as session:
            # 1. 检测 Card.Instance.Write
            try:
                body = {
                    "cardTemplateId": "perm_check",
                    "outTrackId": f"perm_check_{_uuid.uuid4().hex[:8]}",
                    "cardData": {"cardParamMap": {}},
                    "callbackType": "STREAM",
                    "imGroupOpenSpaceModel": {"supportForward": True},
                    "imRobotOpenSpaceModel": {"supportForward": True},
                }
                async with session.post(
                    "https://api.dingtalk.com/v1.0/card/instances", headers=headers, json=body
                ) as resp:
                    if resp.status == 403:
                        try:
                            return _extract_error(await resp.json(), "Card.Instance.Write")
                        except Exception:
                            return "钉钉应用缺少 Card.Instance.Write 权限，请在开放平台开通后重新连接"
            except Exception as e:
                logger.warning(f"[DingTalkChannel] Card.Instance.Write 检测异常: {e}")

            # 2. 检测 Card.Streaming.Write
            try:
                body = {
                    "outTrackId": f"perm_check_{_uuid.uuid4().hex[:8]}",
                    "guid": _uuid.uuid4().hex,
                    "key": "msgContent",
                    "content": "",
                    "isFull": True,
                    "isFinalize": False,
                    "isError": False,
                }
                async with session.put(
                    "https://api.dingtalk.com/v1.0/card/streaming", headers=headers, json=body
                ) as resp:
                    if resp.status == 403:
                        try:
                            return _extract_error(await resp.json(), "Card.Streaming.Write")
                        except Exception:
                            return "钉钉应用缺少 Card.Streaming.Write 权限，请在开放平台开通后重新连接"
            except Exception as e:
                logger.warning(f"[DingTalkChannel] Card.Streaming.Write 检测异常: {e}")

        return None

    async def disconnect(self) -> None:
        self._keepalive.stop()
        if self._connect_task and not self._connect_task.done():
            self._connect_task.cancel()
        self._connect_task = None
        self._client = None
        logger.info("[DingTalkChannel] 已断开")

    async def _on_message(self, incoming_message: ChatbotMessage) -> None:
        """处理文本消息：创建 AI 卡片 → 注册 stream + sink → dispatch → 清理。"""
        from app.service.agent_dispatcher import AgentDispatcher

        dispatcher = AgentDispatcher.get_instance()
        if not dispatcher.agent_context:
            logger.error("[DingTalkChannel] agent_context 未初始化，忽略消息")
            return

        text = incoming_message.text
        content = (text.content or "").strip() if text else ""
        if not content:
            return

        # senderStaffId 是企业内部用户 ID，senderId 是钉钉平台 ID（与 TS 逻辑一致）
        user_id = incoming_message.sender_staff_id or incoming_message.sender_id or "dingtalk_user"
        ctx = dispatcher.agent_context

        # 先创建 AI 卡片：必须在 dispatch 之前获得 card_instance_id，流式 driver 才能推送
        assert self._client is not None

        # SDK deliver 投放单聊卡片时用 sender_staff_id 构建 openSpaceId，若为空则 API 返回错误。
        # 补充 senderId 作为 fallback（与 TS 连接器逻辑一致）。
        if not incoming_message.sender_staff_id:
            incoming_message.sender_staff_id = incoming_message.sender_id

        card = AIMarkdownCardInstance(self._client, incoming_message)
        # 使用 TS 连接器验证过的模板，仅声明 msgContent 字段避免渲染空占位（msgSlider 等）
        card.card_template_id = "02fcf2f4-5e02-4a85-b672-46d1f715543e.schema"
        card.order = ["msgContent"]
        try:
            card_instance_id = await card.async_start(card.card_template_id, {})
            card.card_instance_id = card_instance_id
            if not card_instance_id:
                logger.error("[DingTalkChannel] AI 卡片创建失败：async_start 返回空（可能是 access token 或 API 错误，查看 SDK 日志）")
                card_instance_id = None
            else:
                logger.info(f"[DingTalkChannel] AI 卡片创建成功: card_instance_id={card_instance_id}")
        except Exception as e:
            logger.error(f"[DingTalkChannel] AI 卡片创建失败: {e}")
            card_instance_id = None

        # DingTalkStreamingDriver：token 级，负责流式推送 finished=False（含推理阶段 blockquote）
        dingtalk_driver = DingTalkStreamingDriver(card, card_instance_id) if card_instance_id else None
        # DingTalkStream：事件级，负责捕获内容 + 发送 finished=True；需引用 driver 以读取推理数据
        dingtalk_stream = DingTalkStream(card, card_instance_id, dingtalk_driver) if card_instance_id else None

        if dingtalk_stream:
            ctx.add_stream(dingtalk_stream)
        if dingtalk_driver:
            ctx.add_streaming_sink(dingtalk_driver)

        message_id = f"dingtalk_{uuid.uuid4().hex[:16]}"

        try:
            chat_msg = ChatClientMessage(
                message_id=message_id,
                prompt=content,
                metadata=Metadata(agent_user_id=user_id),
            )
            logger.info(f"[DingTalkChannel] 分发消息: user_id={user_id}, len={len(content)}")
            await dispatcher.dispatch_agent(chat_msg)
        except Exception as e:
            logger.error(f"[DingTalkChannel] dispatch_agent 失败: {e}")
        finally:
            if dingtalk_stream:
                ctx.remove_stream(dingtalk_stream)
            if dingtalk_driver:
                ctx.remove_streaming_sink(dingtalk_driver)


class _DingTalkBotHandler(ChatbotHandler):
    """将钉钉 ChatbotHandler 桥接到 DingTalkChannel._on_message。"""

    def __init__(self, manager: DingTalkChannel) -> None:
        super(ChatbotHandler, self).__init__()
        self._manager = manager

    async def process(self, callback: CallbackMessage) -> tuple:
        incoming_message = ChatbotMessage.from_dict(callback.data)
        await self._manager._on_message(incoming_message)
        return AckMessage.STATUS_OK, "OK"
