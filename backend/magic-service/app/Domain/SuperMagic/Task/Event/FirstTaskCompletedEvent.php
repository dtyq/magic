<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Event;

use App\Domain\SuperMagic\Common\Event\AbstractEvent;

/**
 * 用户首次成功完成任务事件.
 *
 * 是否“首次”由 OpenPanel 属性状态（first_task_completed_at 仅首次写入）保证。
 */
class FirstTaskCompletedEvent extends AbstractEvent
{
    public function __construct(
        private readonly string $userId,
        private readonly string $organizationCode,
        private readonly int $taskId,
        private readonly string $completedAt,
        private readonly string $taskType = '',
        private readonly int $durationSeconds = 0
    ) {
        parent::__construct();
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getTaskId(): int
    {
        return $this->taskId;
    }

    public function getCompletedAt(): string
    {
        return $this->completedAt;
    }

    public function getTaskType(): string
    {
        return $this->taskType;
    }

    public function getDurationSeconds(): int
    {
        return $this->durationSeconds;
    }

    /**
     * Convert the event object to array format.
     */
    public function toArray(): array
    {
        return [
            'userId' => $this->userId,
            'organizationCode' => $this->organizationCode,
            'taskId' => $this->taskId,
            'completedAt' => $this->completedAt,
            'taskType' => $this->taskType,
            'durationSeconds' => $this->durationSeconds,
        ];
    }
}
