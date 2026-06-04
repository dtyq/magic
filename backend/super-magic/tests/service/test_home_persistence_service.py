from app.service.home_persistence_service import HomePersistenceService


def test_initialize_creates_home_symlinks_after_user_home_is_available(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    home_dir.mkdir()
    user_home_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    HomePersistenceService.initialize_from_environment()

    expected_dirs = (".lark-cli", ".dws", ".local/share", ".magic")
    for relative_path in expected_dirs:
        link = home_dir / relative_path
        target = user_home_dir / relative_path
        assert link.is_symlink()
        assert link.resolve(strict=False) == target.resolve(strict=False)
        assert target.is_dir()


def test_initialize_migrates_existing_magic_content_before_symlink(tmp_path, monkeypatch):
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
    assert (magic_target / "mock-config.json").read_text(encoding="utf-8") == "{}"


def test_initialize_recursively_merges_existing_directories(tmp_path, monkeypatch):
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

    dws_link = home_dir / ".dws"
    dws_target = user_home_dir / ".dws"
    assert dws_link.is_symlink()
    assert dws_link.resolve(strict=False) == dws_target.resolve(strict=False)
    assert (target_logs_dir / "local.log").read_text(encoding="utf-8") == "local"
    assert (target_logs_dir / "persisted.log").read_text(encoding="utf-8") == "persisted"


def test_initialize_skips_without_user_home_dir(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    home_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.delenv("USER_HOME_DIR", raising=False)

    HomePersistenceService.initialize_from_environment()

    assert not (home_dir / ".magic").exists()
