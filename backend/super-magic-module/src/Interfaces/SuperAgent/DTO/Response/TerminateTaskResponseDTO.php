<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * Terminate Task Response DTO
 * Encapsulates the result of task termination operation.
 */
class TerminateTaskResponseDTO
{
    protected string $topicId = '';

    protected string $taskId = '';

    protected string $status = '';

    protected string $message = '';

    /**
     * Constructor.
     */
    public function __construct()
    {
    }

    /**
     * Create DTO from parameters.
     *
     * @param int $topicId Topic ID
     * @param int $taskId Task ID
     * @param string $status Task status value from TaskStatus enum ('suspended', 'finished', 'error', 'stopped', 'waiting', 'running') or empty string if no task
     * @param string $message Result message
     */
    public static function fromParams(int $topicId, int $taskId, string $status, string $message): self
    {
        $dto = new self();
        $dto->topicId = (string) $topicId;
        $dto->taskId = (string) $taskId;
        $dto->status = $status;
        $dto->message = $message;
        return $dto;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): void
    {
        $this->topicId = $topicId;
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function setTaskId(string $taskId): void
    {
        $this->taskId = $taskId;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function setMessage(string $message): void
    {
        $this->message = $message;
    }

    public function toArray(): array
    {
        return [
            'topic_id' => $this->topicId,
            'task_id' => $this->taskId,
            'status' => $this->status,
            'message' => $this->message,
        ];
    }
}
