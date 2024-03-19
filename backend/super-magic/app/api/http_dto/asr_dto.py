"""
ASR 音频合并 HTTP DTO

定义ASR音频合并相关的请求和响应数据模型
"""

from typing import Optional
from pydantic import BaseModel, Field


class CreateAsrTaskRequest(BaseModel):
    """创建ASR合并任务请求"""
    task_key: str = Field(..., description="任务键，唯一标识一次录音任务")
    source_dir: str = Field(..., description="音频分片所在目录（相对于 workspace_dir 的路径）")
    workspace_dir: Optional[str] = Field(
        default=".workspace",
        description="工作区根目录（相对于项目根目录）。默认为 .workspace，可指定为 . 表示项目根目录，或其他自定义路径"
    )
    note_file: Optional["AsrNoteFileConfig"] = Field(
        None,
        description="笔记文件配置（可选）。start 阶段只需传递 source_path，用于告知沙箱笔记文件位置"
    )
    transcript_file: Optional["AsrTranscriptFileConfig"] = Field(
        None,
        description="流式识别文件配置（可选）。start 阶段只需传递 source_path，用于告知沙箱流式识别文件位置"
    )

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "task_key": "meeting_20250124_001",
                    "source_dir": ".asr_recordings/meeting_20250124_001"
                },
                {
                    "task_key": "external_task_001",
                    "source_dir": "task_1761304258562_vqxukp3c0",
                    "workspace_dir": "."
                },
                {
                    "task_key": "task_with_files_001",
                    "source_dir": ".asr_recordings/session_xxx",
                    "workspace_dir": ".workspace",
                    "note_file": {
                        "source_path": "录音总结_20251028_170451/笔记.md"
                    },
                    "transcript_file": {
                        "source_path": ".asr_recordings/session_xxx/流式识别.md"
                    }
                }
            ]
        }


class AsrAudioConfig(BaseModel):
    """音频合并配置"""
    source_dir: str = Field(..., description="音频分片源目录（相对于 workspace_dir）")
    target_dir: str = Field(..., description="音频输出目标目录（相对于 workspace_dir）")
    output_filename: str = Field(..., description="输出文件名（不含扩展名），通常为智能标题")
    file_shard_count: Optional[int] = Field(
        default=None,
        description="客户端已上传分片总数（可选）。不传时服务端会按 scan 口径扫描目录计算"
    )


class AsrNoteFileConfig(BaseModel):
    """笔记文件配置"""
    source_path: str = Field(..., description="笔记文件源路径（相对于 workspace_dir）")
    target_path: Optional[str] = Field(None, description="笔记文件目标路径（相对于 workspace_dir），已包含智能标题（start 阶段可选）")
    action: Optional[str] = Field(None, description="操作类型，如 rename_and_move（start 阶段可选）")


class AsrTranscriptFileConfig(BaseModel):
    """流式识别文件配置"""
    source_path: str = Field(..., description="流式识别文件源路径（相对于 workspace_dir）")
    action: Optional[str] = Field(None, description="操作类型，如 delete（start 阶段可选）")


class FinalizeAsrTaskRequest(BaseModel):
    """完成ASR合并任务请求"""
    task_key: str = Field(..., description="任务键，唯一标识一次录音任务")
    workspace_dir: str = Field(
        default=".workspace",
        description="工作区根目录（相对于项目根目录）。默认为 .workspace"
    )
    audio: AsrAudioConfig = Field(..., description="音频合并配置对象")
    note_file: Optional[AsrNoteFileConfig] = Field(
        None,
        description="笔记文件配置对象（可选）"
    )
    transcript_file: Optional[AsrTranscriptFileConfig] = Field(
        None,
        description="流式识别文件配置对象（可选）"
    )

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "task_key": "session_1761577788629_sz89nf9t1",
                    "workspace_dir": ".workspace",
                    "audio": {
                        "source_dir": ".asr_recordings/task_2",
                        "target_dir": "录音总结_20251027_230949",
                        "output_filename": "被讨厌的勇气"
                    },
                    "note_file": {
                        "source_path": "录音总结_20251027_230949/笔记.md",
                        "target_path": "录音总结_20251027_230949/被讨厌的勇气-笔记.md",
                        "action": "rename_and_move"
                    },
                    "transcript_file": {
                        "source_path": ".asr_recordings/task_2/流式识别.md",
                        "action": "delete"
                    }
                },
                {
                    "task_key": "meeting_20250124_001",
                    "workspace_dir": ".workspace",
                    "audio": {
                        "source_dir": ".asr_recordings/meeting_001",
                        "target_dir": "录音总结_20250124_143022",
                        "output_filename": "会议录音"
                    }
                }
            ]
        }


