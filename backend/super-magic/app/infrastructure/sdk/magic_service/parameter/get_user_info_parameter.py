"""当前已认证用户查询参数。"""

from typing import Literal

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter, MagicServiceAuthConfig


class GetUserInfoParameter(MagicServiceAbstractParameter):
    def __init__(
        self,
        auth_config: MagicServiceAuthConfig,
        include_sensitive_fields: tuple[Literal["phone"], ...] = (),
    ) -> None:
        super().__init__(auth_config=auth_config)
        self.include_sensitive_fields = include_sensitive_fields

    def to_body(self) -> dict[str, object]:
        return {}

    def to_query_params(self) -> dict[str, object]:
        if not self.include_sensitive_fields:
            return {}
        return {"include_sensitive_fields[]": list(self.include_sensitive_fields)}
