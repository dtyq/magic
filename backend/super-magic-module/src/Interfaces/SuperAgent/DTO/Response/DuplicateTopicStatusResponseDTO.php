<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * 话题复制状态响应DTO.
 */
class DuplicateTopicStatusResponseDTO
{
    /**
     * 任务ID.
     */
    protected string $taskId;

    /**
     * 任务状态 (running, completed, failed).
     */
    protected string $status;

    /**
     * 状态消息.
     */
    protected string $message;

    /**
     * 进度信息.
     */
    protected ?array $progress = null;

    /**
     * 结果信息（任务完成时）.
     */
    protected ?array $result = null;

    /**
     * 错误信息（任务失败时）.
     */
    protected ?string $error = null;

    /**
     * 构造函数.
     */
    public function __construct(
        string $taskId,
        string $status,
        string $message = '',
        ?array $progress = null,
        ?array $result = null,
        ?string $error = null
    ) {
        $this->taskId = $taskId;
        $this->status = $status;
        $this->message = $message;
        $this->progress = $progress;
        $this->result = $result;
        $this->error = $error;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        $result = [
            'task_id' => $this->taskId,
            'status' => $this->status,
            'message' => $this->message,
        ];

        if ($this->progress !== null) {
            $result['progress'] = $this->progress;
        }

        if ($this->result !== null) {
            $result['result'] = $this->result;
        }

        if ($this->error !== null) {
            $result['error'] = $this->error;
        }

        return $result;
    }

    /**
     * 从数组创建DTO实例.
     */
    public static function fromArray(array $data): self
    {
        return new self(
            $data['task_id'],
            $data['status'],
            $data['message'] ?? '',
            $data['progress'] ?? null,
            $data['result'] ?? null,
            $data['error'] ?? null
        );
    }

    /**
     * 获取任务ID.
     */
    public function getTaskId(): string
    {
        return $this->taskId;
    }

    /**
     * 设置任务ID.
     */
    public function setTaskId(string $taskId): self
    {
        $this->taskId = $taskId;
        return $this;
    }

    /**
     * 获取任务状态
     */
    public function getStatus(): string
    {
        return $this->status;
    }

    /**
     * 设置任务状态
     */
    public function setStatus(string $status): self
    {
        $this->status = $status;
        return $this;
    }

    /**
     * 获取状态消息.
     */
    public function getMessage(): string
    {
        return $this->message;
    }

    /**
     * 设置状态消息.
     */
    public function setMessage(string $message): self
    {
        $this->message = $message;
        return $this;
    }

    /**
     * 获取进度信息.
     */
    public function getProgress(): ?array
    {
        return $this->progress;
    }

    /**
     * 设置进度信息.
     */
    public function setProgress(?array $progress): self
    {
        $this->progress = $progress;
        return $this;
    }

    /**
     * 获取结果信息.
     */
    public function getResult(): ?array
    {
        return $this->result;
    }

    /**
     * 设置结果信息.
     */
    public function setResult(?array $result): self
    {
        $this->result = $result;
        return $this;
    }

    /**
     * 获取错误信息.
     */
    public function getError(): ?string
    {
        return $this->error;
    }

    /**
     * 设置错误信息.
     */
    public function setError(?string $error): self
    {
        $this->error = $error;
        return $this;
    }
}
