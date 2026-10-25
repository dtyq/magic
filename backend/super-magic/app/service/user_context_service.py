"""用户查询、主体校验与模型可读内容；不依赖工具执行或 Horizon XML。"""

import asyncio
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Literal

from agentlang.logger import get_logger
from app.core.context.run_interruption import await_with_interruption
from app.core.entity.message.client_message import InitClientMessage, Metadata
from app.core.entity.user_context import UserAccountDataStatus, UserContext, UserContextSnapshot
from app.infrastructure.sdk.base import SdkBase
from app.infrastructure.sdk.magic_service.api.user_api import UserApi
from app.infrastructure.sdk.magic_service.kernel.magic_service_parameter import MagicServiceAuthConfig
from app.infrastructure.sdk.magic_service.parameter.get_user_info_parameter import GetUserInfoParameter
from app.path_manager import PathManager
from app.utils.async_file_utils import async_try_read_json

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext

logger = get_logger(__name__)


class UserContextQueryError(Exception):
    """对外只暴露稳定类别，原始响应可能含资料、内部地址或凭据。"""


def mask_phone(phone: str) -> str:
    if not phone:
        return phone
    value = phone.strip()
    return "****" if len(value) <= 7 else value[:3] + "****" + value[-4:]


def format_context_time(value: datetime) -> str:
    offset = value.strftime("%z")
    zone = "UTC" if offset == "+0000" else f"UTC{offset[:3]}:{offset[3:]}"
    return f"{value:%Y-%m-%d %H:%M:%S} {zone}"


