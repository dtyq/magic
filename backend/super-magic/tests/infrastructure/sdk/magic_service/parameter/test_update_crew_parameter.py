import asyncio

from app.infrastructure.sdk.magic_service import MagicService
from app.infrastructure.sdk.magic_service.api.agent_api import AgentApi
from app.infrastructure.sdk.magic_service.api.file_api import FileApi
from app.infrastructure.sdk.magic_service.parameter import UpdateCrewParameter
from app.infrastructure.sdk.magic_service.result import UpdateCrewResult


def test_sdk_imports_without_obsolete_avatar_upload_api():
    assert MagicService is not None
    assert not hasattr(FileApi, "get_upload_temporary_credential_async")
    assert callable(FileApi.update_file_source_async)
    assert callable(FileApi.scan_wav_async)


def test_update_crew_parameter_serializes_image_icon_with_value():
    parameter = UpdateCrewParameter(
        code="SMA-test",
        name_i18n={"default": "测试员工"},
        icon={"type": "image", "value": "https://example.com/agent-logo.png"},
        icon_type=2,
    )

    assert parameter.to_body() == {
        "name_i18n": {"default": "测试员工"},
        "icon": {"type": "image", "value": "https://example.com/agent-logo.png"},
        "icon_type": 2,
    }


def test_update_crew_parameter_omits_unset_optional_fields():
    parameter = UpdateCrewParameter(code="SMA-test")

    assert parameter.to_body() == {}


def test_update_crew_sdk_preserves_backend_route_and_response():
    class RecordingAgentApi(AgentApi):
        def __init__(self):
            self.call = None

        async def request_by_parameter_async(self, parameter, method, endpoint_path):
            self.call = (parameter, method, endpoint_path)
            return {
                "id": "crew-id",
                "code": "SMA-test",
                "name_i18n": {"default": "测试员工"},
                "description_i18n": {"default": "Description"},
                "role_i18n": {"default": "Role"},
            }

    api = RecordingAgentApi()
    parameter = UpdateCrewParameter(code="SMA-test", name_i18n={"default": "测试员工"})

    result = asyncio.run(api.update_crew_async(parameter))

    assert api.call == (parameter, "PUT", "/api/v1/open-api/sandbox/agents/SMA-test")
    assert isinstance(result, UpdateCrewResult)
    assert result.id == "crew-id"
    assert result.code == "SMA-test"
    assert result.name_i18n == parameter.name_i18n
    assert result.description_i18n == {"default": "Description"}
    assert result.role_i18n == {"default": "Role"}
