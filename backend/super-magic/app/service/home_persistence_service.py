"""Initialize user HOME symlinks after the INIT message is available."""

import os
import shutil
from pathlib import Path

from agentlang.logger import get_logger

logger = get_logger(__name__)


class HomePersistenceService:
    """Prepare HOME config symlinks for the current sandbox user."""

    _PERSISTENT_DIRS: tuple[str, ...] = (
        ".lark-cli",
        ".dws",
        ".local/share",
        ".magic",
    )

    @classmethod
    def initialize_from_environment(cls) -> None:
        """Create HOME symlinks to USER_HOME_DIR after user context exists."""
        user_home_dir = os.environ.get("USER_HOME_DIR", "").strip()
        if not user_home_dir:
            logger.warning("[HomePersistence] USER_HOME_DIR 未设置，跳过 HOME 持久化软链初始化")
            return

        home_dir = Path.home()
        persistent_root = Path(user_home_dir)

        for relative_path in cls._PERSISTENT_DIRS:
            target = persistent_root / relative_path
            link = home_dir / relative_path
            cls._ensure_symlink(link=link, target=target)

    @classmethod
    def _ensure_symlink(cls, link: Path, target: Path) -> None:
        """Ensure link points to target without dropping existing local content."""
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
            if not cls._merge_existing_path(source=link, target=target):
                return

        link.symlink_to(target)
        logger.info(f"[HomePersistence] 已创建软链: {link} -> {target}")

    @classmethod
    def _merge_existing_path(cls, source: Path, target: Path) -> bool:
        """Move existing source content into target, preferring target conflicts."""
        if source.is_dir():
            if not cls._merge_directory_contents(
                source=source,
                target=target,
                source_root=source,
                backup_root=target / ".home-persistence-backup",
            ):
                return False
            source.rmdir()
            logger.info(f"[HomePersistence] 已迁移已有目录内容: {source} -> {target}")
            return True

        destination = target / source.name
        if destination.exists() or destination.is_symlink():
            cls._backup_conflicting_source(
                source=source,
                backup_path=target / ".home-persistence-backup" / source.name,
            )
            return True

        shutil.move(str(source), str(destination))
        logger.info(f"[HomePersistence] 已迁移已有文件: {source} -> {destination}")
        return True

    @classmethod
    def _merge_directory_contents(
        cls,
        source: Path,
        target: Path,
        source_root: Path,
        backup_root: Path,
    ) -> bool:
        """Recursively merge source directory contents into target."""
        for child in source.iterdir():
            destination = target / child.name
            if not destination.exists() and not destination.is_symlink():
                shutil.move(str(child), str(destination))
                continue

            if child.is_dir() and destination.is_dir() and not destination.is_symlink():
                if not cls._merge_directory_contents(
                    source=child,
                    target=destination,
                    source_root=source_root,
                    backup_root=backup_root,
                ):
                    return False
                child.rmdir()
                continue

            cls._backup_conflicting_source(
                source=child,
                backup_path=backup_root / child.relative_to(source_root),
            )

        return True

    @classmethod
    def _backup_conflicting_source(cls, source: Path, backup_path: Path) -> None:
        """Move a source-side conflict aside so USER_HOME_DIR data wins."""
        backup_path = cls._unique_backup_path(backup_path)
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(backup_path))
        logger.warning(
            f"[HomePersistence] 目标已存在，优先使用持久化目录，已备份本地冲突路径: {source} -> {backup_path}"
        )

    @staticmethod
    def _unique_backup_path(path: Path) -> Path:
        if not path.exists() and not path.is_symlink():
            return path

        for index in range(1, 1000):
            candidate = path.with_name(f"{path.name}.{index}")
            if not candidate.exists() and not candidate.is_symlink():
                return candidate

        raise RuntimeError(f"无法为冲突路径生成备份文件名: {path}")
