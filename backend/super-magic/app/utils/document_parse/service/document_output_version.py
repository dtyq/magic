"""文档 Markdown 输出目录版本选择。"""

from __future__ import annotations

from pathlib import Path

from app.utils.async_file_utils import async_exists, async_read_json

from ..constants import INDEX_FILENAME


class DocumentOutputVersionResolver:
    """在策略发生变化时为同一源文件选择独立的输出目录。"""

    @classmethod
    async def resolve(
        cls,
        output_dir: Path,
        source_path: Path,
        requested_strategy: str,
        resolved_strategy: str,
    ) -> Path:
        """返回可安全写入的目录，不覆盖已有其他策略产物。"""

        index = await cls._read_index(output_dir)
        if not cls._is_same_source(index, source_path):
            return output_dir
        recorded_strategy = cls._recorded_strategy(index)
        if requested_strategy == "auto" or recorded_strategy == resolved_strategy:
            return output_dir

        versioned = output_dir.with_name(f"{output_dir.name}__{resolved_strategy}")
        versioned_index = await cls._read_index(versioned)
        if not await async_exists(versioned) or cls._matches_strategy(versioned_index, source_path, resolved_strategy):
            return versioned

        suffix = 2
        while True:
            candidate = output_dir.with_name(f"{output_dir.name}__{resolved_strategy}_{suffix}")
            candidate_index = await cls._read_index(candidate)
            if not await async_exists(candidate) or cls._matches_strategy(candidate_index, source_path, resolved_strategy):
                return candidate
            suffix += 1

    @staticmethod
    async def _read_index(output_dir: Path) -> dict:
        """读取目录索引，缺失或损坏时返回空对象。"""

        index_path = output_dir / INDEX_FILENAME
        if not await async_exists(index_path):
            return {}
        try:
            return await async_read_json(index_path)
        except Exception:
            return {}

    @staticmethod
    def _is_same_source(index: dict, source_path: Path) -> bool:
        """判断索引是否属于当前源文件。"""

        return bool(index) and str(index.get("source_path") or "") == str(source_path)

    @staticmethod
    def _recorded_strategy(index: dict) -> str:
        """读取已生成产物记录的策略。"""

        return str(((index.get("metadata") or {}).get("asset_strategy") or {}).get("resolved_strategy") or "")

    @classmethod
    def _matches_strategy(cls, index: dict, source_path: Path, strategy: str) -> bool:
        """判断候选版本目录是否可复用。"""

        return cls._is_same_source(index, source_path) and cls._recorded_strategy(index) == strategy
