from unittest.mock import AsyncMock

import pytest

from app.infrastructure.sdk.magic_service.api.micro_app_api import MicroAppApi
from app.infrastructure.sdk.magic_service.parameter.resolve_micro_app_parameter import ResolveMicroAppParameter


@pytest.mark.asyncio
async def test_resolve_project_uses_app_id_endpoint_and_auth_headers():
    api = object.__new__(MicroAppApi)
    api.request_by_parameter_async = AsyncMock(return_value={"project_id": "42"})
    parameter = ResolveMicroAppParameter(
        authorization="Bearer user-token",
        organization_code="org-1",
    )

    result = await api.resolve_project_async("app-7", parameter)

    assert result == {"project_id": "42"}
    api.request_by_parameter_async.assert_awaited_once_with(
        parameter,
        "GET",
        "/api/v1/super-agent/micro-app-projects/app-7",
    )
    assert parameter.to_headers()["Authorization"] == "Bearer user-token"
    assert parameter.to_headers()["organization-code"] == "org-1"


@pytest.mark.asyncio
async def test_resolve_project_escapes_app_id_path_segment():
    api = object.__new__(MicroAppApi)
    api.request_by_parameter_async = AsyncMock(return_value={})

    await api.resolve_project_async("app/7?x=1", ResolveMicroAppParameter("Bearer token", "org-1"))

    assert api.request_by_parameter_async.await_args.args[2].endswith("app%2F7%3Fx%3D1")