class FileDetail(BaseModel):
    """文件详情模型"""
    filename: str = Field(..., description="文件名")
    path: str = Field(..., description="相对于工作区的路径")
    size: int = Field(..., description="文件大小（字节）")
    duration: Optional[float] = Field(None, description="音频时长（秒），仅音频文件有此字段")
    action_performed: Optional[str] = Field(None, description="执行的操作，如 merged_and_created、renamed_and_moved")
    source_path: Optional[str] = Field(None, description="源文件路径（如果有重命名操作）")


class DeletedFile(BaseModel):
    """被删除的文件信息"""
    path: str = Field(..., description="被删除的文件路径")
    action_performed: str = Field(default="deleted", description="执行的操作，固定为 deleted")


class OperationsResult(BaseModel):
    """操作结果汇总"""
    audio_merge: str = Field(..., description="音频合并结果：success 或 failed")
    note_process: Optional[str] = Field(None, description="笔记处理结果：success 或 failed")
    transcript_cleanup: Optional[str] = Field(None, description="流式识别清理结果：success 或 failed")


class FilesDetail(BaseModel):
    """完成任务后的文件详情"""
    audio_file: FileDetail = Field(..., description="音频文件详情")
    note_file: Optional[FileDetail] = Field(None, description="笔记文件详情（如果有）")


class AsrTaskResponse(BaseModel):
    """ASR任务响应数据模型"""
    status: str = Field(..., description="任务状态：waiting | running | finalizing | completed | error（推荐使用completed，finished已废弃但仍兼容）")
    task_key: str = Field(..., description="任务唯一标识")
    intelligent_title: Optional[str] = Field(None, description="智能标题（仅在 finalizing 状态返回）")
    error_message: Optional[str] = Field(default=None, description="错误信息，仅在 status=error 时有值")
    files: Optional[FilesDetail] = Field(None, description="文件详情，仅在 status=completed 时有值")
    deleted_files: Optional[list[DeletedFile]] = Field(None, description="被删除的文件列表")
    operations: Optional[OperationsResult] = Field(None, description="操作结果汇总")

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "status": "completed",
                    "task_key": "session_1761577788629_sz89nf9t1",
                    "intelligent_title": None,
                    "error_message": None,
                    "files": {
                        "audio_file": {
                            "filename": "被讨厌的勇气.wav",
                            "path": "录音总结_20251027_230949/被讨厌的勇气.wav",
                            "size": 1024000,
                            "duration": 120.5,
                            "action_performed": "merged_and_created",
                            "source_path": None
                        },
                        "note_file": {
                            "filename": "被讨厌的勇气-笔记.md",
                            "path": "录音总结_20251027_230949/被讨厌的勇气-笔记.md",
                            "size": 2048,
                            "duration": None,
                            "action_performed": "renamed_and_moved",
                            "source_path": "录音总结_20251027_230949/笔记.md"
                        }
                    },
                    "deleted_files": [
                        {
                            "path": ".asr_recordings/task_2/流式识别.md",
                            "action_performed": "deleted"
                        }
                    ],
                    "operations": {
                        "audio_merge": "success",
                        "note_process": "success",
                        "transcript_cleanup": "success"
                    }
                },
                {
                    "status": "finalizing",
                    "task_key": "session_xxx",
                    "intelligent_title": "被讨厌的勇气笔记",
                    "error_message": None,
                    "files": None,
                    "deleted_files": None,
                    "operations": None
                }
            ]
        }


class CancelAsrTaskRequest(BaseModel):
    """取消ASR任务请求"""
    task_key: str = Field(..., description="任务键，唯一标识一次录音任务")
    workspace_dir: str = Field(
        default=".workspace",
        description="工作区根目录（相对于项目根目录）。默认为 .workspace"
    )

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "task_key": "session_1761723328838_5trognry8",
                    "workspace_dir": ".workspace"
                }
            ]
        }


class QueryAsrTaskRequest(BaseModel):
    """查询ASR任务状态请求"""
    task_key: str = Field(..., description="任务键，唯一标识一次录音任务")
    workspace_dir: str = Field(
        default=".workspace",
        description="工作区根目录（相对于项目根目录）。默认为 .workspace"
    )

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "task_key": "session_1761577788629_sz89nf9t1",
                    "workspace_dir": ".workspace"
                }
            ]
        }




# 保留旧的别名以兼容现有代码
AsrMergeStatusData = AsrTaskResponse
