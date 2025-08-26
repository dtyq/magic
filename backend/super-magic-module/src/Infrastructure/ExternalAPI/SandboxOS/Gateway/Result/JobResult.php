<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\JobStatus;

/**
 * 任务结果类
 * 专门处理任务相关的API响应结果.
 */
class JobResult extends GatewayResult
{
    private ?string $taskId = null;

    private ?int $status = null;

    private ?string $sourceOssProjectPath = null;

    private ?string $targetOssProjectPath = null;

    private ?array $files = null;

    private ?string $errorMessage = null;

    private ?array $progress = null;

    /**
     * 从API响应创建任务结果.
     */
    public static function fromApiResponse(array $response): self
    {
        $result = new self(
            $response['code'] ?? 2000,
            $response['message'] ?? 'Unknown error',
            $response['data'] ?? []
        );

        // 解析任务数据
        $data = $response['data'] ?? [];

        if (isset($data['task_id'])) {
            $result->taskId = $data['task_id'];
        }

        if (isset($data['status'])) {
            $result->status = (int) $data['status'];
        }

        if (isset($data['source_oss_project_path'])) {
            $result->sourceOssProjectPath = $data['source_oss_project_path'];
        }

        if (isset($data['target_oss_project_path'])) {
            $result->targetOssProjectPath = $data['target_oss_project_path'];
        }

        if (isset($data['files'])) {
            $result->files = $data['files'];
        }

        if (isset($data['error_message'])) {
            $result->errorMessage = $data['error_message'];
        }

        if (isset($data['progress'])) {
            $result->progress = $data['progress'];
        }

        return $result;
    }

    /**
     * 获取任务ID.
     */
    public function getTaskId(): ?string
    {
        return $this->taskId ?? $this->getDataValue('task_id');
    }

    /**
     * 获取任务状态.
     */
    public function getStatus(): ?int
    {
        if ($this->status !== null) {
            return $this->status;
        }

        $status = $this->getDataValue('status');
        return $status !== null ? (int) $status : null;
    }

    /**
     * 获取源OSS项目路径.
     */
    public function getSourceOssProjectPath(): ?string
    {
        return $this->sourceOssProjectPath ?? $this->getDataValue('source_oss_project_path');
    }

    /**
     * 获取目标OSS项目路径.
     */
    public function getTargetOssProjectPath(): ?string
    {
        return $this->targetOssProjectPath ?? $this->getDataValue('target_oss_project_path');
    }

    /**
     * 获取文件列表.
     */
    public function getFiles(): ?array
    {
        return $this->files ?? $this->getDataValue('files');
    }

    /**
     * 获取错误消息.
     */
    public function getErrorMessage(): ?string
    {
        return $this->errorMessage ?? $this->getDataValue('error_message');
    }

    /**
     * 获取进度信息.
     */
    public function getProgress(): ?array
    {
        return $this->progress ?? $this->getDataValue('progress');
    }

    /**
     * 设置任务ID.
     */
    public function setTaskId(?string $taskId): self
    {
        $this->taskId = $taskId;
        return $this;
    }

    /**
     * 设置任务状态.
     */
    public function setStatus(?int $status): self
    {
        $this->status = $status;
        return $this;
    }

    /**
     * 检查任务是否正在进行中.
     */
    public function isInProgress(): bool
    {
        $status = $this->getStatus();
        return $status !== null && JobStatus::isInProgress($status);
    }

    /**
     * 检查任务是否已完成.
     */
    public function isCompleted(): bool
    {
        $status = $this->getStatus();
        return $status !== null && JobStatus::isCompleted($status);
    }

    /**
     * 检查任务是否成功.
     */
    public function isJobSucceeded(): bool
    {
        $status = $this->getStatus();
        return $status !== null && JobStatus::isSucceeded($status);
    }

    /**
     * 检查任务是否失败.
     */
    public function isJobFailed(): bool
    {
        $status = $this->getStatus();
        return $status !== null && JobStatus::isFailed($status);
    }

    /**
     * 检查任务是否未找到.
     */
    public function isJobNotFound(): bool
    {
        $status = $this->getStatus();
        return $status !== null && $status === JobStatus::NOT_FOUND;
    }

    /**
     * 检查状态是否有效.
     */
    public function hasValidStatus(): bool
    {
        $status = $this->getStatus();
        return $status !== null && JobStatus::isValidStatus($status);
    }

    /**
     * 获取状态描述.
     */
    public function getStatusDescription(): string
    {
        $status = $this->getStatus();
        return $status !== null ? JobStatus::getDescription($status) : 'Unknown';
    }
}