class UserContextService:
    @staticmethod
    def _auth_from_metadata(metadata: Metadata | None) -> MagicServiceAuthConfig | None:
        if metadata is None or not metadata.user_id or not metadata.organization_code or not metadata.authorization:
            return None
        return MagicServiceAuthConfig(
            user_id=metadata.user_id,
            organization_code=metadata.organization_code,
            user_authorization=metadata.authorization,
        )

    @classmethod
    def apply_init_config(cls, context: "AgentContext", message: InitClientMessage) -> None:
        current_chat = context.get_chat_client_message()
        metadata = current_chat.metadata if current_chat is not None else message.metadata
        context.set_user_context_request_config(message.magic_service_host or "", cls._auth_from_metadata(metadata))

    @classmethod
    def apply_chat_config(cls, context: "AgentContext", metadata: Metadata | None) -> None:
        # CHAT 缺少可信身份时失效，不退回 INIT 中的账户主人。
        context.set_user_context_request_config(context.get_user_context_host(), cls._auth_from_metadata(metadata))

    @classmethod
    async def prepare_request_config(cls, context: "AgentContext") -> None:
        if context.is_user_context_config_loaded() and context.get_user_context_host():
            return
        data = await async_try_read_json(PathManager.get_init_client_message_file())
        if not data:
            return
        try:
            message = InitClientMessage.model_validate(data)
        except Exception as error:
            logger.warning(f"User context configuration rejected: {type(error).__name__}")
            return
        if context.is_user_context_config_loaded():
            # CHAT／父会话已明确了主体，恢复文件只补服务地址，不能恢复旧账户的授权。
            context.set_user_context_request_config(message.magic_service_host or "", context.get_user_context_auth())
        else:
            cls.apply_init_config(context, message)

    @classmethod
    async def fetch(
        cls,
        context: "AgentContext",
        include_sensitive_fields: tuple[Literal["phone"], ...] = (),
    ) -> UserContext:
        await cls.prepare_request_config(context)
        auth = context.get_user_context_auth()
        host = context.get_user_context_host()
        if auth is None or not host:
            raise UserContextQueryError("Current user authentication is unavailable.")

        interruption = context.get_interruption_event()
        if interruption.is_set():
            raise asyncio.CancelledError
        try:
            result = await await_with_interruption(
                cls._request(host, auth, include_sensitive_fields), interruption,
            )
            if interruption.is_set():
                raise asyncio.CancelledError
            if context.get_user_context_auth() != auth or context.get_user_context_host() != host:
                raise UserContextQueryError("The session identity changed during the query. Query again.")
            if result.user.id != auth.user_id or result.organization.code != auth.organization_code:
                raise UserContextQueryError("The returned profile does not match the authenticated user.")
            return result
        except UserContextQueryError:
            raise
        except Exception as error:
            logger.warning(f"Current user query failed: {type(error).__name__}")
            raise UserContextQueryError("The current user query failed. No fresh profile is available.") from None

    @staticmethod
    async def _request(
        host: str,
        auth: MagicServiceAuthConfig,
        fields: tuple[Literal["phone"], ...],
    ) -> UserContext:
        # 使用独立 SDK 容器，不向按 host 缓存的全局路由注册本次会话。
        sdk = SdkBase({"sdk_name": "magic_service", "base_url": host, "enable_logging": False})
        try:
            async with asyncio.timeout(sdk.get_config().get_timeout()):
                response = await UserApi(sdk).get_user_info_async(GetUserInfoParameter(auth, fields))
                return response.user_context
        finally:
            await sdk.get_async_client().aclose()
            sdk.close()

    @staticmethod
    def for_model(result: UserContext) -> UserContext:
        return result.model_copy(update={"user": result.user.model_copy(update={"phone": mask_phone(result.user.phone)})})

    @classmethod
    async def remember_result(cls, context: "AgentContext", result: UserContext) -> None:
        await context.horizon.prepare_user_context_subject(result.user.id, result.organization.code)
        await context.horizon.set_user_context(UserContextSnapshot(
            user_id=result.user.id,
            organization_code=result.organization.code,
            context=cls.for_model(result),
            status=UserAccountDataStatus.AVAILABLE,
            attempted_at=datetime.now(timezone.utc),
        ))

    @classmethod
    async def refresh(cls, context: "AgentContext", *, first_only: bool = False) -> None:
        # TODO：当前为会话首次＋主 Loop 正常结束；未来按资料、套餐、积分分类调整频率，
        # 处理主体隔离、请求合并和失败退避，不把远程查询放进每次 Horizon build。
        await cls.prepare_request_config(context)
        auth = context.get_user_context_auth()
        await context.horizon.prepare_user_context_subject(
            auth.user_id if auth else "", auth.organization_code if auth else "",
        )
        if auth is None:
            await context.horizon.set_user_context(UserContextSnapshot(
                user_id="", organization_code="", status=UserAccountDataStatus.UNAVAILABLE,
                attempted_at=datetime.now(timezone.utc),
            ))
            return
        if first_only and await context.horizon.has_attempted_user_context_fetch():
            return
        await context.horizon.mark_user_context_fetch_attempted()
        try:
            result = await cls.fetch(context)
        except UserContextQueryError:
            if context.get_user_context_auth() != auth:
                return
            previous = await context.horizon.get_user_context_snapshot()
            await context.horizon.set_user_context(UserContextSnapshot(
                user_id=auth.user_id,
                organization_code=auth.organization_code,
                context=previous.context if previous is not None else None,
                status=UserAccountDataStatus.UNAVAILABLE,
                attempted_at=datetime.now(timezone.utc),
            ))
            return
        await cls.remember_result(context, result)

    @staticmethod
    def format_content(result: UserContext) -> str:
        user = result.user
        lines = [
            "Authenticated service user profile retrieved.",
            "This identifies the account served by this session; it does not establish the speaker of an external message.",
            f"Profile captured at: {format_context_time(result.captured_at)}.",
            f"User ID: {user.id}",
            f"Magic ID: {user.magic_id}",
            f"Third-party user ID: {user.third_platform_id or 'not available'}.",
            f"Organization: {result.organization.name or 'Name not provided'} (code: {result.organization.code})",
        ]
        for label, value in (
            ("Nickname", user.nickname), ("Real name", user.real_name), ("Position", user.position),
            ("Work number", user.work_number), ("Email", user.email), ("Phone", user.phone),
            ("Avatar URL", user.avatar_url),
        ):
            if value:
                lines.append(f"{label}: {value}")
        if user.departments:
            lines.append("Departments: " + "; ".join(
                f"{department.name or department.id}" + (f" ({department.path})" if department.path else "")
                for department in user.departments
            ))
        subscription = result.subscription
        if subscription.status == UserAccountDataStatus.AVAILABLE:
            lines.append(f"Current organization subscription: {subscription.name or subscription.id}.")
            if subscription.plan_type:
                lines.append(f"Plan type: {subscription.plan_type}.")
            for label, value in (("Starts at", subscription.starts_at), ("Valid until", subscription.ends_at)):
                if value is not None:
                    lines.append(f"{label}: {format_context_time(value)}.")
        elif subscription.status == UserAccountDataStatus.NONE:
            lines.append("No active organization subscription was found; this does not establish a free plan.")
        elif subscription.status == UserAccountDataStatus.UNSUPPORTED:
            lines.append("Subscription information is not provided by this deployment; this does not establish a free plan.")
        else:
            lines.append("Subscription information could not be retrieved.")
        if subscription.captured_at is not None:
            lines.append(f"Subscription captured at: {format_context_time(subscription.captured_at)}.")
        points = result.points
        if points.status == UserAccountDataStatus.AVAILABLE:
            lines.append(f"Points available to the current user: {points.available:,}.")
            lines.append(f"Points scope: {points.scope}; this is not a separate personal wallet.")
            lines.append(
                "This visible balance includes charges posted by the query time. Later charges, other tasks, "
                "credits, and quota changes may affect it. A balance change does not establish this run's cost."
            )
        elif points.status == UserAccountDataStatus.UNSUPPORTED:
            lines.append("Points information is not provided by this deployment; no balance can be inferred.")
        else:
            lines.append("Points could not be retrieved. No balance is available from this query.")
        if points.captured_at is not None:
            lines.append(f"Points captured at: {format_context_time(points.captured_at)}.")
        if UserAccountDataStatus.UNAVAILABLE in (subscription.status, points.status):
            lines.insert(1, "The profile is available, but account information is incomplete.")
        return "\n".join(lines)
