"""跨项目挂载根解析测试。

挂载根的来源优先级直接决定 agent 能否读到用户引用的跨项目文件：
网关显式注入时以注入值为准，未注入时跟随 AGFS FUSE 挂载根派生，
不能各自维护一份会漂移的默认值。
"""

from app.utils.agfs_mount_path import (
    DEFAULT_AGFS_FUSE_MOUNT_PATH,
    get_agfs_fuse_mount_root,
    get_referenced_project_mount_base,
)


def test_referenced_project_base_follows_fuse_mount_root(monkeypatch):
    """未显式注入时，跨项目挂载根必须落在 FUSE 挂载根之下。

    例：FUSE 根为 /mnt/agfs-vol/agfs（空卷根下的一级子目录）时，
    跨项目挂载根是 /mnt/agfs-vol/agfs/magicfs/referenced-projects。
    """
    monkeypatch.delenv("AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH", raising=False)
    monkeypatch.setenv("AGFS_FUSE_MOUNT_PATH", "/mnt/agfs-vol/agfs")

    assert str(get_referenced_project_mount_base()) == "/mnt/agfs-vol/agfs/magicfs/referenced-projects"
    assert str(get_agfs_fuse_mount_root()) == "/mnt/agfs-vol/agfs"


def test_explicit_referenced_project_base_wins(monkeypatch):
    """网关显式注入的挂载根优先于派生结果。"""
    monkeypatch.setenv("AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH", "/custom/referenced-projects")
    monkeypatch.setenv("AGFS_FUSE_MOUNT_PATH", "/mnt/agfs-vol/agfs")

    assert str(get_referenced_project_mount_base()) == "/custom/referenced-projects"


def test_blank_env_falls_back_to_default_mount_root(monkeypatch):
    """环境变量为空串时回到旧默认值，兼容尚未注入变量的沙箱。"""
    monkeypatch.setenv("AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH", "   ")
    monkeypatch.setenv("AGFS_FUSE_MOUNT_PATH", "")

    assert str(get_agfs_fuse_mount_root()) == DEFAULT_AGFS_FUSE_MOUNT_PATH
    assert str(get_referenced_project_mount_base()) == "/mnt/agfs/magicfs/referenced-projects"


def test_mount_root_is_normalized(monkeypatch):
    """带尾斜杠或冗余分隔符的注入值需要归一化，避免拼出双重斜杠路径。"""
    monkeypatch.setenv("AGFS_FUSE_MOUNT_PATH", "/mnt/agfs-vol/agfs/")

    assert str(get_agfs_fuse_mount_root()) == "/mnt/agfs-vol/agfs"
