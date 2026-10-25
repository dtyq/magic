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
from app.core.entity.checkpoint import (
    CheckpointActivity,
    CheckpointInfo,
    CheckpointManifest,
    VirtualCheckpoint,
)
from app.infrastructure.checkpoint.storage import KNOWN_SPACES, CheckpointStorage
from app.utils.async_file_utils import async_write_json, async_read_json
from agentlang.logger import get_logger

logger = get_logger(__name__)


class CheckpointMetadataManager:
    """Checkpoint元数据管理器

    簿记与流水分属两方：
    - checkpoint_info.json（<id>/ 根）由 Python 写：仅 {checkpoint_id,
      created_time}，创建时一次写入、之后只读。
    - <space>/operations.json 由 magicfs 写：append-only 操作流水，
      Python 只读。

    load_checkpoint_info 把两者聚合成内存中的 CheckpointInfo 返回，
    对外接口形态不变。
    """

    def __init__(self):
        self.storage = CheckpointStorage()

    async def save_checkpoint_info(self, checkpoint_info: CheckpointInfo) -> bool:
        """保存checkpoint簿记信息到文件

        只持久化 {checkpoint_id, created_time}；file_snapshots 属于
        magicfs 的 operations.json，不由本方法写。
        """
        try:
            info_file = self.storage.get_checkpoint_info_file_path(checkpoint_info.checkpoint_id)

            bookkeeping = {
                "checkpoint_id": checkpoint_info.checkpoint_id,
                "created_time": checkpoint_info.created_time,
            }

            await async_write_json(info_file, bookkeeping, ensure_ascii=False, indent=2, default=str)

            logger.info(f"保存checkpoint簿记成功: {checkpoint_info.checkpoint_id}")
            return True
        except Exception as e:
            logger.error(f"保存checkpoint簿记失败: {e}")
            return False

    async def _load_space_operations(self, checkpoint_id: str) -> list:
        """聚合各空间分区 operations.json 的 file_snapshots"""
        merged: list = []
        for space in KNOWN_SPACES:
            ops_file = self.storage.get_space_operations_file_path(checkpoint_id, space)
            if not ops_file.exists():
                continue
            try:
                data = await async_read_json(ops_file)
            except Exception as e:
                logger.warning(f"读取空间操作流水失败，跳过该空间: {ops_file}: {e}")
                continue
            for snapshot in data.get("file_snapshots") or []:
                if 'modified_time' in snapshot and isinstance(snapshot['modified_time'], str):
                    snapshot['modified_time'] = datetime.fromisoformat(
                        snapshot['modified_time'].replace('Z', '+00:00'))
                merged.append(snapshot)
        return merged

    async def load_checkpoint_info(self, checkpoint_id: str) -> Optional[CheckpointInfo]:
        """从文件加载checkpoint信息（簿记 + 各空间流水聚合）"""
        try:
            info_file = self.storage.get_checkpoint_info_file_path(checkpoint_id)

            if not info_file.exists():
                return None

            data = await async_read_json(info_file)

            # 处理datetime字段的反序列化
            if 'created_time' in data and isinstance(data['created_time'], str):
                data['created_time'] = datetime.fromisoformat(data['created_time'].replace('Z', '+00:00'))

            data["file_snapshots"] = await self._load_space_operations(checkpoint_id)

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

            # 添加新的checkpoint。新 checkpoint 成为当前记账目标意味着
            # 回到正常记录状态：清掉 restore/rollback 等活动标记，agfs 侧
            # hook 从此刻起恢复对文件变更的增量记账。
            if checkpoint_id not in manifest.checkpoints:
                manifest.checkpoints.append(checkpoint_id)
                manifest.activity = CheckpointActivity.IDLE
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

    async def set_activity(self, activity: CheckpointActivity) -> bool:
        """标记 checkpoint 系统当前的活动状态

        任何非 idle 活动期间，agfs 侧 checkpoint hook 会跳过记账：此时
        的文件变更来自 checkpoint 系统自身（回滚重放、会话数据恢复），
        而不是用户编辑，记进快照会把恢复内容误当作新改动回灌。

        该方法把状态写回 checkpoint_manifest.json，由 agfs 侧每次变更
        时读取感知。

        Args:
            activity: 目标活动状态（idle / rollback / restore）

        Returns:
            bool: 是否成功写入
        """
        try:
            manifest = await self.load_checkpoint_manifest()
            if not manifest:
                logger.warning(
                    f"checkpoint清单不存在，跳过设置 activity={activity.value}"
                )
                return False

            if manifest.activity == activity:
                return True

            manifest.activity = activity
            manifest.updated_time = datetime.now()

            manifest_file = self.storage.get_checkpoint_manifest_file_path()
            await async_write_json(
                manifest_file, manifest.model_dump(), ensure_ascii=False, indent=2, default=str
            )

            logger.info(f"设置 checkpoint activity={activity.value}")
            return True
        except Exception as e:
            logger.error(f"设置 checkpoint activity 失败: {e}")
            return False

    async def ensure_initial_checkpoint_created(self) -> bool:
        """确保__INITIAL__checkpoint已创建"""
        try:
            # 检查__INITIAL__是否已存在
            if await self.storage.checkpoint_exists(VirtualCheckpoint.INITIAL):
                logger.debug("__INITIAL__checkpoint已存在")
                return True

            # 创建__INITIAL__checkpoint目录
            await self.storage.create_checkpoint_directory(VirtualCheckpoint.INITIAL)

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
