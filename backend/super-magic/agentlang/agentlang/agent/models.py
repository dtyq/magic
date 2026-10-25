"""Agent 运行相关的数据模型。"""

from dataclasses import dataclass, field, replace
from typing import Sequence


@dataclass(frozen=True, slots=True)
class AgentRunRequest:
    """封装一次 Agent 运行所需的输入，避免运行方法参数持续膨胀。"""

    query: str
    image_refs: Sequence[str] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        """规范化不可变请求中的图片引用，避免调用方持有可变列表。"""
        if not isinstance(self.query, str):
            raise TypeError("AgentRunRequest.query must be a string")
        object.__setattr__(self, "image_refs", tuple(self.image_refs))

    def with_query(self, query: str) -> "AgentRunRequest":
        """返回仅替换查询文本的新运行请求。"""
        return replace(self, query=query)
