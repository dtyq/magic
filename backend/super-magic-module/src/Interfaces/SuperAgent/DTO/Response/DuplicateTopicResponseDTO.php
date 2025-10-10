<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * 话题复制响应DTO.
 */
class DuplicateTopicResponseDTO
{
    /**
     * 任务键.
     */
    protected string $taskKey;

    /**
     * 任务状态
     */
    protected string $status;

    /**
     * 新话题ID.
     */
    protected ?string $topicId;

    /**
     * 状态消息.
     */
    protected string $message;

    /**
     * 构造函数.
     */
    public function __construct(
        string $taskKey,
        string $status,
        ?string $topicId = null,
        string $message = ''
    ) {
        $this->taskKey = $taskKey;
        $this->status = $status;
        $this->topicId = $topicId;
        $this->message = $message;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'task_key' => $this->taskKey,
            'status' => $this->status,
            'topic_id' => $this->topicId,
            'message' => $this->message,
        ];
    }

    /**
     * 获取任务键.
     */
    public function getTaskKey(): string
    {
        return $this->taskKey;
    }

    /**
     * 设置任务键.
     */
    public function setTaskKey(string $taskKey): self
    {
        $this->taskKey = $taskKey;
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
     * 获取新话题ID.
     */
    public function getTopicId(): ?string
    {
        return $this->topicId;
    }

    /**
     * 设置新话题ID.
     */
    public function setTopicId(?string $topicId): self
    {
        $this->topicId = $topicId;
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
}
