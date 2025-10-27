<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\DTO;

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

    // ASR 内容和笔记（用于生成标题）
    public ?string $asrStreamContent = null; // ASR 流式识别内容

    public ?string $noteContent = null; // 笔记内容

    public ?string $noteFileType = null; // 笔记文件类型（md、txt、json）

    public ?string $language = null; // 语种（zh_CN、en_US等），用于生成标题时使用

    public function __construct(array $data = [])
    {
        $this->taskKey = $data['task_key'] ?? $data['taskKey'] ?? '';
        $this->userId = $data['user_id'] ?? $data['userId'] ?? '';
        $this->organizationCode = $data['organization_code'] ?? $data['organizationCode'] ?? null;

        $this->status = AsrTaskStatusEnum::fromString($data['status'] ?? 'failed');
        $this->filePath = $data['file_path'] ?? $data['filePath'] ?? $data['file_name'] ?? $data['fileName'] ?? null;
        $this->audioFileId = $data['audio_file_id'] ?? $data['audioFileId'] ?? null;
        $this->noteFileName = $data['note_file_name'] ?? $data['noteFileName'] ?? null;
        $this->noteFileId = $data['note_file_id'] ?? $data['noteFileId'] ?? null;

        // 项目和话题信息
        $this->projectId = $data['project_id'] ?? $data['projectId'] ?? null;
        $this->topicId = $data['topic_id'] ?? $data['topicId'] ?? null;

        // 录音目录信息（自动清洗为相对路径）
        $this->tempHiddenDirectory = self::extractRelativePath($data['temp_hidden_directory'] ?? $data['tempHiddenDirectory'] ?? null);
        $this->displayDirectory = self::extractRelativePath($data['display_directory'] ?? $data['displayDirectory'] ?? null);
        $this->tempHiddenDirectoryId = isset($data['temp_hidden_directory_id']) ? (int) $data['temp_hidden_directory_id'] : (isset($data['tempHiddenDirectoryId']) ? (int) $data['tempHiddenDirectoryId'] : null);
        $this->displayDirectoryId = isset($data['display_directory_id']) ? (int) $data['display_directory_id'] : (isset($data['displayDirectoryId']) ? (int) $data['displayDirectoryId'] : null);

        // 录音状态管理字段
        $this->modelId = $data['model_id'] ?? $data['modelId'] ?? null;
        $this->recordingStatus = $data['recording_status'] ?? $data['recordingStatus'] ?? null;
        $this->sandboxTaskCreated = ($data['sandbox_task_created'] ?? $data['sandboxTaskCreated'] ?? false) === true || ($data['sandbox_task_created'] ?? $data['sandboxTaskCreated'] ?? '0') === '1';
        $this->isPaused = ($data['is_paused'] ?? $data['isPaused'] ?? false) === true || ($data['is_paused'] ?? $data['isPaused'] ?? '0') === '1';
        $this->sandboxId = $data['sandbox_id'] ?? $data['sandboxId'] ?? null;

        // ASR 内容和笔记
        $this->asrStreamContent = $data['asr_stream_content'] ?? $data['asrStreamContent'] ?? null;
        $this->noteContent = $data['note_content'] ?? $data['noteContent'] ?? null;
        $this->noteFileType = $data['note_file_type'] ?? $data['noteFileType'] ?? null;
        $this->language = $data['language'] ?? null;
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
            'asr_stream_content' => $this->asrStreamContent,
            'note_content' => $this->noteContent,
            'note_file_type' => $this->noteFileType,
            'language' => $this->language,
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
     * 检查任务是否已提交（基于状态判断）.
     */
    public function isTaskSubmitted(): bool
    {
        return $this->status->isTaskSubmitted();
    }

    /**
     * 更新状态
     */
    public function updateStatus(AsrTaskStatusEnum $status): void
    {
        $this->status = $status;
    }

    /**
     * 检查是否有笔记文件.
     */
    public function hasNoteFile(): bool
    {
        return ! empty($this->noteFileName);
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
}
