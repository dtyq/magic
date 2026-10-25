"""当前用户查询的强类型响应。"""

from app.core.entity.user_context import UserContext
from app.infrastructure.sdk.base import AbstractResult


class GetUserInfoResult(AbstractResult):
    def _parse_data(self) -> None:
        self.user_context = UserContext.model_validate(self.to_dict())
