"""追加问题上报 API。"""

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..parameter.follow_up_suggestion_parameter import FollowUpSuggestionParameter
from ..result.follow_up_suggestion_result import FollowUpSuggestionResult

_PATH = "/api/v1/open-api/sandbox/follow-up-suggestions"


class FollowUpSuggestionApi(MagicServiceAbstractApi):
    """向 magic-service 上报追加问题状态。"""

    async def report_async(self, parameter: FollowUpSuggestionParameter) -> FollowUpSuggestionResult:
        """上报一次状态并返回当前存储结果。"""
        data = await self.request_by_parameter_async(parameter, "POST", _PATH)
        return FollowUpSuggestionResult(data)
