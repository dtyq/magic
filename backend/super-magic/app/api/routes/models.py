"""
Models route

Proxies the magic service models list using credentials from init_client_message.json.
"""
import httpx
from fastapi import APIRouter

from app.api.http_dto.response import (
    BaseResponse,
    create_success_response,
    create_error_response,
)
from app.utils.init_client_message_util import InitClientMessageUtil, InitializationError
from agentlang.logger import get_logger

router = APIRouter(prefix="/v1/models", tags=["模型列表"])

logger = get_logger(__name__)


@router.get("", response_model=BaseResponse)
async def list_models() -> BaseResponse:
    """
    从 magic service 获取可用模型列表。

    从 init_client_message.json 读取 magic_service_host 和 metadata.authorization，
    代理调用 magic service 的模型列表接口并返回结果。
    """
    try:
        magic_service_host = InitClientMessageUtil.get_magic_service_host()
        authorization = InitClientMessageUtil.get_user_authorization()
        if not authorization:
            return create_error_response("init_client_message.json 中未找到 metadata.authorization")
    except InitializationError as e:
        return create_error_response(f"读取初始化配置失败: {e}")

    url = f"{magic_service_host}/v1/models"
    params = {"with_info": "1", "with_dynamic_models": "1"}
    headers = {"user-authorization": authorization}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            payload = resp.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"magic service 返回异常状态: {e.response.status_code}")
        return create_error_response(f"magic service 请求失败: HTTP {e.response.status_code}")
    except httpx.RequestError as e:
        logger.error(f"请求 magic service 失败: {e}")
        return create_error_response(f"请求 magic service 失败: {e}")
    except Exception as e:
        logger.error(f"获取模型列表异常: {e}")
        return create_error_response(f"获取模型列表失败: {e}")

    return create_success_response(
        message="获取模型列表成功",
        data={"models": payload.get("data", [])},
    )
