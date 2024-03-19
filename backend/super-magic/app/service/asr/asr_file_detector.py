"""
ASR 文件检测和分类模块

负责音频文件类型检测、文件扫描和格式识别
"""

import re
from pathlib import Path
from typing import List, Optional, Tuple

from loguru import logger

from app.service.asr.asr_base import AsrServiceBase


class AsrFileDetector(AsrServiceBase):
    """ASR 文件检测器 - 简化版,只支持 WAV 格式"""

    # 支持的音频格式 - 只支持 WAV
    SUPPORTED_AUDIO_FORMATS: list[str] = ["wav"]

    def extract_file_index(self, filename: str) -> Optional[int]:
        """
        从文件名提取序号

        支持格式: {index}.{ext}，例如 "0.webm", "1.mp3", "123.wav"

        Args:
            filename: 文件名

        Returns:
            文件序号，提取失败返回 None
        """
        try:
            formats_pattern = "|".join(self.SUPPORTED_AUDIO_FORMATS)
            pattern = rf"^(\d+)\.({formats_pattern})$"
            match = re.match(pattern, filename.lower())

            if match:
                return int(match.group(1))
            return None
        except Exception as e:
            logger.warning(f"{self.LOG_PREFIX} 提取文件序号失败: {filename}, 错误: {e}")
            return None

    def scan_audio_files(self, directory: Path, include_merged: bool = True) -> List[Tuple[int, Path]]:
        """
        扫描目录中的音频文件并按索引排序

        Args:
            directory: 要扫描的目录
            include_merged: 是否包含 merged.{ext} 文件

        Returns:
            List[Tuple[int, Path]]: 排序后的 (文件索引, 文件路径) 列表
        """
        files_dict = {}

        for file_path in directory.glob("*"):
            if file_path.is_file():
                if not include_merged and file_path.stem.startswith("merged"):
                    continue

                file_index = self.extract_file_index(file_path.name)
                if file_index is not None:
                    if file_index in files_dict:
                        existing_path, existing_mtime = files_dict[file_index]
                        current_mtime = file_path.stat().st_mtime

                        logger.warning(
                            f"{self.LOG_PREFIX} ⚠️ 发现重复索引 {file_index}: "
                            f"{existing_path.name} (mtime={existing_mtime:.2f}) vs "
                            f"{file_path.name} (mtime={current_mtime:.2f})"
                        )

                        if current_mtime > existing_mtime:
                            logger.info(f"{self.LOG_PREFIX} 📝 保留较新的文件: {file_path.name}")
                            files_dict[file_index] = (file_path, current_mtime)
                        else:
                            logger.info(f"{self.LOG_PREFIX} 📝 保留较新的文件: {existing_path.name}")
                    else:
                        files_dict[file_index] = (file_path, file_path.stat().st_mtime)

        files = [(idx, path) for idx, (path, _) in files_dict.items()]
        files.sort(key=lambda x: x[0])
        return files
