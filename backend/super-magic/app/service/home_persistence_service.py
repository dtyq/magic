"""Initialize user HOME symlinks after the INIT message is available."""

import os
from pathlib import Path

from agentlang.logger import get_logger
from app.utils.async_file_utils import (
    async_exists,
    async_is_dir,
    async_is_symlink,
    async_mkdir,
    async_rename,
    async_rmtree,
    async_symlink,
    async_unlink,
)

logger = get_logger(__name__)


class HomePersistenceService:
    """Prepare HOME config symlinks for the current sandbox user."""

    _FULL_LINK_DIRS: tuple[str, ...] = (
        ".magic",
    )
    _PARTIAL_LINK_DIRS: dict[str, dict[str, tuple[str, ...]]] = {
        ".lark-cli": {
            "persistent_files": ("config.json", "update-state.json"),
        },
        ".dws": {
            "persistent_files": ("app.json", "identity.json", "config.json"),
        },
        ".local/share": {
            "persistent_dirs": ("dws-cli", "lark-cli"),
        },
    }

    @classmethod
    async def initialize_from_environment(cls) -> None:
        """Create HOME symlinks to USER_HOME_DIR after user context exists."""
        try:
            user_home_dir = os.environ.get("USER_HOME_DIR", "").strip()
            if not user_home_dir:
                logger.warning("[HomePersistence] USER_HOME_DIR 未设置，跳过 HOME 持久化软链初始化")
                return

            home_dir = Path.home()
            persistent_root = Path(user_home_dir)

            for relative_path, config in cls._PARTIAL_LINK_DIRS.items():
                await cls._initialize_partial_dir_safely(
                    relative_path=relative_path,
                    config=config,
                    home_dir=home_dir,
                    persistent_root=persistent_root,
                )

            for relative_path in cls._FULL_LINK_DIRS:
                await cls._initialize_full_link_safely(
                    relative_path=relative_path,
                    home_dir=home_dir,
                    persistent_root=persistent_root,
                )
        except Exception as e:
            logger.warning(
                f"[HomePersistence] HOME 持久化软链初始化失败，已跳过，不影响主流程: {e}",
                exc_info=True,
            )

    @classmethod
    async def _initialize_partial_dir_safely(
        cls,
        relative_path: str,
        config: dict[str, tuple[str, ...]],
        home_dir: Path,
        persistent_root: Path,
    ) -> None:
        try:
            await cls._ensure_partial_dir(
                link_root=home_dir / relative_path,
                target_root=persistent_root / relative_path,
                persistent_files=config.get("persistent_files", ()),
                persistent_dirs=config.get("persistent_dirs", ()),
            )
        except Exception as e:
            logger.warning(
                f"[HomePersistence] 持久化目录初始化失败，已跳过: {relative_path}, error={e}",
                exc_info=True,
            )

    @classmethod
    async def _initialize_full_link_safely(
        cls,
        relative_path: str,
        home_dir: Path,
        persistent_root: Path,
    ) -> None:
        try:
            target = persistent_root / relative_path
            link = home_dir / relative_path
            await cls._ensure_symlink(link=link, target=target)
        except Exception as e:
            logger.warning(
                f"[HomePersistence] 持久化软链初始化失败，已跳过: {relative_path}, error={e}",
                exc_info=True,
            )

    @classmethod
    async def _ensure_symlink(cls, link: Path, target: Path) -> None:
        """Ensure link points to target, preferring USER_HOME_DIR data."""
        if link.resolve(strict=False) == target.resolve(strict=False):
            await async_mkdir(target, parents=True, exist_ok=True)
            return

        await async_mkdir(target, parents=True, exist_ok=True)
        await async_mkdir(link.parent, parents=True, exist_ok=True)

        if await async_is_symlink(link):
            if link.resolve(strict=False) == target.resolve(strict=False):
                return
            await async_unlink(link)
            await async_symlink(target, link)
            logger.info(f"[HomePersistence] 已更新软链: {link} -> {target}")
            return

        if await async_exists(link):
            await cls._move_local_path_aside(link)

        await async_symlink(target, link)
        logger.info(f"[HomePersistence] 已创建软链: {link} -> {target}")

    @classmethod
    async def _move_local_path_aside(cls, path: Path) -> None:
        """Rename the local HOME path aside without scanning its contents."""
        backup_path = path.with_name(f"{path.name}.before-home-persistence")
        index = 1
        while await cls._path_exists_or_symlink(backup_path):
            backup_path = path.with_name(f"{path.name}.before-home-persistence.{index}")
            index += 1
        try:
            await async_rename(path, backup_path)
        except OSError as e:
            logger.warning(f"[HomePersistence] 挪开本地路径失败，跳过软链创建: {path}, error={e}")
            raise
        logger.info(
            f"[HomePersistence] 优先使用持久化目录，已挪开本地路径: {path} -> {backup_path}"
        )

    @classmethod
    async def _discard_local_file(cls, path: Path) -> None:
        """Remove a single local file/symlink so USER_HOME_DIR data wins."""
        if await async_is_dir(path) and not await async_is_symlink(path):
            raise IsADirectoryError(f"持久化文件路径被本地目录占用: {path}")
        await async_unlink(path)
        logger.info(f"[HomePersistence] 优先使用持久化文件，已移除本地文件: {path}")

    @classmethod
    async def _discard_local_path(cls, path: Path) -> None:
        """Remove a selected local path before replacing it with a symlink."""
        if await async_is_dir(path) and not await async_is_symlink(path):
            await async_rmtree(path)
        else:
            await async_unlink(path)
        logger.info(f"[HomePersistence] 优先使用持久化路径，已移除本地路径: {path}")

    @classmethod
    async def _ensure_partial_dir(
        cls,
        link_root: Path,
        target_root: Path,
        persistent_files: tuple[str, ...],
        persistent_dirs: tuple[str, ...],
    ) -> None:
        """Keep selected local dirs while symlinking selected persistent files."""
        await async_mkdir(target_root, parents=True, exist_ok=True)
        await async_mkdir(link_root.parent, parents=True, exist_ok=True)

        if await async_is_symlink(link_root):
            await async_unlink(link_root)
        elif await async_exists(link_root) and not await async_is_dir(link_root):
            await cls._discard_local_file(link_root)

        await async_mkdir(link_root, parents=True, exist_ok=True)

        for persistent_file in persistent_files:
            target = target_root / persistent_file
            link = link_root / persistent_file
            await async_mkdir(link.parent, parents=True, exist_ok=True)
            await async_mkdir(target.parent, parents=True, exist_ok=True)

            if await async_is_symlink(link):
                if link.resolve(strict=False) == target.resolve(strict=False):
                    continue
                await async_unlink(link)
            elif await async_exists(link):
                await cls._discard_local_file(link)

            await async_symlink(target, link)
            logger.info(f"[HomePersistence] 已创建持久化文件软链: {link} -> {target}")

        for persistent_dir in persistent_dirs:
            target = target_root / persistent_dir
            link = link_root / persistent_dir
            await async_mkdir(target, parents=True, exist_ok=True)
            await async_mkdir(link.parent, parents=True, exist_ok=True)

            if await async_is_symlink(link):
                if link.resolve(strict=False) == target.resolve(strict=False):
                    continue
                await async_unlink(link)
            elif await async_exists(link):
                await cls._discard_local_path(link)

            await async_symlink(target, link)
            logger.info(f"[HomePersistence] 已创建持久化目录软链: {link} -> {target}")

    @classmethod
    async def _path_exists_or_symlink(cls, path: Path) -> bool:
        return await async_exists(path) or await async_is_symlink(path)
