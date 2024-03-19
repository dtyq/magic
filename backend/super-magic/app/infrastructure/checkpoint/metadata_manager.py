# -*- coding: utf-8 -*-
"""
Checkpoint元数据管理器

这个模块负责管理checkpoint的元数据，包括：
- 保存和加载checkpoint信息
- 管理checkpoint清单
- 从清单中添加和移除checkpoint
"""

import json
import os
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from app.core.entity.checkpoint import CheckpointInfo, CheckpointManifest, VirtualCheckpoint
from app.infrastructure.checkpoint.storage import CheckpointStorage
from app.utils.async_file_utils import async_write_json, async_read_json
from agentlang.logger import get_logger

logger = get_logger(__name__)


class CheckpointMetadataManager:
    """Checkpoint元数据管理器"""

    def __init__(self):
        self.storage = CheckpointStorage()

    async def save_checkpoint_info(self, checkpoint_info: CheckpointInfo) -> bool:
        """保存checkpoint信息到文件"""
        try:
            info_file = self.storage.get_checkpoint_info_file_path(checkpoint_info.checkpoint_id)

            await async_write_json(info_file, checkpoint_info.model_dump(), ensure_ascii=False, indent=2, default=str)

            logger.info(f"保存checkpoint信息成功: {checkpoint_info.checkpoint_id}")
            return True
        except Exception as e:
            logger.error(f"保存checkpoint信息失败: {e}")
            return False

    async def load_checkpoint_info(self, checkpoint_id: str) -> Optional[CheckpointInfo]:
        """从文件加载checkpoint信息"""
        try:
            info_file = self.storage.get_checkpoint_info_file_path(checkpoint_id)

            if not info_file.exists():
                return None

            data = await async_read_json(info_file)

            # 处理datetime字段的反序列化
            if 'created_time' in data and isinstance(data['created_time'], str):
                data['created_time'] = datetime.fromisoformat(data['created_time'].replace('Z', '+00:00'))

            # 处理file_snapshots中的datetime字段
            if 'file_snapshots' in data:
                for snapshot in data['file_snapshots']:
                    if 'modified_time' in snapshot and isinstance(snapshot['modified_time'], str):
                        snapshot['modified_time'] = datetime.fromisoformat(snapshot['modified_time'].replace('Z', '+00:00'))

            return CheckpointInfo(**data)

        except Exception as e:
            logger.error(f"加载checkpoint信息失败: {e}")
            return None

    async def update_checkpoint_manifest(self, checkpoint_id: str) -> bool:
        """更新checkpoint清单"""
        try:
            manifest_file = self.storage.get_checkpoint_manifest_file_path()

            # 加载现有清单或创建新清单
            if manifest_file.exists():
                manifest_data = await async_read_json(manifest_file)

                # 处理datetime字段的反序列化
                if 'created_time' in manifest_data and isinstance(manifest_data['created_time'], str):
                    manifest_data['created_time'] = datetime.fromisoformat(manifest_data['created_time'].replace('Z', '+00:00'))
                if 'updated_time' in manifest_data and isinstance(manifest_data['updated_time'], str):
                    manifest_data['updated_time'] = datetime.fromisoformat(manifest_data['updated_time'].replace('Z', '+00:00'))

                    manifest = CheckpointManifest(**manifest_data)
            else:
                manifest = CheckpointManifest(
                    checkpoints=[],
                    current_checkpoint_id=None,
                    created_time=datetime.now(),
                    updated_time=datetime.now()
                )

            # 添加新的checkpoint
            if checkpoint_id not in manifest.checkpoints:
                manifest.checkpoints.append(checkpoint_id)
                manifest.updated_time = datetime.now()

                # 保存更新后的清单
                await async_write_json(manifest_file, manifest.model_dump(), ensure_ascii=False, indent=2, default=str)

                logger.info(f"更新checkpoint清单成功: {checkpoint_id}")

            return True
        except Exception as e:
            logger.error(f"更新checkpoint清单失败: {e}")
            return False

    async def load_checkpoint_manifest(self) -> Optional[CheckpointManifest]:
        """加载checkpoint清单"""
        try:
            manifest_file = self.storage.get_checkpoint_manifest_file_path()

            if not manifest_file.exists():
                return None

            data = await async_read_json(manifest_file)

            # 处理datetime字段的反序列化
            if 'created_time' in data and isinstance(data['created_time'], str):
                data['created_time'] = datetime.fromisoformat(data['created_time'].replace('Z', '+00:00'))
            if 'updated_time' in data and isinstance(data['updated_time'], str):
                data['updated_time'] = datetime.fromisoformat(data['updated_time'].replace('Z', '+00:00'))

            return CheckpointManifest(**data)

        except Exception as e:
            logger.error(f"加载checkpoint清单失败: {e}")
            return None

    async def remove_from_manifest(self, checkpoint_ids: List[str]) -> bool:
        """从清单中移除指定的checkpoint"""
        try:
            manifest = await self.load_checkpoint_manifest()
            if not manifest:
                return True

            # 移除指定的checkpoint ID
            original_count = len(manifest.checkpoints)
            manifest.checkpoints = [cp_id for cp_id in manifest.checkpoints if cp_id not in checkpoint_ids]

            if len(manifest.checkpoints) != original_count:
                manifest.updated_time = datetime.now()

                # 保存更新后的清单
                manifest_file = self.storage.get_checkpoint_manifest_file_path()
                await async_write_json(manifest_file, manifest.model_dump(), ensure_ascii=False, indent=2, default=str)

                logger.info(f"从清单中移除checkpoint成功: {checkpoint_ids}")

            return True
        except Exception as e:
            logger.error(f"从清单中移除checkpoint失败: {e}")
            return False

    async def update_current_checkpoint(self, checkpoint_id: Optional[str]) -> bool:
        """更新当前checkpoint状态"""
        try:
            manifest = await self.load_checkpoint_manifest()
            if not manifest:
                # 如果没有清单，创建新的
                manifest = CheckpointManifest(
                    checkpoints=[],
                    current_checkpoint_id=checkpoint_id,
                    created_time=datetime.now(),
                    updated_time=datetime.now()
                )
            else:
                # 更新现有清单
                manifest.current_checkpoint_id = checkpoint_id
                manifest.updated_time = datetime.now()

            # 保存更新后的清单
            manifest_file = self.storage.get_checkpoint_manifest_file_path()
            await async_write_json(manifest_file, manifest.model_dump(), ensure_ascii=False, indent=2, default=str)

            logger.info(f"更新当前checkpoint状态: {checkpoint_id}")
            return True
        except Exception as e:
            logger.error(f"更新当前checkpoint状态失败: {e}")
            return False

    async def get_current_checkpoint(self) -> Optional[str]:
        """获取当前checkpoint ID"""
        try:
            manifest = await self.load_checkpoint_manifest()
            return manifest.current_checkpoint_id if manifest else None
        except Exception as e:
            logger.error(f"获取当前checkpoint失败: {e}")
            return None

    async def ensure_initial_checkpoint_created(self) -> bool:
        """确保__INITIAL__checkpoint已创建"""
        try:
            # 检查__INITIAL__是否已存在
            if self.storage.checkpoint_exists(VirtualCheckpoint.INITIAL):
                logger.debug("__INITIAL__checkpoint已存在")
                return True

            # 创建__INITIAL__checkpoint目录
            self.storage.create_checkpoint_directory(VirtualCheckpoint.INITIAL)

            # 创建checkpoint信息
            from datetime import datetime
            from app.core.entity.checkpoint import CheckpointInfo
            checkpoint_info = CheckpointInfo(
                checkpoint_id=VirtualCheckpoint.INITIAL,
                created_time=datetime.now(),
                file_snapshots=[]
            )

            # 保存checkpoint信息
            success = await self.save_checkpoint_info(checkpoint_info)
            if not success:
                logger.error("保存__INITIAL__checkpoint信息失败")
                return False

            logger.info("创建__INITIAL__checkpoint成功")
            return True

        except Exception as e:
            logger.error(f"创建__INITIAL__checkpoint失败: {e}")
            return False

    async def get_previous_checkpoint_in_checkpoint_manifest(self, checkpoint_id: str) -> Optional[str]:
        """在完整checkpoint列表中获取前一个checkpoint

        首先尝试严格查找前一个checkpoint。
        如果目标checkpoint不在列表中，则通过雪花ID比较找到最接近的前一个checkpoint。

        Args:
            checkpoint_id: 目标checkpoint ID

        Returns:
            Optional[str]: 前一个checkpoint ID，如果没有合适的则返回None
        """
        try:
            manifest = await self.load_checkpoint_manifest()
            if not manifest:
                logger.error("无法加载checkpoint清单")
                return None

            try:
                # 首先尝试严格查找
                current_index = manifest.checkpoints.index(checkpoint_id)
                if current_index == 0:
                    # 是第一个checkpoint，前面没有checkpoint
                    logger.info(f"checkpoint {checkpoint_id} 是第一个，前面没有checkpoint")
                    return None
                else:
                    # 返回前一个checkpoint
                    previous_checkpoint = manifest.checkpoints[current_index - 1]
                    logger.info(f"checkpoint {checkpoint_id} 的前一个是: {previous_checkpoint}")
                    return previous_checkpoint

            except ValueError:
                # checkpoint不在列表中，查找最接近的前一个checkpoint
                return self._find_closest_previous_checkpoint(manifest, checkpoint_id)

        except Exception as e:
            logger.error(f"获取前一个checkpoint失败: {e}")
            return None

    def _find_closest_previous_checkpoint(self, manifest, checkpoint_id: str) -> Optional[str]:
        """查找最接近的前一个checkpoint

        Args:
            manifest: checkpoint清单对象
            checkpoint_id: 目标checkpoint ID

        Returns:
            Optional[str]: 最接近的前一个checkpoint ID，如果没有则返回None
        """
        logger.info(f"checkpoint {checkpoint_id} 不在列表中，查找最接近的前一个checkpoint")

        from app.core.entity.checkpoint import VirtualCheckpoint

        target_id = int(checkpoint_id)
        smaller_checkpoints = []

        for cp_id in manifest.checkpoints:
            if cp_id == VirtualCheckpoint.INITIAL:
                smaller_checkpoints.append(cp_id)
            elif cp_id.isdigit() and int(cp_id) < target_id:
                smaller_checkpoints.append(cp_id)

        if smaller_checkpoints:
            # 直接取最后一个，就是最接近target的checkpoint
            result = smaller_checkpoints[-1]
            logger.info(f"找到最接近的前一个checkpoint: {result}")
            return result
        else:
            logger.info(f"没有找到小于 {checkpoint_id} 的checkpoint")
            return None

    async def get_checkpoints_between_in_checkpoint_manifest(self, current_checkpoint_id: Optional[str], target_checkpoint_id: Optional[str]) -> tuple:
        """在完整checkpoint列表中获取两个checkpoint之间的范围

        Args:
            current_checkpoint_id: 当前checkpoint ID
            target_checkpoint_id: 目标checkpoint ID

        Returns:
            tuple[str, List[str]]: (方向, 需要处理的checkpoint列表)
            方向: "forward" 或 "backward" 或 "none"
        """
        try:
            manifest = await self.load_checkpoint_manifest()
            if not manifest:
                from app.core.exceptions import RollbackException, ErrorCode
                raise RollbackException(ErrorCode.CHECKPOINT_NOT_FOUND, "无法加载checkpoint清单")

            if current_checkpoint_id is None or target_checkpoint_id is None:
                raise ValueError("checkpoint_id不能为None")

            current_index = manifest.checkpoints.index(current_checkpoint_id)
            target_index = manifest.checkpoints.index(target_checkpoint_id)

            if target_index < current_index:
                # 反向回滚
                checkpoints_range = manifest.checkpoints[target_index + 1:current_index + 1]
                return "backward", checkpoints_range
            elif target_index > current_index:
                # 正向回滚
                checkpoints_range = manifest.checkpoints[current_index + 1:target_index + 1]
                return "forward", checkpoints_range
            else:
                # 相同位置，无需操作
                return "none", []

        except ValueError as e:
            logger.error(f"checkpoint参数错误: {e}")
            raise
        except Exception as e:
            logger.error(f"获取checkpoint范围失败: {e}")
            from app.core.exceptions import RollbackException, ErrorCode
            raise RollbackException(ErrorCode.CHECKPOINT_NOT_FOUND, f"无法确定回滚范围: {str(e)}")
