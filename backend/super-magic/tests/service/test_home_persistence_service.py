from app.service.home_persistence_service import HomePersistenceService


def test_initialize_creates_home_symlinks_after_user_home_is_available(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    home_dir.mkdir()
    user_home_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    HomePersistenceService.initialize_from_environment()

    expected_dirs = (".local/share", ".magic")
    for relative_path in expected_dirs:
        link = home_dir / relative_path
        target = user_home_dir / relative_path
        assert link.is_symlink()
        assert link.resolve(strict=False) == target.resolve(strict=False)
        assert target.is_dir()

    dws_dir = home_dir / ".dws"
    dws_config = dws_dir / "config.json"
    dws_identity = dws_dir / "identity.json"
    assert dws_dir.is_dir()
    assert not dws_dir.is_symlink()
    assert dws_config.is_symlink()
    assert dws_identity.is_symlink()
    assert dws_config.resolve(strict=False) == (user_home_dir / ".dws" / "config.json").resolve(strict=False)
    assert dws_identity.resolve(strict=False) == (user_home_dir / ".dws" / "identity.json").resolve(strict=False)

    lark_dir = home_dir / ".lark-cli"
    lark_config = lark_dir / "config.json"
    assert lark_dir.is_dir()
    assert not lark_dir.is_symlink()
    assert lark_config.is_symlink()
    assert lark_config.resolve(strict=False) == (user_home_dir / ".lark-cli" / "config.json").resolve(strict=False)


def test_initialize_moves_existing_local_magic_aside_before_symlink(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    existing_magic_dir = home_dir / ".magic"
    home_dir.mkdir()
    user_home_dir.mkdir()
    existing_magic_dir.mkdir()
    (existing_magic_dir / "mock-config.json").write_text("{}", encoding="utf-8")
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    HomePersistenceService.initialize_from_environment()

    magic_link = home_dir / ".magic"
    magic_target = user_home_dir / ".magic"
    assert magic_link.is_symlink()
    assert magic_link.resolve(strict=False) == magic_target.resolve(strict=False)
    assert not (magic_target / "mock-config.json").exists()
    backups = list(home_dir.glob(".magic.before-home-persistence-*"))
    assert len(backups) == 1
    assert (backups[0] / "mock-config.json").read_text(encoding="utf-8") == "{}"


def test_initialize_preserves_ignored_dws_local_directories(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    source_logs_dir = home_dir / ".dws" / "logs"
    target_logs_dir = user_home_dir / ".dws" / "logs"
    source_logs_dir.mkdir(parents=True)
    target_logs_dir.mkdir(parents=True)
    (source_logs_dir / "local.log").write_text("local", encoding="utf-8")
    (target_logs_dir / "persisted.log").write_text("persisted", encoding="utf-8")
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    HomePersistenceService.initialize_from_environment()

    dws_dir = home_dir / ".dws"
    dws_target = user_home_dir / ".dws"
    assert dws_dir.is_dir()
    assert not dws_dir.is_symlink()
    assert not (target_logs_dir / "local.log").exists()
    assert (target_logs_dir / "persisted.log").read_text(encoding="utf-8") == "persisted"
    assert (dws_dir / "logs" / "local.log").read_text(encoding="utf-8") == "local"
    backups = list(home_dir.glob(".dws.before-home-persistence-*"))
    assert len(backups) == 1
    assert not (backups[0] / "logs").exists()


def test_initialize_prefers_user_home_file_for_partial_dir(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    source_config = home_dir / ".dws" / "config.json"
    target_config = user_home_dir / ".dws" / "config.json"
    source_config.parent.mkdir(parents=True)
    target_config.parent.mkdir(parents=True)
    source_config.write_text("local", encoding="utf-8")
    target_config.write_text("persisted", encoding="utf-8")
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    HomePersistenceService.initialize_from_environment()

    dws_dir = home_dir / ".dws"
    dws_target = user_home_dir / ".dws"
    config_link = dws_dir / "config.json"
    assert dws_dir.is_dir()
    assert not dws_dir.is_symlink()
    assert config_link.is_symlink()
    assert config_link.resolve(strict=False) == target_config.resolve(strict=False)
    assert target_config.read_text(encoding="utf-8") == "persisted"
    assert not (dws_target / ".home-persistence-backup").exists()
    backups = list(home_dir.glob(".dws.before-home-persistence-*"))
    assert len(backups) == 1
    assert (backups[0] / "config.json").read_text(encoding="utf-8") == "local"


def test_initialize_skips_without_user_home_dir(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    home_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.delenv("USER_HOME_DIR", raising=False)

    HomePersistenceService.initialize_from_environment()

    assert not (home_dir / ".magic").exists()
