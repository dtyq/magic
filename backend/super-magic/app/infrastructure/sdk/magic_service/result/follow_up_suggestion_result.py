"""追加问题上报响应。"""

from typing import Any, Dict, List

from app.infrastructure.sdk.base import AbstractResult


class FollowUpSuggestionResult(AbstractResult):
    """沙箱上报后的当前存储状态。"""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        status = self.get("status")
        suggestions = self.get("suggestions", [])
        self.suggestion_type = self.get("type")
        self.relation_id = str(self.get("relation_id", ""))
        self.status = status if isinstance(status, int) else None
        self.suggestions: List[str] = []
        if isinstance(suggestions, list):
            self.suggestions = [item for item in suggestions if isinstance(item, str)]

    def is_terminal(self) -> bool:
        """完成或失败都是终态，后到的上报不能覆盖。"""
        return self.status in (1, 2)
