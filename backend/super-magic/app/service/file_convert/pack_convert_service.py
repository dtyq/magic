"""
ZIP 打包服务

负责将指定 file_keys 对应的文件按 workspace 相对路径打包为 ZIP。
"""

import traceback
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from app.path_manager import PathManager
from app.service.file_convert.base_convert_service import BaseConvertService


class PackConvertService(BaseConvertService):
    """ZIP 打包服务类"""

    def __init__(self):
        super().__init__("PACK")

    async def convert_file_keys_to_zip(
        self,
        file_keys: List[Dict[str, str]],
        task_key: Optional[str] = None,
        sts_credential: Optional[Dict[str, Any]] = None,
        output_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        将 file_keys 对应文件打包为 ZIP（保留目录结构）

        Args:
            file_keys: 文件 key 列表，每个元素包含 file_key
            task_key: 任务标识符，会在结果中原样返回
            sts_credential: STS 临时凭证，用于上传
            output_name: 输出 zip 文件名（可选，支持不带 .zip）

        Returns:
            打包结果字典
        """
        sts_cred_obj, batch_id, batch_dir = await self._prepare_conversion_context(
            file_keys=file_keys, sts_credential=sts_credential
        )

        try:
            file_path_mapping = await self.resolve_file_keys_to_workspace_paths(file_keys)
            if not file_path_mapping:
                raise RuntimeError("没有找到任何有效的 workspace 文件，请检查 file_keys 是否正确")

            zip_name = self._normalize_output_name(output_name)
            zip_path = batch_dir / zip_name
            archive_entries = self._build_archive_entries(file_path_mapping)

            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                for source_file, archive_name in archive_entries:
                    zipf.write(source_file, archive_name)

            logger.info(f"ZIP 打包完成: {zip_path}，共 {len(archive_entries)} 个文件")

            result: Dict[str, Any] = {
                "batch_id": batch_id,
                "total_files": len(archive_entries),
                "valid_files_count": len(archive_entries),
                "success_count": len(archive_entries),
                "conversion_rate": 100.0,
                "files": [],
            }

            if task_key:
                result["task_key"] = task_key

            zip_info = {"filename": zip_path.stem, "local_path": str(zip_path), "type": "zip"}

            try:
                _, oss_key = await self._upload_file_to_storage(zip_path, sts_cred_obj)
                if oss_key:
                    zip_info["oss_key"] = oss_key
                    logger.info(f"ZIP 上传成功，存储键: {oss_key}")
                else:
                    logger.warning("ZIP 上传失败，仅返回本地路径")
            except Exception as upload_error:
                logger.error(f"上传 ZIP 到对象存储失败: {upload_error}")

            result["files"].append(zip_info)
            return result

        except Exception as e:
            logger.error(f"PACK 打包过程中发生错误: {e}")
            logger.error(traceback.format_exc())
            raise RuntimeError(f"打包失败: {str(e)}")
        finally:
            logger.info(f"保留临时文件在目录: {batch_dir}")

    @staticmethod
    def _normalize_output_name(output_name: Optional[str]) -> str:
        """
        规范输出文件名。未指定时使用默认时间戳命名。
        """
        if not output_name:
            return BaseConvertService._generate_timestamped_filename("packed", "zip")

        normalized_name = output_name.strip()
        if not normalized_name:
            raise ValueError("output_name 不能为空")

        if "/" in normalized_name or "\\" in normalized_name:
            raise ValueError("output_name 不能包含路径分隔符")

        if normalized_name in {".", ".."}:
            raise ValueError("output_name 非法")

        if not normalized_name.lower().endswith(".zip"):
            normalized_name = f"{normalized_name}.zip"

        if normalized_name.lower() == ".zip":
            raise ValueError("output_name 非法")

        return normalized_name

    @staticmethod
    def _normalize_archive_name(file_key: str) -> str:
        """
        规范 ZIP 内路径，确保是安全的相对路径。
        """
        normalized_key = file_key.replace("\\", "/").strip()
        if not normalized_key:
            raise ValueError("file_key 不能为空")

        if normalized_key.startswith("/"):
            raise ValueError(f"file_key 不能是绝对路径: {file_key}")

        parts = [part for part in normalized_key.split("/") if part not in {"", "."}]
        if not parts:
            raise ValueError(f"file_key 非法: {file_key}")

        if any(part == ".." for part in parts):
            raise ValueError(f"file_key 包含非法路径段 '..': {file_key}")

        return "/".join(parts)

    def _build_archive_entries(self, file_path_mapping: Dict[str, Path]) -> List[Tuple[Path, str]]:
        """
        构建 ZIP 条目，确保源文件都在 workspace 内，并保持 file_key 目录结构。
        """
        workspace_dir = PathManager.get_workspace_dir().resolve()
        seen_archive_names = set()
        archive_entries: List[Tuple[Path, str]] = []

        for file_key, file_path in file_path_mapping.items():
            resolved_path = file_path.resolve()
            try:
                resolved_path.relative_to(workspace_dir)
            except ValueError:
                raise ValueError(f"file_key 超出 workspace 范围: {file_key}")

            archive_name = self._normalize_archive_name(file_key)
            if archive_name in seen_archive_names:
                raise ValueError(f"检测到重复的打包路径: {archive_name}")
            seen_archive_names.add(archive_name)

            archive_entries.append((resolved_path, archive_name))

        return archive_entries

    async def _convert_projects(
        self,
        projects: Dict[str, Dict[str, Any]],
        output_dir: Path,
        options: Optional[Dict[str, Any]] = None,
        task_mgr=None,
        task_key: Optional[str] = None,
        valid_files_count: int = 0,
        optimal_concurrency: int = 1,
        aigc_params=None,
    ) -> tuple[List[Path], List[str]]:
        """
        PACK 服务不使用项目级转换流程，此方法为抽象方法占位。
        """
        raise NotImplementedError("PackConvertService 不支持 _convert_projects")

    async def _get_service_specific_result_data(
        self, file_keys: List[Dict[str, str]], projects: Dict[str, Dict[str, Any]], converted_files: List[Path]
    ) -> Dict[str, Any]:
        """
        PACK 服务不使用该流程，此方法为抽象方法占位。
        """
        raise NotImplementedError("PackConvertService 不支持 _get_service_specific_result_data")
