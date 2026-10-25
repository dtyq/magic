# -*- coding: utf-8 -*-
"""
Checkpoint相关的数据模型定义

这个模块定义了checkpoint功能所需的所有数据模型，包括：
- FileOperation: 文件操作类型枚举
- FileSnapshot: 文件快照信息
- CheckpointInfo: checkpoint元数据
- CheckpointManifest: checkpoint清单
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from pathlib import Path
from pydantic import BaseModel, Field


class VirtualCheckpoint:
    """Checkpoint常量定义"""
    INITIAL = "__INITIAL__"  # 初始状态


# magicfs 分区布局中的项目工作区空间标识（用户文件，元数据服务 + S3
# 后端）。变更进入用户可见的变更附件列表，创建文件版本，回滚时严格
# 重放。space 字段为空的旧格式条目也按本空间解析。
PROJECT_SPACE = "project"

# magicfs 分区布局中的用户个人空间标识（用户文件，元数据服务 + S3
# 后端）。变更创建文件版本、回滚时严格重放，但不进入用户可见的变更
# 附件列表（附件变更仅展示项目空间）。
USER_SPACE = "user"

# magicfs 分区布局中的话题空间标识（Agent 内部状态）：随 checkpoint
# 尽力而为重放，不进入用户可见的文件变更列表与文件版本链路。
TOPIC_SPACE = "topic"

# localfs 分区布局中的聊天历史空间标识。运行期 .chat_history 是指向
# <AGFS FUSE 挂载根>/localfs/chat_history 的 symlink（localfs 插件挂载，
# 无元数据/S3 依赖；挂载根由网关决定，见 app/utils/agfs_mount_path.py），
# 每次变更由 localfs 的 checkpoint hook 以 per-file 帧形式记入
# <checkpoint_id>/chat_history/ 分区；回滚执行器按该空间重放。
CHAT_HISTORY_SPACE = "chat_history"

# ── 空间注册表（单一事实来源）─────────────────────────────────────
#
# 新增一个需要回滚的空间 = 在下面元组里登记一行 + agfs/gateway 侧挂载
# 该空间（checkpoint hook 自动按 space_type 分区记账），回滚执行器零
# 改动。各元组的策略差异：
#
# - WORKSPACE_SPACES（工作区空间）：随 checkpoint 严格重放（任何一条
#   失败即中止整体回滚），并进入文件版本创建链路（collect_affected
#   构建受影响文件）。
# - CHANGE_ATTACHMENT_SPACES（变更附件空间）：变更以附件形式进入用户
#   可见的变更附件列表。附件与文件版本是两条独立策略：附件仅展示
#   项目空间，文件版本覆盖全部工作区空间。
# - INTERNAL_SPACES（Agent 内部状态空间）：随 checkpoint 尽力而为重放
#   （失败仅告警），不进入文件版本与变更附件链路。
WORKSPACE_SPACES = (PROJECT_SPACE, USER_SPACE)
CHANGE_ATTACHMENT_SPACES = (PROJECT_SPACE,)
INTERNAL_SPACES = (TOPIC_SPACE, CHAT_HISTORY_SPACE)


def is_internal_space(space: str) -> bool:
    """判断空间是否为 Agent 内部状态空间（topic / chat_history 及未来新增）。"""
    return space in INTERNAL_SPACES


def is_change_attachment_space(space: str) -> bool:
    """判断空间条目是否进入用户可见的变更附件列表。

    旧格式条目（space 为空）按项目空间解析。
    """
    return (space or PROJECT_SPACE) in CHANGE_ATTACHMENT_SPACES


def is_file_version_space(space: str) -> bool:
    """判断空间条目是否创建文件版本（工作区空间，旧格式空 space 按项目空间解析）。"""
    return (space or PROJECT_SPACE) in WORKSPACE_SPACES

class FileOperation(str, Enum):
    """文件操作类型枚举"""
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    RENAMED = "renamed"


class FileType(str, Enum):
    """文件类型枚举"""
    FILE = "file"           # 普通文件
    DIRECTORY = "directory" # 目录


class FileSnapshot(BaseModel):
    """文件快照信息模型

    file_id 是文件的稳定 Snowflake ID，是 on-disk 快照存储的主键
    （file_snapshots/<file_id>/）。与 file_path 不同，file_id 在
    rename 时保持不变，因此同一逻辑文件跨 rename 的所有快照
    共享同一个 snapshot_path 目录。

    file_path 是该条目记录时刻的路径（历史观测值，非主键）。
    对于 operation=renamed 的条目，file_path 是新路径，
    old_file_path 是 rename 前的旧路径；其他操作 old_file_path 为 None。
    """

    file_id: str = Field(..., description="文件稳定 ID（Snowflake），快照存储主键")
    file_path: str = Field(..., description="条目记录时刻的文件路径；新格式为 agent 可见绝对路径")
    old_file_path: Optional[str] = Field(None, description="rename 前的旧路径（仅 operation=renamed 时有值）")
    modified_time: datetime = Field(..., description="文件修改时间")
    operation: FileOperation = Field(..., description="文件操作类型")
    file_type: FileType = Field(..., description="文件类型（文件或目录）")
    snapshot_path: Optional[str] = Field(None, description="快照文件路径（删除操作时为None）")
    space: str = Field("", description="记录该条目的挂载空间类型（project/topic）；空为旧格式条目，视为工作区")

    @staticmethod
    def detect_file_type(file_path: str) -> "FileType":
        """检测文件类型

        Args:
            file_path: 文件路径

        Returns:
            FileType: 文件类型
        """
        path = Path(file_path)
        if path.exists():
            return FileType.DIRECTORY if path.is_dir() else FileType.FILE
        else:
            # 文件不存在时，根据路径特征判断
            # 如果路径没有扩展名，认为是目录
            return FileType.DIRECTORY if not path.suffix else FileType.FILE

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CheckpointInfo(BaseModel):
    """Checkpoint信息模型"""

    checkpoint_id: str = Field(..., description="Checkpoint ID (通常是message_id)")
    created_time: datetime = Field(..., description="创建时间")
    file_snapshots: List[FileSnapshot] = Field(default_factory=list, description="文件快照列表")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CheckpointActivity(str, Enum):
    """checkpoint 系统当前的活动状态（写入 checkpoint_manifest.json）。

    任何非 idle 活动期间，agfs 侧的 checkpoint hook 都会跳过记账：
    此时的文件变更来自 checkpoint 系统自身（回滚重放、会话数据恢复），
    而不是用户编辑，记进快照会污染 checkpoint 历史。
    """

    IDLE = "idle"            # 正常状态：文件变更按用户编辑记账
    ROLLBACK = "rollback"    # 正在按 operations 流水重放历史状态
    RESTORE = "restore"      # 正在从远端归档恢复会话数据（如聊天历史 zip）


class CheckpointManifest(BaseModel):
    """Checkpoint清单模型"""

    checkpoints: List[str] = Field(default_factory=list, description="checkpoint ID列表（按时间顺序）")
    current_checkpoint_id: Optional[str] = Field(None, description="当前所处的checkpoint ID")
    activity: CheckpointActivity = Field(
        CheckpointActivity.IDLE,
        description=(
            "checkpoint 系统当前在做什么。非 idle 期间 agfs 侧 hook 跳过记账："
            "rollback 表示正在按流水重放历史状态（Python 会直接改写挂载内文件，"
            "此时把恢复内容当成新用户改动回灌进 checkpoint 会污染快照）；"
            "restore 表示正在从远端归档恢复会话数据。创建新 checkpoint 时应回到 idle"
        ),
    )
    created_time: datetime = Field(..., description="创建时间")
    updated_time: datetime = Field(..., description="更新时间")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
