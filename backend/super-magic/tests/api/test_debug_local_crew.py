import pytest

from app.api.http_dto.response import ResponseCode
from app.api.routes.debug import list_local_crews
from app.path_manager import PathManager


@pytest.mark.asyncio
async def test_list_local_crews_debug_route(monkeypatch, tmp_path):
    agents_dir = tmp_path / "agents"
    agents_dir.mkdir()
    (agents_dir / "SMA-official-document-writing.agent").write_text(
        "---\nname: official\n---\n",
        encoding="utf-8",
    )

    monkeypatch.setenv("ENABLE_LOCAL_DEBUG_MODE", "true")
    monkeypatch.setattr(
        PathManager,
        "get_agents_dir",
        classmethod(lambda cls: agents_dir),
    )

    response = await list_local_crews()

    assert response.code == ResponseCode.SUCCESS
    assert response.data["crews"] == [
        {
            "agent_code": "SMA-official-document-writing",
            "crew_dir": str(agents_dir / "crews" / "SMA-official-document-writing"),
            "agent_file": str(agents_dir / "SMA-official-document-writing.agent"),
            "exists": True,
            "compiled": True,
        }
    ]
