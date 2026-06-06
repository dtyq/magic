from app.path_manager import PathManager
from app.service.local_crew_registry import LocalCrewRegistry


def test_list_crews_includes_all_compiled_custom_agents(monkeypatch, tmp_path):
    agents_dir = tmp_path / "agents"
    agents_dir.mkdir()
    (agents_dir / "SMA-standalone.agent").write_text("---\nname: standalone\n---\n", encoding="utf-8")
    (agents_dir / "SMA-official-document-writing.agent").write_text(
        "---\nname: official\n---\n",
        encoding="utf-8",
    )
    (agents_dir / "magic.agent").write_text("---\nname: builtin\n---\n", encoding="utf-8")

    monkeypatch.setattr(
        PathManager,
        "get_agents_dir",
        classmethod(lambda cls: agents_dir),
    )

    crews = LocalCrewRegistry.list_crews()

    assert [crew["agent_code"] for crew in crews] == [
        "SMA-official-document-writing",
        "SMA-standalone",
    ]
    assert crews[0]["agent_file"] == str(agents_dir / "SMA-official-document-writing.agent")
    assert crews[0]["crew_dir"] == str(agents_dir / "crews" / "SMA-official-document-writing")
    assert crews[0]["compiled"] is True


def test_list_crews_includes_uncompiled_local_crew_dirs(monkeypatch, tmp_path):
    agents_dir = tmp_path / "agents"
    crew_dir = agents_dir / "crews" / "SMA-official-document-writing"
    crew_dir.mkdir(parents=True)
    (crew_dir / "IDENTITY.md").write_text(
        "---\nname: official\n---\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(
        PathManager,
        "get_agents_dir",
        classmethod(lambda cls: agents_dir),
    )

    crews = LocalCrewRegistry.list_crews()

    assert [crew["agent_code"] for crew in crews] == ["SMA-official-document-writing"]
    assert crews[0]["crew_dir"] == str(crew_dir)
    assert crews[0]["agent_file"] == str(agents_dir / "SMA-official-document-writing.agent")
    assert crews[0]["exists"] is True
    assert crews[0]["compiled"] is False


def test_list_crews_returns_empty_when_agents_dir_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(
        PathManager,
        "get_agents_dir",
        classmethod(lambda cls: tmp_path / "missing-agents"),
    )

    assert LocalCrewRegistry.list_crews() == []
