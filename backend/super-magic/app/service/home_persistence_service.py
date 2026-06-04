"""Initialize user HOME symlinks after the INIT message is available."""

import os
import uuid
from pathlib import Path

from agentlang.logger import get_logger

logger = get_logger(__name__)


class HomePersistenceService:
    """Prepare HOME config symlinks for the current sandbox user."""

    _FULL_LINK_DIRS: tuple[str, ...] = (
        ".local/share",
        ".magic",
    )
    _PARTIAL_LINK_DIRS: dict[str, dict[str, tuple[str, ...]]] = {
        ".lark-cli": {
            "persistent_files": ("config.json",),
            "local_dirs": ("skills", "logs", "cache"),
        },
        ".dws": {
            "persistent_files": ("identity.json", "config.json"),
            "local_dirs": ("skills", "logs", "cache"),
        },
    }

    @classmethod
    def initialize_from_environment(cls) -> None:
        """Create HOME symlinks to USER_HOME_DIR after user context exists."""
        user_home_dir = os.environ.get("USER_HOME_DIR", "").strip()
        if not user_home_dir:
            logger.warning("[HomePersistence] USER_HOME_DIR 未设置，跳过 HOME 持久化软链初始化")
            return

        home_dir = Path.home()
        persistent_root = Path(user_home_dir)

        for relative_path, config in cls._PARTIAL_LINK_DIRS.items():
            cls._ensure_partial_dir(
                link_root=home_dir / relative_path,
                target_root=persistent_root / relative_path,
                persistent_files=config["persistent_files"],
                local_dirs=config["local_dirs"],
            )

        for relative_path in cls._FULL_LINK_DIRS:
            target = persistent_root / relative_path
            link = home_dir / relative_path
            cls._ensure_symlink(link=link, target=target)

    @classmethod
    def _ensure_symlink(cls, link: Path, target: Path) -> None:
        """Ensure link points to target, preferring USER_HOME_DIR data."""
        if link.resolve(strict=False) == target.resolve(strict=False):
            target.mkdir(parents=True, exist_ok=True)
            return

        target.mkdir(parents=True, exist_ok=True)
        link.parent.mkdir(parents=True, exist_ok=True)

        if link.is_symlink():
            if link.resolve(strict=False) == target.resolve(strict=False):
                return
            link.unlink()
            link.symlink_to(target)
            logger.info(f"[HomePersistence] 已更新软链: {link} -> {target}")
            return

        if link.exists():
            cls._move_local_path_aside(link)

        link.symlink_to(target)
        logger.info(f"[HomePersistence] 已创建软链: {link} -> {target}")

    @classmethod
    def _move_local_path_aside(cls, path: Path) -> None:
        """Rename the local HOME path aside without scanning its contents."""
        backup_path = cls._local_backup_path(path)
        path.rename(backup_path)
        logger.info(
            f"[HomePersistence] 优先使用持久化目录，已挪开本地路径: {path} -> {backup_path}"
        )

    @classmethod
    def _ensure_partial_dir(
        cls,
        link_root: Path,
        target_root: Path,
        persistent_files: tuple[str, ...],
        local_dirs: tuple[str, ...],
    ) -> None:
        """Keep selected local dirs while symlinking selected persistent files."""
        target_root.mkdir(parents=True, exist_ok=True)
        link_root.parent.mkdir(parents=True, exist_ok=True)

        backup_root: Path | None = None
        if link_root.is_symlink() or link_root.exists():
            if link_root.is_dir() and not link_root.is_symlink():
                backup_root = cls._local_backup_path(link_root)
                link_root.rename(backup_root)
                logger.info(
                    f"[HomePersistence] 已挪开本地目录以创建部分挂载: {link_root} -> {backup_root}"
                )
            else:
                link_root.unlink()

        link_root.mkdir(parents=True, exist_ok=True)

        if backup_root is not None:
            for local_dir in local_dirs:
                source = backup_root / local_dir
                destination = link_root / local_dir
                if source.exists() and not destination.exists():
                    source.rename(destination)
                    logger.info(f"[HomePersistence] 已保留本地忽略目录: {destination}")

        for persistent_file in persistent_files:
            target = target_root / persistent_file
            link = link_root / persistent_file
            link.parent.mkdir(parents=True, exist_ok=True)
            target.parent.mkdir(parents=True, exist_ok=True)

            if link.is_symlink():
                if link.resolve(strict=False) == target.resolve(strict=False):
                    continue
                link.unlink()
            elif link.exists():
                cls._move_local_path_aside(link)

            link.symlink_to(target)
            logger.info(f"[HomePersistence] 已创建持久化文件软链: {link} -> {target}")

    @staticmethod
    def _local_backup_path(path: Path) -> Path:
        suffix = uuid.uuid4().hex
        return path.with_name(f"{path.name}.before-home-persistence-{suffix}")
