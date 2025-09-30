<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use Carbon\Carbon;

/**
 * Message schedule log entity.
 */
class MessageScheduleLogEntity
{
    /**
     * Execution status constants.
     */
    public const STATUS_SUCCESS = 1;

    public const STATUS_FAILED = 2;

    public const STATUS_RUNNING = 3;

    private int $id = 0;

    private int $messageScheduleId = 0;

    private int $workspaceId = 0;

    private int $projectId = 0;

    private int $topicId = 0;

    private string $taskName = '';

    private int $status = self::STATUS_RUNNING;

    private ?string $executedAt = null;

    private ?string $errorMessage = null;

    private ?string $createdAt = null;

    private ?string $updatedAt = null;

    public function __construct(array $data = [])
    {
        if (! empty($data)) {
            $this->fill($data);
        }
    }

    // Getters
    public function getId(): int
    {
        return $this->id;
    }

    public function getMessageScheduleId(): int
    {
        return $this->messageScheduleId;
    }

    public function getWorkspaceId(): int
    {
        return $this->workspaceId;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function getTopicId(): int
    {
        return $this->topicId;
    }

    public function getTaskName(): string
    {
        return $this->taskName;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function getExecutedAt(): ?string
    {
        return $this->executedAt;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    // Setters
    public function setId(int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function setMessageScheduleId(int $messageScheduleId): self
    {
        $this->messageScheduleId = $messageScheduleId;
        return $this;
    }

    public function setWorkspaceId(int $workspaceId): self
    {
        $this->workspaceId = $workspaceId;
        return $this;
    }

    public function setProjectId(int $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    public function setTopicId(int $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function setTaskName(string $taskName): self
    {
        $this->taskName = $taskName;
        return $this;
    }

    public function setStatus(int $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function setExecutedAt(?string $executedAt): self
    {
        $this->executedAt = $executedAt;
        return $this;
    }

    public function setErrorMessage(?string $errorMessage): self
    {
        $this->errorMessage = $errorMessage;
        return $this;
    }

    public function setCreatedAt($createdAt): self
    {
        if ($createdAt instanceof Carbon) {
            $this->createdAt = $createdAt->toDateTimeString();
        } else {
            $this->createdAt = $createdAt;
        }
        return $this;
    }

    public function setUpdatedAt($updatedAt): self
    {
        if ($updatedAt instanceof Carbon) {
            $this->updatedAt = $updatedAt->toDateTimeString();
        } else {
            $this->updatedAt = $updatedAt;
        }
        return $this;
    }

    // Status helper methods
    public function isSuccess(): bool
    {
        return $this->status === self::STATUS_SUCCESS;
    }

    public function isFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }

    public function isRunning(): bool
    {
        return $this->status === self::STATUS_RUNNING;
    }

    public function markAsSuccess(): self
    {
        $this->status = self::STATUS_SUCCESS;
        $this->errorMessage = null;
        return $this;
    }

    public function markAsFailed(?string $errorMessage = null): self
    {
        $this->status = self::STATUS_FAILED;
        $this->errorMessage = $errorMessage;
        return $this;
    }

    public function markAsRunning(): self
    {
        $this->status = self::STATUS_RUNNING;
        $this->errorMessage = null;
        return $this;
    }

    /**
     * Fill entity with data array.
     */
    public function fill(array $data): self
    {
        if (isset($data['id'])) {
            $this->setId((int) $data['id']);
        }

        if (isset($data['message_schedule_id'])) {
            $this->setMessageScheduleId((int) $data['message_schedule_id']);
        }

        if (isset($data['workspace_id'])) {
            $this->setWorkspaceId((int) $data['workspace_id']);
        }

        if (isset($data['project_id'])) {
            $this->setProjectId((int) $data['project_id']);
        }

        if (isset($data['topic_id'])) {
            $this->setTopicId((int) $data['topic_id']);
        }

        if (isset($data['task_name'])) {
            $this->setTaskName((string) $data['task_name']);
        }

        if (isset($data['status'])) {
            $this->setStatus((int) $data['status']);
        }

        if (isset($data['executed_at'])) {
            $this->setExecutedAt($data['executed_at']);
        }

        if (isset($data['error_message'])) {
            $this->setErrorMessage($data['error_message']);
        }

        if (isset($data['created_at'])) {
            $this->setCreatedAt($data['created_at']);
        }

        if (isset($data['updated_at'])) {
            $this->setUpdatedAt($data['updated_at']);
        }

        return $this;
    }

    /**
     * Convert entity to array.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->getId(),
            'message_schedule_id' => $this->getMessageScheduleId(),
            'workspace_id' => $this->getWorkspaceId(),
            'project_id' => $this->getProjectId(),
            'topic_id' => $this->getTopicId(),
            'task_name' => $this->getTaskName(),
            'status' => $this->getStatus(),
            'executed_at' => $this->getExecutedAt(),
            'error_message' => $this->getErrorMessage(),
            'created_at' => $this->getCreatedAt(),
            'updated_at' => $this->getUpdatedAt(),
        ];
    }

    /**
     * Convert entity to model array for persistence.
     */
    public function toModelArray(): array
    {
        return $this->toArray();
    }
}
