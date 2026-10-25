"""追加问题上报参数。身份在构造时固定，不读取之后的当前消息。"""

from typing import Any, Dict, List, Optional

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter, MagicServiceAuthConfig


class FollowUpSuggestionParameter(MagicServiceAbstractParameter):
    """POST /api/v1/open-api/sandbox/follow-up-suggestions 的请求参数。"""

    def __init__(
        self,
        auth_config: MagicServiceAuthConfig,
        task_id: str,
        status: int,
        suggestions: Optional[List[str]] = None,
    ) -> None:
        super().__init__(auth_config)
        self.task_id = task_id
        self.status = status
        self.suggestions = suggestions

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "task_id": self.task_id,
            "status": self.status,
        }
        if self.status == 1:
            body["suggestions"] = list(self.suggestions or [])
        return body

    def to_query_params(self) -> Dict[str, Any]:
        return {}
