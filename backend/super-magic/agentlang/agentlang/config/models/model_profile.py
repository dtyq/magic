"""模型能力资料。"""
from dataclasses import dataclass, field
from typing import Any, Dict


@dataclass(frozen=True)
class ModelProfile:
    """模型能力、上下文窗口和价格信息。"""

    model: str
    type: str = "llm"
    max_context_tokens: int = 128000
    max_output_tokens: int = 8192
    # 主流 Chat Completions 模型默认支持工具调用；只有明确不支持时才配置为 false。
    supports_tool_use: bool = True
    # 是否支持 OpenAI-compatible 图片输入。
    supports_multimodal: bool = False
    pricing: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
