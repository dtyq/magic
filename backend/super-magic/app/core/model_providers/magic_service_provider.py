"""
Magic Service 模型服务商

从 magic service 的 /v1/models 接口加载可用模型列表。
需要在 init_client_message.json 写入后（客户端 init 完成后）才可调用。
优先级 priority=3，最高，同 model_id 时覆盖其他服务商的配置。

所有 magic-service 模型共用 MAGIC_API_BASE_URL + MAGIC_API_KEY 作为调用凭据。
"""
import os
from typing import Any, Dict, List, Optional

import httpx

from agentlang.config.models.model_config import ModelConfig
from agentlang.config.models.provider_interface import ModelProvider, RefreshPolicy
from agentlang.logger import get_logger
from agentlang.utils.metadata import MetadataUtil

logger = get_logger(__name__)

PROVIDER_TYPE = "magic-service"
PROVIDER_PRIORITY = 3

# 每 50 次使用或每小时，触发一次后台刷新
_REFRESH_USE_COUNT = 50
_REFRESH_INTERVAL_SECONDS = 3600


class MagicServiceProvider(ModelProvider):
    """从 magic service /v1/models 加载模型配置"""

    @property
    def provider_type(self) -> str:
        return PROVIDER_TYPE

    @property
    def priority(self) -> int:
        return PROVIDER_PRIORITY

    @property
    def refresh_policy(self) -> RefreshPolicy:
        return RefreshPolicy(
            use_count=_REFRESH_USE_COUNT,
            interval_seconds=_REFRESH_INTERVAL_SECONDS,
        )

    async def load(self) -> List[ModelConfig]:
        """调用 magic service /v1/models 获取模型列表并解析为 ModelConfig

        Returns:
            List[ModelConfig]: 解析成功的模型列表，失败时返回空列表
        """
        host, authorization = self._get_credentials()
        if not host:
            logger.warning("MagicServiceProvider: magic_service_host not available, skipping")
            return []

        url = f"{host}/v1/models"
        params = {"with_info": "1", "with_dynamic_models": "1"}
        headers: Dict[str, str] = {}
        if authorization:
            headers["user-authorization"] = authorization
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, params=params, headers=headers)
                resp.raise_for_status()
                payload = resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"MagicServiceProvider: HTTP error {e.response.status_code} from {url}")
            return []
        except httpx.RequestError as e:
            logger.error(f"MagicServiceProvider: request error to {url}: {e}")
            return []
        except Exception as e:
            logger.error(f"MagicServiceProvider: unexpected error: {e}")
            return []

        api_key = os.environ.get("MAGIC_API_KEY", "")
        api_base_url = os.environ.get("MAGIC_API_BASE_URL", "")

        result: List[ModelConfig] = []
        for model_data in payload.get("data", []):
            mc = self._parse_model(model_data, api_key=api_key, api_base_url=api_base_url)
            if mc:
                result.append(mc)

        logger.info(f"MagicServiceProvider loaded {len(result)} models from {url}")
        return result

    # ------------------------------------------------------------------
    # 内部方法
    # ------------------------------------------------------------------

    def _get_credentials(self):
        """获取 magic service 主机地址和用户授权 token

        优先从 InitClientMessageUtil 读取（init 消息写入后），
        退回到环境变量。
        """
        host = ""
        authorization: Optional[str] = None

        try:
            from app.utils.init_client_message_util import InitClientMessageUtil, InitializationError
            host = InitClientMessageUtil.get_magic_service_host()
            authorization = InitClientMessageUtil.get_user_authorization()
        except Exception:
            # init_client_message.json 不存在或读取失败时退回环境变量
            host = os.environ.get("MAGIC_API_BASE_URL", "").rstrip("/")
            logger.debug("MagicServiceProvider: falling back to MAGIC_API_BASE_URL env var")

        return host, authorization

    def _parse_model(
        self,
        model_data: Dict[str, Any],
        api_key: str,
        api_base_url: str,
    ) -> Optional[ModelConfig]:
        """从 magic service 返回的单条模型数据解析为 ModelConfig

        Args:
            model_data: magic service 返回的单条模型对象
            api_key: 调用该模型时使用的 API Key
            api_base_url: 调用该模型时使用的 Base URL

        Returns:
            ModelConfig 或 None（数据不合法时）
        """
        model_id = model_data.get("id")
        if not model_id:
            return None

        info = model_data.get("info") or {}
        options = info.get("options") or {}
        attributes = info.get("attributes") or {}

        # 基础字段
        name = model_data.get("name") or model_id
        config_dict: Dict[str, Any] = {
            "name": name,
            "provider": "openai",
            "api_key": api_key,
            "api_base_url": api_base_url,
            "type": "llm",
        }

        # 从 options 提取能力字段
        if options.get("max_tokens"):
            try:
                config_dict["max_context_tokens"] = int(options["max_tokens"])
            except (ValueError, TypeError):
                pass

        if options.get("max_output_tokens"):
            try:
                config_dict["max_output_tokens"] = int(options["max_output_tokens"])
            except (ValueError, TypeError):
                pass

        if options.get("fixed_temperature") is not None:
            try:
                config_dict["temperature"] = float(options["fixed_temperature"])
            except (ValueError, TypeError):
                pass
        elif options.get("default_temperature") is not None:
            try:
                config_dict["temperature"] = float(options["default_temperature"])
            except (ValueError, TypeError):
                pass

        if "function_call" in options:
            config_dict["supports_tool_use"] = bool(options["function_call"])

        # 从 attributes 提取元数据
        metadata: Dict[str, Any] = {}
        if attributes.get("label"):
            metadata["label"] = str(attributes["label"])
        if attributes.get("icon"):
            metadata["icon"] = str(attributes["icon"])
        if metadata:
            config_dict["metadata"] = metadata

        if attributes.get("resolved_model_id"):
            config_dict["resolved_model_id"] = str(attributes["resolved_model_id"])

        try:
            return ModelConfig.from_dict(model_id, config_dict, provider_source=PROVIDER_TYPE)
        except Exception as e:
            logger.error(f"MagicServiceProvider: failed to parse model '{model_id}': {e}")
            return None
