<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\DTO;

use App\Application\Speech\Enum\AsrRecordingStatusEnum;
use App\Application\Speech\Enum\AsrTaskStatusEnum;

/**
 * ASR任务状态DTO - 管理Redis Hash字段映射.
 * 这不是从 JSON 响应结构来的，而是用于管理任务状态
 */
class AsrTaskStatusDTO
{
    public string $taskKey = '';

    public string $userId = '';

    public ?string $organizationCode = null; // 组织编码（用于自动总结）

    // 类似：project_821749697183776769/workspace/录音总结_20250910_174251/原始录音文件.webm
    public ?string $filePath = null; // 工作区文件路径

    // 文件ID（数据库中的实际ID）
    public ?string $audioFileId = null; // 音频文件ID（写入magic_super_agent_task_files表后返回的ID）

    // note 文件信息
    public ?string $noteFileName = null; // note文件名（与音频文件在同一目录，为空表示无笔记文件）

    public ?string $noteFileId = null; // note文件ID（用于聊天消息中的文件引用）

    // 预设文件信息（用于前端写入）
    public ?string $presetNoteFileId = null; // 预设笔记文件ID

    public ?string $presetTranscriptFileId = null; // 预设流式识别文件ID

    public ?string $presetNoteFilePath = null; // 预设笔记文件相对路径

    public ?string $presetTranscriptFilePath = null; // 预设流式识别文件相对路径

    // 项目和话题信息
    public ?string $projectId = null; // 项目ID

    public ?string $topicId = null; // 话题ID

    // 录音目录信息
    public ?string $tempHiddenDirectory = null; // 隐藏目录路径（存放分片文件）

    public ?string $displayDirectory = null; // 显示目录路径（存放流式文本和笔记）

    public ?int $tempHiddenDirectoryId = null; // 隐藏目录的文件ID

    public ?int $displayDirectoryId = null; // 显示目录的文件ID

    public AsrTaskStatusEnum $status = AsrTaskStatusEnum::FAILED;

    // 录音状态管理字段
    public ?string $modelId = null; // AI 模型ID，用于自动总结

    public ?string $recordingStatus = null; // 录音状态：start|recording|paused|stopped

    public bool $sandboxTaskCreated = false; // 沙箱任务是否已创建

    public bool $isPaused = false; // 是否处于暂停状态（用于超时判断）

    public ?string $sandboxId = null; // 沙箱ID

    public int $sandboxRetryCount = 0; // 沙箱启动重试次数

    public int $serverSummaryRetryCount = 0; // 服务端总结触发重试次数

    public bool $serverSummaryLocked = false; // 服务端总结是否锁定客户端

    // ASR 内容和笔记（用于生成标题）
    public ?string $asrStreamContent = null; // ASR 流式识别内容

    public ?string $noteContent = null; // 笔记内容

    public ?string $noteFileType = null; // 笔记文件类型（md、txt、json）

    public ?string $language = null; // 语种（zh_CN、en_US等），用于生成标题时使用

    public ?string $uploadGeneratedTitle = null; // upload-tokens 生成的标题（用于 summary 复用）

