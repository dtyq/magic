<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

/**
 * Message schedule entity.
 */
class MessageScheduleEntity
{
    private int $id = 0;

    private string $userId = '';

    private string $organizationCode = '';

    private string $taskName = '';

    private string $messageType = '';

    private array $messageContent = [];

    private int $workspaceId = 0;

    private int $projectId = 0;

    private int $topicId = 0;

    private int $status = 0;

    private array $timeConfig = [];

    private ?int $taskSchedulerCrontabId = null;

    private string $createdUid = '';

    private string $updatedUid = '';

    private ?string $createdAt = null;

    private ?string $updatedAt = null;

    private ?string $deletedAt = null;

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

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getTaskName(): string
    {
        return $this->taskName;
    }

    public function getMessageType(): string
    {
        return $this->messageType;
    }

    public function getMessageContent(): array
    {
        return $this->messageContent;
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

    public function getStatus(): int
    {
        return $this->status;
    }

    public function getTimeConfig(): array
    {
        return $this->timeConfig;
    }

    public function getTaskSchedulerCrontabId(): ?int
    {
        return $this->taskSchedulerCrontabId;
    }

    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    public function getUpdatedUid(): string
    {
        return $this->updatedUid;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    // Setters
    public function setId(int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function setTaskName(string $taskName): self
    {
        $this->taskName = $taskName;
        return $this;
    }

    public function setMessageType(string $messageType): self
    {
        $this->messageType = $messageType;
        return $this;
    }

    public function setMessageContent(array $messageContent): self
    {
        $this->messageContent = $messageContent;
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

    public function setStatus(int $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function setTimeConfig(array $timeConfig): self
    {
        $this->timeConfig = $timeConfig;
        return $this;
    }

    public function setTaskSchedulerCrontabId(?int $taskSchedulerCrontabId): self
    {
        $this->taskSchedulerCrontabId = $taskSchedulerCrontabId;
        return $this;
    }

    public function setCreatedUid(string $createdUid): self
    {
        $this->createdUid = $createdUid;
        return $this;
    }

    public function setUpdatedUid(string $updatedUid): self
    {
        $this->updatedUid = $updatedUid;
        return $this;
    }

    public function setCreatedAt(?string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function setDeletedAt(?string $deletedAt): self
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    // Business methods
    public function isEnabled(): bool
    {
        return $this->status === 1;
    }

    public function isDisabled(): bool
    {
        return $this->status === 0;
    }

    public function enable(): self
    {
        $this->status = 1;
        return $this;
    }

    public function disable(): self
    {
        $this->status = 0;
        return $this;
    }

    public function hasTaskScheduler(): bool
    {
        return $this->taskSchedulerCrontabId !== null;
    }

    /**
     * Convert entity to array.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'task_name' => $this->taskName,
            'message_type' => $this->messageType,
            'message_content' => $this->messageContent,
            'workspace_id' => $this->workspaceId,
            'project_id' => $this->projectId,
            'topic_id' => $this->topicId,
            'status' => $this->status,
            'time_config' => $this->timeConfig,
            'task_scheduler_crontab_id' => $this->taskSchedulerCrontabId,
            'created_uid' => $this->createdUid,
            'updated_uid' => $this->updatedUid,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
        ];
    }

    /**
     * Fill entity with data.
     */
    private function fill(array $data): void
    {
        foreach ($data as $key => $value) {
            $method = 'set' . str_replace('_', '', ucwords($key, '_'));
            if (method_exists($this, $method)) {
                $this->{$method}($value);
            }
        }
    }
}
