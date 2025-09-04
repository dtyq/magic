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

    public string $businessDirectory = ''; // 业务目录，与task_key绑定

    public string $stsFullDirectory = ''; // STS完整目录，用于前端上传

    public AsrTaskStatusEnum $status = AsrTaskStatusEnum::NOT_PROCESSED;

    public bool $taskSubmitted = false;

    public ?string $speechTaskId = null; // 语音识别服务返回的任务ID

    public ?string $mergedAudioFileKey = null; // 合并后的音频文件key，用于复用

    public ?string $workspaceFileKey = null; // 工作区文件key

    public ?string $workspaceFileUrl = null; // 工作区文件URL

    public ?string $summaryContent = null;

    public ?string $createdAt = null;

    public ?string $updatedAt = null;

    public function __construct(array $data = [])
    {
        $this->taskKey = $data['task_key'] ?? $data['taskKey'] ?? '';
        $this->userId = $data['user_id'] ?? $data['userId'] ?? '';
        $this->businessDirectory = $data['business_directory'] ?? $data['businessDirectory'] ?? '';
        $this->stsFullDirectory = $data['sts_full_directory'] ?? $data['stsFullDirectory'] ?? '';

        $this->status = AsrTaskStatusEnum::fromString($data['status'] ?? 'not_processed');
        $this->taskSubmitted = ($data['task_submitted'] ?? $data['taskSubmitted'] ?? 'false') === 'true' || ($data['task_submitted'] ?? $data['taskSubmitted'] ?? false) === true;
        $this->speechTaskId = $data['speech_task_id'] ?? $data['speechTaskId'] ?? null;
        $this->mergedAudioFileKey = $data['merged_audio_file_key'] ?? $data['mergedAudioFileKey'] ?? null;
        $this->workspaceFileKey = $data['workspace_file_key'] ?? $data['workspaceFileKey'] ?? null;
        $this->workspaceFileUrl = $data['workspace_file_url'] ?? $data['workspaceFileUrl'] ?? null;
        $this->summaryContent = $data['summary_content'] ?? $data['summaryContent'] ?? null;
        $this->createdAt = $data['created_at'] ?? $data['createdAt'] ?? null;
        $this->updatedAt = $data['updated_at'] ?? $data['updatedAt'] ?? null;
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
            'task_submitted' => $this->taskSubmitted ? 'true' : 'false',
            'speech_task_id' => $this->speechTaskId,
            'merged_audio_file_key' => $this->mergedAudioFileKey,
            'workspace_file_key' => $this->workspaceFileKey,
            'workspace_file_url' => $this->workspaceFileUrl,
            'summary_content' => $this->summaryContent,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
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
     * 检查任务是否已提交.
     */
    public function isTaskSubmitted(): bool
    {
        return $this->taskSubmitted;
    }

    /**
     * 设置任务已提交状态
     */
    public function setTaskSubmitted(bool $submitted = true): void
    {
        $this->taskSubmitted = $submitted;
        $this->updatedAt = date('Y-m-d H:i:s');
    }

    /**
     * 更新状态
     */
    public function updateStatus(AsrTaskStatusEnum $status, ?string $content = null): void
    {
        $this->status = $status;
        if ($content !== null) {
            $this->summaryContent = $content;
        }
        $this->updatedAt = date('Y-m-d H:i:s');
    }
}
