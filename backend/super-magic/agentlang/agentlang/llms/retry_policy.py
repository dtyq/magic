"""LLM 重试策略辅助函数。"""

from agentlang.exceptions import iter_exception_chain

_NON_RETRYABLE_MODEL_CONFIG_ERROR_FRAGMENTS = (
    "找不到模型 ID",
    "无法为模型",
    "Text model id is not configured",
    "model id cannot be empty",
    "不是 LLM 类型",
    "不是 llm 类型",
)


def is_non_retryable_model_config_error(exception: Exception) -> bool:
    """判断是否为本地模型配置错误，这类错误等待或重试都不会自愈。"""
    for current in iter_exception_chain(exception):
        if not isinstance(current, ValueError):
            continue
        message = str(current)
        if any(fragment in message for fragment in _NON_RETRYABLE_MODEL_CONFIG_ERROR_FRAGMENTS):
            return True
    return False
