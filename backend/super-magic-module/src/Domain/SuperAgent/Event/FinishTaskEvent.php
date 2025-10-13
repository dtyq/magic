<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

class FinishTaskEvent extends AbstractEvent
{
    public function __construct(
        private string $organizationCode,
        private string $userId,
        private int $topicId,
        private int $projectId,
        private int $taskId,
        private ?string $taskStatus = null,
        private ?string $taskContent = null
    ) {
        // Call parent constructor to generate snowflake ID
        parent::__construct();
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getTopicId(): int
    {
        return $this->topicId;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function getTaskId(): int
    {
        return $this->taskId;
    }

    /**
     * Get task status.
     */
    public function getTaskStatus(): ?string
    {
        return $this->taskStatus;
    }

    /**
     * Get task content/error message.
     */
    public function getTaskContent(): ?string
    {
        return $this->taskContent;
    }

    /**
     * Convert the event object to array format.
     */
    public function toArray(): array
    {
        return [
            'organizationCode' => $this->organizationCode,
            'userId' => $this->userId,
            'topicId' => $this->topicId,
            'projectId' => $this->projectId,
            'taskId' => $this->taskId,
            'taskStatus' => $this->taskStatus,
            'taskContent' => $this->taskContent,
        ];
    }
}
