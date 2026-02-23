"""
Migration Helper - Universal migration and compatibility tool for startup changes.

This module provides a simple framework for handling various types of migrations
during application startup, including directory migrations, configuration updates,
and data transformations.
"""

import os
import shutil
import threading
import asyncio
from pathlib import Path
from typing import Callable, Dict, Any, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from app.path_manager import PathManager
from agentlang.logger import get_logger
from app.utils.async_file_utils import async_copy2

logger = get_logger(__name__)

@dataclass
class MigrationTask:
    """Migration task configuration"""
    name: str
    migration_func: Callable
    is_async: bool = True  # True for async, False for sync

# Global migration registry
_migration_tasks: Dict[str, MigrationTask] = {}
_migration_executed = False


def register_migration(name: str, migration_func: Callable, is_async: bool = True) -> None:
    """Register a migration task to be executed on startup.

    Args:
        name: Unique name for the migration task
        migration_func: Function to execute the migration
        is_async: Whether to run migration asynchronously (default: True)
    """
    _migration_tasks[name] = MigrationTask(name, migration_func, is_async)
    logger.debug(f"Registered migration task: {name} ({'async' if is_async else 'sync'})")


def run_startup_migrations() -> None:
    """Execute all registered migration tasks (sync first, then async)."""
    global _migration_executed

    if _migration_executed or not _migration_tasks:
        return

    _migration_executed = True

    # First, execute all synchronous migrations
    sync_tasks = [task for task in _migration_tasks.values() if not task.is_async]
    for task in sync_tasks:
        try:
            logger.info(f"Starting sync migration task: {task.name}")
            task.migration_func()
            logger.info(f"Sync migration task completed: {task.name}")
        except Exception as e:
            logger.error(f"Sync migration task failed: {task.name}, error: {e}")

    # Then, execute all asynchronous migrations in background
    async_tasks = [task for task in _migration_tasks.values() if task.is_async]
    if async_tasks:
        def execute_async_migrations():
            """Execute async migrations in background thread."""
            try:
                with ThreadPoolExecutor(max_workers=3, thread_name_prefix="migration") as executor:
                    futures = []
                    for task in async_tasks:
                        logger.info(f"Starting async migration task: {task.name}")
                        future = executor.submit(task.migration_func)
                        futures.append((task.name, future))

                    # Wait for all migrations to complete
                    for name, future in futures:
                        try:
                            future.result(timeout=60)  # 60 second timeout per task
                            logger.info(f"Async migration task completed: {name}")
                        except Exception as e:
                            logger.error(f"Async migration task failed: {name}, error: {e}")
            except Exception as e:
                logger.error(f"Async migration execution failed: {e}")

        # Run async migrations in background thread
        migration_thread = threading.Thread(target=execute_async_migrations, daemon=True)
        migration_thread.start()
        logger.info(f"Started {len(async_tasks)} background migration tasks")


def get_migrated_path(old_path: str, new_path: str, workspace_relative: bool = True) -> Path:
    """Get the correct path after migration, handling compatibility.

    Args:
        old_path: Original path name
        new_path: New path name
        workspace_relative: Whether paths are relative to workspace

    Returns:
        Path object pointing to the correct location
    """
    if workspace_relative:
        workspace_dir = PathManager.get_workspace_dir()
        old_full_path = workspace_dir / old_path
        new_full_path = workspace_dir / new_path
    else:
        old_full_path = Path(old_path)
        new_full_path = Path(new_path)

    # Prefer new path if it exists
    if new_full_path.exists():
        return new_full_path

    # Use old path if it exists (compatibility mode)
    if old_full_path.exists():
        logger.warning(f"Using legacy path: {old_full_path}, consider migrating to: {new_full_path}")
        return old_full_path

    # Neither exists, return new path (will be created when needed)
    return new_full_path


async def migrate_directory(old_path: Path, new_path: Path, merge_if_exists: bool = True) -> bool:
    """Migrate a directory from old location to new location.

    Args:
        old_path: Source directory path
        new_path: Target directory path
        merge_if_exists: If True, merge files when target exists; if False, skip migration

    Returns:
        True if migration was performed, False if not needed
    """
    if not old_path.exists():
        return False

    try:
        # Ensure target directory exists
        new_path.mkdir(parents=True, exist_ok=True)

        # If target exists and merge is enabled, merge files
        if new_path.exists() and merge_if_exists:
            logger.info(f"Target directory exists, merging files: {old_path} -> {new_path}")

            # Copy all files and subdirectories from old to new
            for item in old_path.rglob('*'):
                if item.is_file():
                    # Calculate relative path from old_path
                    relative_path = item.relative_to(old_path)
                    target_file = new_path / relative_path

                    # Ensure target directory exists
                    target_file.parent.mkdir(parents=True, exist_ok=True)

                    # Only copy if target doesn't exist (don't overwrite)
                    if not target_file.exists():
                        await async_copy2(item, target_file)
                        logger.debug(f"Merged file: {item} -> {target_file}")
                    else:
                        logger.debug(f"File already exists, skipping: {target_file}")

            # Remove old directory after successful migration
            shutil.rmtree(old_path)
            logger.info(f"Successfully merged and removed old directory: {old_path}")
            return True

        elif not new_path.exists():
            # Simple move if target doesn't exist
            new_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(old_path), str(new_path))
            logger.info(f"Successfully migrated directory: {old_path} -> {new_path}")
            return True
        else:
            logger.info(f"Target exists and merge disabled, skipping migration: {new_path}")
            return False

    except Exception as e:
        logger.error(f"Failed to migrate directory: {old_path} -> {new_path}, error: {e}")
        return False


# Webview Reports Migration Implementation
def migrate_webview_reports() -> None:
    """Migrate webview_reports directories to .webview-reports with file merging."""
    workspace_dir = PathManager.get_workspace_dir()
    old_path = workspace_dir / "webview_reports"
    new_path = workspace_dir / ".webview-reports"

    # Run async function in sync context
    try:
        if asyncio.run(migrate_directory(old_path, new_path, merge_if_exists=True)):
            logger.info("Webview reports directory migrated successfully")
        else:
            logger.debug("Webview reports migration not needed")
    except Exception as e:
        logger.error(f"Webview reports migration failed: {e}")


# Auto-register webview reports migration (async)
register_migration("webview_reports", migrate_webview_reports, is_async=True)
