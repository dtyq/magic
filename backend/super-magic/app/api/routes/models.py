"""
Models route.

Proxies the magic service models list and appends local text models from the
in-memory model registry for the static debug panel.
"""
from typing import Any, Dict, List, Set

import httpx
from fastapi import APIRouter

from app.api.http_dto.response import (
    BaseResponse,
    create_success_response,
    create_error_response,
)
from app.utils.init_client_message_util import InitClientMessageUtil, InitializationError
from agentlang.config.models.model_config import ModelConfig
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
        data={"models": _append_local_text_models(payload.get("data", []))},
    )


def _append_local_text_models(remote_models: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """追加本地注册中心中远端没有返回的文本模型，不暴露调用凭据。"""
    if not isinstance(remote_models, list):
        remote_models = []

    result = list(remote_models)
    existing_ids = _collect_model_ids(result)

    try:
        from agentlang.config.models.model_config_manager import model_config_manager

        local_models = model_config_manager.list_all()
    except Exception as e:
        logger.warning(f"读取本地模型注册中心失败，将只返回 magic service 模型: {e}")
        return result

    appended = 0
    for model_config in local_models:
        if model_config.type != "llm" or model_config.model_id in existing_ids:
            continue
        result.append(_to_debug_panel_model(model_config))
        existing_ids.add(model_config.model_id)
        appended += 1

    if appended:
        logger.info(f"已追加 {appended} 个本地模型到调试面板模型列表")
    return result


def _collect_model_ids(models: List[Dict[str, Any]]) -> Set[str]:
    model_ids: Set[str] = set()
    for item in models:
        if isinstance(item, dict) and item.get("id"):
            model_ids.add(str(item["id"]))
    return model_ids


def _to_debug_panel_model(model_config: ModelConfig) -> Dict[str, Any]:
    resolved_model_id = model_config.resolved_model_id or model_config.model_id
    return {
        "id": model_config.model_id,
        "object": "model",
        "name": model_config.name,
        "info": {
            "options": {
                "chat": True,
                "function_call": model_config.supports_tool_use,
                "max_tokens": model_config.max_context_tokens,
                "max_output_tokens": model_config.max_output_tokens,
                "default_temperature": model_config.temperature,
            },
            "attributes": {
                "label": model_config.metadata.get("label") or model_config.name,
                "resolved_model_id": resolved_model_id,
                "provider_source": model_config.provider_source,
            },
        },
    }