    public function __construct(array $data = [])
    {
        $this->taskKey = self::getStringValue($data, ['task_key', 'taskKey'], '');
        $this->userId = self::getStringValue($data, ['user_id', 'userId'], '');
        $this->organizationCode = self::getStringValue($data, ['organization_code', 'organizationCode']);

        $this->status = AsrTaskStatusEnum::fromString($data['status'] ?? 'failed');
        $this->filePath = self::getStringValue($data, ['file_path', 'filePath', 'file_name', 'fileName']);
        $this->audioFileId = self::getStringValue($data, ['audio_file_id', 'audioFileId']);
        $this->noteFileName = self::getStringValue($data, ['note_file_name', 'noteFileName']);
        $this->noteFileId = self::getStringValue($data, ['note_file_id', 'noteFileId']);

        // 项目和话题信息
        $this->projectId = self::getStringValue($data, ['project_id', 'projectId']);
        $this->topicId = self::getStringValue($data, ['topic_id', 'topicId']);

        // 录音目录信息（自动清洗为相对路径）
        $this->tempHiddenDirectory = self::extractRelativePath(
            self::getStringValue($data, ['temp_hidden_directory', 'tempHiddenDirectory'])
        );
        $this->displayDirectory = self::extractRelativePath(
            self::getStringValue($data, ['display_directory', 'displayDirectory'])
        );
        $this->tempHiddenDirectoryId = self::getIntValue($data, ['temp_hidden_directory_id', 'tempHiddenDirectoryId']);
        $this->displayDirectoryId = self::getIntValue($data, ['display_directory_id', 'displayDirectoryId']);

        // 录音状态管理字段
        $this->modelId = self::getStringValue($data, ['model_id', 'modelId']);
        $this->recordingStatus = self::getStringValue($data, ['recording_status', 'recordingStatus']);
        $this->sandboxTaskCreated = self::getBoolValue($data, ['sandbox_task_created', 'sandboxTaskCreated']);
        $this->isPaused = self::getBoolValue($data, ['is_paused', 'isPaused']);
        $this->sandboxId = self::getStringValue($data, ['sandbox_id', 'sandboxId']);
        $this->sandboxRetryCount = self::getIntValue($data, ['sandbox_retry_count', 'sandboxRetryCount'], 0);
        $this->serverSummaryRetryCount = self::getIntValue($data, ['server_summary_retry_count', 'serverSummaryRetryCount'], 0);
        $this->serverSummaryLocked = self::getBoolValue($data, ['server_summary_locked', 'serverSummaryLocked']);

        // 预设文件信息
        $this->presetNoteFileId = self::getStringValue($data, ['preset_note_file_id', 'presetNoteFileId']);
        $this->presetTranscriptFileId = self::getStringValue($data, ['preset_transcript_file_id', 'presetTranscriptFileId']);
        $this->presetNoteFilePath = self::getStringValue($data, ['preset_note_file_path', 'presetNoteFilePath']);
        $this->presetTranscriptFilePath = self::getStringValue($data, ['preset_transcript_file_path', 'presetTranscriptFilePath']);

        // ASR 内容和笔记
        $this->asrStreamContent = self::getStringValue($data, ['asr_stream_content', 'asrStreamContent']);
        $this->noteContent = self::getStringValue($data, ['note_content', 'noteContent']);
        $this->noteFileType = self::getStringValue($data, ['note_file_type', 'noteFileType']);
        $this->language = $data['language'] ?? null;
        $this->uploadGeneratedTitle = self::getStringValue($data, ['upload_generated_title', 'uploadGeneratedTitle']);
    }

    /**
     * 从数组创建DTO对象
     */
    public static function fromArray(array $data): self
    {
        return new self($data);
    }

    /**
     * 转换为数组（用于存储到Redis）.
     *
     * @return array<string, null|bool|int|string>
     */
    public function toArray(): array
    {
        return [
            'task_key' => $this->taskKey,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'status' => $this->status->value,
            'file_path' => $this->filePath,
            'audio_file_id' => $this->audioFileId,
            'note_file_name' => $this->noteFileName,
            'note_file_id' => $this->noteFileId,
            'project_id' => $this->projectId,
            'topic_id' => $this->topicId,
            'temp_hidden_directory' => $this->tempHiddenDirectory,
            'display_directory' => $this->displayDirectory,
            'temp_hidden_directory_id' => $this->tempHiddenDirectoryId,
            'display_directory_id' => $this->displayDirectoryId,
            'model_id' => $this->modelId,
            'recording_status' => $this->recordingStatus,
            'sandbox_task_created' => $this->sandboxTaskCreated,
            'is_paused' => $this->isPaused,
            'sandbox_id' => $this->sandboxId,
            'sandbox_retry_count' => $this->sandboxRetryCount,
            'server_summary_retry_count' => $this->serverSummaryRetryCount,
            'server_summary_locked' => $this->serverSummaryLocked,
            'preset_note_file_id' => $this->presetNoteFileId,
            'preset_transcript_file_id' => $this->presetTranscriptFileId,
            'preset_note_file_path' => $this->presetNoteFilePath,
            'preset_transcript_file_path' => $this->presetTranscriptFilePath,
            'asr_stream_content' => $this->asrStreamContent,
            'note_content' => $this->noteContent,
            'note_file_type' => $this->noteFileType,
            'language' => $this->language,
            'upload_generated_title' => $this->uploadGeneratedTitle,
        ];
    }

