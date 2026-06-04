import pytest

from app.service.home_persistence_service import HomePersistenceService


@pytest.mark.asyncio
async def test_initialize_creates_home_symlinks_after_user_home_is_available(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    home_dir.mkdir()
    user_home_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    await HomePersistenceService.initialize_from_environment()

    expected_dirs = (".magic", ".lark-cli", ".dws")
    for relative_path in expected_dirs:
        link = home_dir / relative_path
        target = user_home_dir / relative_path
        assert link.is_symlink()
        assert link.resolve(strict=False) == target.resolve(strict=False)
        assert target.is_dir()

    dws_target = user_home_dir / ".dws"
    dws_cache = dws_target / "cache"
    dws_logs = dws_target / "logs"
    assert dws_cache.is_symlink()
    assert dws_logs.is_symlink()
    assert dws_cache.resolve(strict=False) == (home_dir / ".cache" / "dws" / "cache").resolve(strict=False)
    assert dws_logs.resolve(strict=False) == (home_dir / ".cache" / "dws" / "logs").resolve(strict=False)

    lark_target = user_home_dir / ".lark-cli"
    lark_cache = lark_target / "cache"
    lark_logs = lark_target / "logs"
    assert lark_cache.is_symlink()
    assert lark_logs.is_symlink()
    assert lark_cache.resolve(strict=False) == (home_dir / ".cache" / "lark-cli" / "cache").resolve(strict=False)
    assert lark_logs.resolve(strict=False) == (home_dir / ".cache" / "lark-cli" / "logs").resolve(strict=False)

    local_share_dir = home_dir / ".local" / "share"
    dws_cli_dir = local_share_dir / "dws-cli"
    lark_cli_dir = local_share_dir / "lark-cli"
    assert local_share_dir.is_dir()
    assert not local_share_dir.is_symlink()
    assert dws_cli_dir.is_symlink()
    assert lark_cli_dir.is_symlink()
    assert dws_cli_dir.resolve(strict=False) == (user_home_dir / ".local" / "share" / "dws-cli").resolve(strict=False)
    assert lark_cli_dir.resolve(strict=False) == (user_home_dir / ".local" / "share" / "lark-cli").resolve(strict=False)


@pytest.mark.asyncio
async def test_lark_cli_atomic_config_replace_writes_to_persistent_dir(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    home_dir.mkdir()
    user_home_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    await HomePersistenceService.initialize_from_environment()

    temp_config = home_dir / ".lark-cli" / "config.json.tmp"
    home_config = home_dir / ".lark-cli" / "config.json"
    persistent_config = user_home_dir / ".lark-cli" / "config.json"
    temp_config.write_text("login-config", encoding="utf-8")
    temp_config.replace(home_config)

    assert persistent_config.read_text(encoding="utf-8") == "login-config"


@pytest.mark.asyncio
async def test_dws_atomic_config_replace_writes_to_persistent_dir(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    home_dir.mkdir()
    user_home_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    await HomePersistenceService.initialize_from_environment()

    temp_config = home_dir / ".dws" / "config.json.tmp"
    home_config = home_dir / ".dws" / "config.json"
    persistent_config = user_home_dir / ".dws" / "config.json"
    temp_config.write_text("dws-login-config", encoding="utf-8")
    temp_config.replace(home_config)

    assert persistent_config.read_text(encoding="utf-8") == "dws-login-config"


@pytest.mark.asyncio
async def test_initialize_moves_existing_local_lark_cli_aside_before_full_link(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    local_lark_dir = home_dir / ".lark-cli"
    persistent_lark_dir = user_home_dir / ".lark-cli"
    local_lark_dir.mkdir(parents=True)
    persistent_lark_dir.mkdir(parents=True)
    (local_lark_dir / "config.json").write_text("install-config", encoding="utf-8")
    (persistent_lark_dir / "config.json").write_text("persisted-config", encoding="utf-8")
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    await HomePersistenceService.initialize_from_environment()

    lark_link = home_dir / ".lark-cli"
    assert lark_link.is_symlink()
    assert lark_link.resolve(strict=False) == persistent_lark_dir.resolve(strict=False)
    assert (persistent_lark_dir / "config.json").read_text(encoding="utf-8") == "persisted-config"
    backups = list(home_dir.glob(".lark-cli.before-home-persistence*"))
    assert len(backups) == 1
    assert (backups[0] / "config.json").read_text(encoding="utf-8") == "install-config"


@pytest.mark.asyncio
async def test_initialize_moves_existing_local_dws_aside_before_full_link(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    local_dws_dir = home_dir / ".dws"
    persistent_dws_dir = user_home_dir / ".dws"
    local_dws_dir.mkdir(parents=True)
    persistent_dws_dir.mkdir(parents=True)
    (local_dws_dir / "config.json").write_text("install-dws-config", encoding="utf-8")
    (persistent_dws_dir / "config.json").write_text("persisted-dws-config", encoding="utf-8")
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    await HomePersistenceService.initialize_from_environment()

    dws_link = home_dir / ".dws"
    assert dws_link.is_symlink()
    assert dws_link.resolve(strict=False) == persistent_dws_dir.resolve(strict=False)
    assert (persistent_dws_dir / "config.json").read_text(encoding="utf-8") == "persisted-dws-config"
    backups = list(home_dir.glob(".dws.before-home-persistence*"))
    assert len(backups) == 1
    assert (backups[0] / "config.json").read_text(encoding="utf-8") == "install-dws-config"


@pytest.mark.asyncio
async def test_initialize_moves_existing_local_magic_aside_before_symlink(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    existing_magic_dir = home_dir / ".magic"
    home_dir.mkdir()
    user_home_dir.mkdir()
    existing_magic_dir.mkdir()
    (existing_magic_dir / "mock-config.json").write_text("{}", encoding="utf-8")
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    await HomePersistenceService.initialize_from_environment()

    magic_link = home_dir / ".magic"
    magic_target = user_home_dir / ".magic"
    assert magic_link.is_symlink()
    assert magic_link.resolve(strict=False) == magic_target.resolve(strict=False)
    assert not (magic_target / "mock-config.json").exists()
    backups = list(home_dir.glob(".magic.before-home-persistence*"))
    assert len(backups) == 1
    assert (backups[0] / "mock-config.json").read_text(encoding="utf-8") == "{}"


@pytest.mark.asyncio
async def test_initialize_moves_local_dws_runtime_dirs_aside_before_full_link(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    source_logs_dir = home_dir / ".dws" / "logs"
    target_logs_dir = user_home_dir / ".dws" / "logs"
    source_logs_dir.mkdir(parents=True)
    (source_logs_dir / "local.log").write_text("local", encoding="utf-8")
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    await HomePersistenceService.initialize_from_environment()

    dws_dir = home_dir / ".dws"
    dws_target = user_home_dir / ".dws"
    local_logs_dir = home_dir / ".cache" / "dws" / "logs"
    assert dws_dir.is_dir()
    assert dws_dir.is_symlink()
    assert dws_dir.resolve(strict=False) == dws_target.resolve(strict=False)
    assert target_logs_dir.is_symlink()
    assert target_logs_dir.resolve(strict=False) == local_logs_dir.resolve(strict=False)
    assert not (dws_dir / "logs" / "local.log").exists()
    backups = list(home_dir.glob(".dws.before-home-persistence*"))
    assert len(backups) == 1
    assert (backups[0] / "logs" / "local.log").read_text(encoding="utf-8") == "local"


@pytest.mark.asyncio
async def test_initialize_prefers_persistent_dws_config_over_local_install_config(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    source_config = home_dir / ".dws" / "config.json"
    target_config = user_home_dir / ".dws" / "config.json"
    source_config.parent.mkdir(parents=True)
    target_config.parent.mkdir(parents=True)
    source_config.write_text("install-dws-config", encoding="utf-8")
    target_config.write_text("persisted-dws-config", encoding="utf-8")
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    await HomePersistenceService.initialize_from_environment()

    dws_dir = home_dir / ".dws"
    dws_target = user_home_dir / ".dws"
    assert dws_dir.is_dir()
    assert dws_dir.is_symlink()
    assert dws_dir.resolve(strict=False) == dws_target.resolve(strict=False)
    assert target_config.read_text(encoding="utf-8") == "persisted-dws-config"
    backups = list(home_dir.glob(".dws.before-home-persistence*"))
    assert len(backups) == 1
    assert (backups[0] / "config.json").read_text(encoding="utf-8") == "install-dws-config"
    assert not (dws_target / ".home-persistence-backup").exists()


@pytest.mark.asyncio
async def test_initialize_only_persists_selected_local_share_dirs(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    local_share = home_dir / ".local" / "share"
    local_dws_cli = local_share / "dws-cli"
    local_other = local_share / "opencode"
    target_dws_cli = user_home_dir / ".local" / "share" / "dws-cli"
    local_dws_cli.mkdir(parents=True)
    local_other.mkdir(parents=True)
    target_dws_cli.mkdir(parents=True)
    (local_dws_cli / "local-token").write_text("local", encoding="utf-8")
    (local_other / "state.json").write_text("local-only", encoding="utf-8")
    (target_dws_cli / "auth-token.enc").write_text("persisted", encoding="utf-8")
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    await HomePersistenceService.initialize_from_environment()

    dws_cli_link = local_share / "dws-cli"
    assert local_share.is_dir()
    assert not local_share.is_symlink()
    assert dws_cli_link.is_symlink()
    assert dws_cli_link.resolve(strict=False) == target_dws_cli.resolve(strict=False)
    assert not (target_dws_cli / "local-token").exists()
    assert (target_dws_cli / "auth-token.enc").read_text(encoding="utf-8") == "persisted"
    assert (local_other / "state.json").read_text(encoding="utf-8") == "local-only"


@pytest.mark.asyncio
async def test_initialize_skips_without_user_home_dir(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    home_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.delenv("USER_HOME_DIR", raising=False)

    await HomePersistenceService.initialize_from_environment()

    assert not (home_dir / ".magic").exists()


@pytest.mark.asyncio
async def test_initialize_continues_when_partial_dir_fails(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    home_dir.mkdir()
    user_home_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    async def fail_partial_dir(cls, **kwargs):
        raise RuntimeError("mock partial init failure")

    monkeypatch.setattr(HomePersistenceService, "_ensure_partial_dir", fail_partial_dir)

    await HomePersistenceService.initialize_from_environment()

    magic_link = home_dir / ".magic"
    magic_target = user_home_dir / ".magic"
    assert magic_link.is_symlink()
    assert magic_link.resolve(strict=False) == magic_target.resolve(strict=False)


@pytest.mark.asyncio
async def test_initialize_does_not_raise_when_full_link_fails(tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    user_home_dir = tmp_path / "user-home"
    home_dir.mkdir()
    user_home_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USER_HOME_DIR", str(user_home_dir))

    async def fail_full_link(cls, **kwargs):
        raise RuntimeError("mock full link failure")

    monkeypatch.setattr(HomePersistenceService, "_ensure_symlink", fail_full_link)

    await HomePersistenceService.initialize_from_environment()

    assert (home_dir / ".local" / "share").is_dir()
    assert not (home_dir / ".dws").exists()
    assert not (home_dir / ".magic").exists()
