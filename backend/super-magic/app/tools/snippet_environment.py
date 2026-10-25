import re
from pathlib import Path
from typing import Any, ClassVar, Literal

from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_create_temp_text_file,
    async_unlink,
)
from app.utils.runtime_storage import (
    RuntimeEvictionPolicy,
    ensure_runtime_directory,
    evict_runtime_files,
    get_runtime_config_int,
    get_runtime_config_size_bytes,
    trigger_opportunistic_cleanup,
)

CURRENT_MODEL_ENV_NAME = "SUPER_MAGIC_CURRENT_MODEL_ID"
_TOOL_CALL_USAGE_PATTERN = re.compile(r"\btool\.call\s*\(")


class SnippetEnvironment:
    """代码片段子进程环境变量构建辅助类。"""

    _active_scripts: ClassVar[set[Path]] = set()

    @staticmethod
    def _load_eviction_policy() -> RuntimeEvictionPolicy:
        return RuntimeEvictionPolicy(
            max_entries=get_runtime_config_int(
                "runtime_cleanup.snippets.max_file_count",
                minimum=1,
            ),
            target_entries=get_runtime_config_int(
                "runtime_cleanup.snippets.target_file_count",
                minimum=0,
            ),
            max_total_bytes=get_runtime_config_size_bytes(
                "runtime_cleanup.snippets.max_total_size",
                minimum=1,
            ),
            target_total_bytes=get_runtime_config_size_bytes(
                "runtime_cleanup.snippets.target_total_size",
                minimum=0,
            ),
            max_age_seconds=get_runtime_config_int(
                "runtime_cleanup.snippets.max_age_days",
                minimum=1,
            )
            * 24
            * 60
            * 60,
        )

    @staticmethod
    def resolve_working_dir(workspace_dir: str, cwd: str | None) -> Path:
        """解析代码片段工作目录：相对路径锚定 workspace，绝对路径直接使用。"""
        workspace_path = Path(workspace_dir)
        if cwd is None or not cwd.strip():
            return workspace_path

        requested_path = Path(cwd)
        if requested_path.is_absolute():
            return requested_path
        return workspace_path / requested_path

    @staticmethod
    async def create_temporary_script(
        python_code: str,
        capability: Literal["run_python", "run_sdk"],
    ) -> Path:
        """在 `.runtime/snippets` 中创建仅当前用户可访问的短期脚本。"""
        runtime_dir = await ensure_runtime_directory(
            PathManager.get_runtime_dir() / "snippets" / capability
        )
        script_path = await async_create_temp_text_file(
            python_code,
            suffix=".py",
            prefix="",
            directory=runtime_dir,
        )
        SnippetEnvironment._active_scripts.add(script_path)
        trigger_opportunistic_cleanup(
            f"snippets:{capability}",
            lambda: evict_runtime_files(
                runtime_dir,
                policy=SnippetEnvironment._load_eviction_policy(),
                suffixes=(".py",),
                protected_paths=frozenset(SnippetEnvironment._active_scripts),
            ),
        )
        return script_path

    @staticmethod
    async def delete_temporary_script(script_path: Path) -> None:
        """解除活跃脚本保护并删除文件；删除失败时允许后续机会式清理接管。"""
        SnippetEnvironment._active_scripts.discard(script_path)
        await async_unlink(script_path)

    @staticmethod
    def format_execution_error(summary: str, error: Exception) -> str:
        """为模型和代码执行详情保留可修复的原始异常信息。"""
        return f"{summary}\n\nError details:\n{type(error).__name__}: {error}"

    @staticmethod
    def apply_current_model(extra_env: dict[str, str], agent_ctx: Any) -> None:
        """将 Agent 当前文本模型写入代码片段子进程环境。"""
        model_context = getattr(agent_ctx, "model_context", None)
        current_model_id = getattr(model_context, "current_text_model_id", None)
        if current_model_id:
            extra_env[CURRENT_MODEL_ENV_NAME] = current_model_id

    @staticmethod
    def looks_like_code_mode(python_code: str) -> bool:
        """判断代码是否包含通过 sdk.tool 调用工具的迹象。"""
        return "sdk.tool" in python_code or bool(
            _TOOL_CALL_USAGE_PATTERN.search(python_code)
        )