    /**
     * 检查是否为空（不存在）.
     */
    public function isEmpty(): bool
    {
        return empty($this->taskKey) && empty($this->userId);
    }

    /**
     * 更新状态
     */
    public function updateStatus(AsrTaskStatusEnum $status): void
    {
        $this->status = $status;
    }

    /**
     * 检查总结是否已完成（幂等性判断）.
     * 判断标准：音频文件已合并（audioFileId 存在）且录音已停止.
     */
    public function isSummaryCompleted(): bool
    {
        return ! empty($this->audioFileId)
            && $this->recordingStatus === AsrRecordingStatusEnum::STOPPED->value
            && $this->status === AsrTaskStatusEnum::COMPLETED;
    }

    /**
     * 判断服务端总结是否对客户端加锁.
     */
    public function hasServerSummaryLock(): bool
    {
        return $this->serverSummaryLocked && ! $this->isSummaryCompleted();
    }

    /**
     * 记录一次服务端总结尝试.
     */
    public function markServerSummaryAttempt(): void
    {
        ++$this->serverSummaryRetryCount;
        $this->serverSummaryLocked = true;
    }

    /**
     * 在一次服务端总结结束后更新状态.
     */
    public function finishServerSummaryAttempt(bool $success): void
    {
        if ($success) {
            $this->serverSummaryRetryCount = 0;
            $this->serverSummaryLocked = false;
        }
    }

    /**
     * 提取相对于 workspace 的相对路径
     * 如果路径包含 workspace/，提取其后的部分
     * 这样可以自动修正 Redis 中存储的旧格式数据（完整路径）.
     *
     * @param null|string $path 原始路径
     * @return null|string 相对路径
     */
    private static function extractRelativePath(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return $path;
        }

        // 如果路径包含 workspace/，提取 workspace/ 后面的部分
        if (str_contains($path, 'workspace/')) {
            $parts = explode('workspace/', $path, 2);
            return $parts[1] ?? $path;
        }

        return $path;
    }

    /**
     * 从数组中按优先级获取字符串值（支持 snake_case 和 camelCase）.
     *
     * @param array<string, mixed> $data 数据数组
     * @param array<string> $keys 键名列表（按优先级排序）
     * @param null|string $default 默认值
     */
    private static function getStringValue(array $data, array $keys, ?string $default = null): ?string
    {
        foreach ($keys as $key) {
            if (isset($data[$key])) {
                return (string) $data[$key];
            }
        }
        return $default;
    }

    /**
     * 从数组中按优先级获取整数值（支持 snake_case 和 camelCase）.
     *
     * @param array<string, mixed> $data 数据数组
     * @param array<string> $keys 键名列表（按优先级排序）
     * @param null|int $default 默认值
     */
    private static function getIntValue(array $data, array $keys, ?int $default = null): ?int
    {
        foreach ($keys as $key) {
            if (isset($data[$key])) {
                return (int) $data[$key];
            }
        }
        return $default;
    }

    /**
     * 从数组中按优先级获取布尔值（支持多种格式：true/false、1/0、'1'/'0'）.
     *
     * @param array<string, mixed> $data 数据数组
     * @param array<string> $keys 键名列表（按优先级排序）
     */
    private static function getBoolValue(array $data, array $keys): bool
    {
        foreach ($keys as $key) {
            if (! isset($data[$key])) {
                continue;
            }

            $value = $data[$key];

            // 处理布尔类型
            if (is_bool($value)) {
                return $value;
            }

            // 处理字符串 '1' 或 '0'
            if ($value === '1' || $value === 1) {
                return true;
            }

            if ($value === '0' || $value === 0) {
                return false;
            }

            // 其他值按真值判断
            return (bool) $value;
        }

        return false;
    }
}
