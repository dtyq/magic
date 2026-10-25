"""当前用户资源接口。"""

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..parameter.get_user_info_parameter import GetUserInfoParameter
from ..result.get_user_info_result import GetUserInfoResult


class UserApi(MagicServiceAbstractApi):
    async def get_user_info_async(self, parameter: GetUserInfoParameter) -> GetUserInfoResult:
        data = await self.request_by_parameter_async(parameter, "GET", "/api/v1/open-api/agent/users/me")
        return GetUserInfoResult(data)
