from urllib.parse import quote

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..parameter.resolve_micro_app_parameter import ResolveMicroAppParameter


class MicroAppApi(MagicServiceAbstractApi):
    async def resolve_project_async(self, app_id: str, parameter: ResolveMicroAppParameter) -> dict:
        data = await self.request_by_parameter_async(
            parameter, "GET", f"/api/v1/super-agent/micro-app-projects/{quote(str(app_id), safe='')}"
        )
        return data if isinstance(data, dict) else {}
