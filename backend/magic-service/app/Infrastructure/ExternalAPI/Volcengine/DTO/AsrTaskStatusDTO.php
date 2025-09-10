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

    // 类似：/asr/recordings/2025_09_10/usi_1111/38
    public string $businessDirectory = ''; // 小段音频的业务目录，与task_key绑定

    // 类似：DT001/588417216353927169/asr/recordings/2025_09_10/usi_1111/38/
    public string $stsFullDirectory = ''; // 小段音频的STS完整目录，用于前端上传

    // 类似：project_821749697183776769/workspace/录音总结_20250910_174251/原始录音文件.webm
    public ?string $filePath = null; // 工作区文件路径

    // 类似：project_821749697183776769/workspace/录音总结_20250910_174251
    public ?string $workspaceRelativeDir = null; // 工作区相对目录，确保音频和note文件在同一目录

    // note 文件是否存在
    public bool $hasNoteFile = false; // 标记是否存在note文件

    public AsrTaskStatusEnum $status = AsrTaskStatusEnum::FAILED;

    public ?string $mergedAudioFileKey = null; // 合并后的音频文件key，用于复用

    public ?string $workspaceFileKey = null; // 外部传入的工作区文件key

    public ?string $workspaceFileUrl = null; // 生成的工作区文件下载URL

    public function __construct(array $data = [])
    {
        $this->taskKey = $data['task_key'] ?? $data['taskKey'] ?? '';
        $this->userId = $data['user_id'] ?? $data['userId'] ?? '';
        $this->businessDirectory = $data['business_directory'] ?? $data['businessDirectory'] ?? '';
        $this->stsFullDirectory = $data['sts_full_directory'] ?? $data['stsFullDirectory'] ?? '';

        $this->status = AsrTaskStatusEnum::fromString($data['status'] ?? 'failed');
        $this->mergedAudioFileKey = $data['merged_audio_file_key'] ?? $data['mergedAudioFileKey'] ?? null;
        $this->workspaceFileKey = $data['workspace_file_key'] ?? $data['workspaceFileKey'] ?? null;
        $this->workspaceFileUrl = $data['workspace_file_url'] ?? $data['workspaceFileUrl'] ?? null;
        $this->filePath = $data['file_path'] ?? $data['filePath'] ?? $data['file_name'] ?? $data['fileName'] ?? null;
        $this->workspaceRelativeDir = $data['workspace_relative_dir'] ?? $data['workspaceRelativeDir'] ?? null;
        $this->hasNoteFile = (bool) ($data['has_note_file'] ?? $data['hasNoteFile'] ?? false);
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
     * @return array<string, null|bool|string>
     */
    public function toArray(): array
    {
        return [
            'task_key' => $this->taskKey,
            'user_id' => $this->userId,
            'business_directory' => $this->businessDirectory, // 业务目录，与task_key绑定
            'sts_full_directory' => $this->stsFullDirectory, // STS完整目录，用于前端上传
            'status' => $this->status->value,
            'merged_audio_file_key' => $this->mergedAudioFileKey,
            'workspace_file_key' => $this->workspaceFileKey,
            'workspace_file_url' => $this->workspaceFileUrl,
            'file_path' => $this->filePath,
            'workspace_relative_dir' => $this->workspaceRelativeDir,
            'has_note_file' => $this->hasNoteFile,
        ];
    }

    /**
     * 检查是否为空（不存在）.
     */
    public function isEmpty(): bool
    {
        return empty($this->taskKey) && empty($this->userId) && empty($this->businessDirectory);
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
}
