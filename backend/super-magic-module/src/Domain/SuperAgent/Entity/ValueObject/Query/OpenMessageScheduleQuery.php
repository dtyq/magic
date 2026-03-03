<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\Query;

/**
 * Open API message schedule query object.
 */
class OpenMessageScheduleQuery
{
    private ?string $topicId = null;

    private ?string $taskName = null;

    private ?int $enabled = null;

    private ?int $completed = null;

    private int $page = 1;

    private int $pageSize = 100;

    private string $orderBy = 'updated_at';

    private string $orderDirection = 'desc';

    public function setTopicId(?string $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function setTaskName(?string $taskName): self
    {
        $this->taskName = $taskName;
        return $this;
    }

    public function setEnabled(?int $enabled): self
    {
        $this->enabled = $enabled;
        return $this;
    }

    public function setCompleted(?int $completed): self
    {
        $this->completed = $completed;
        return $this;
    }

    public function setPage(int $page): self
    {
        $this->page = max(1, $page);
        return $this;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPageSize(int $pageSize): self
    {
        $this->pageSize = max(1, $pageSize);
        return $this;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function getOrderBy(): string
    {
        return $this->orderBy;
    }

    public function getOrderDirection(): string
    {
        return $this->orderDirection;
    }

    public function toConditions(string $userId, string $organizationCode): array
    {
        $conditions = [
            'user_id' => $userId,
            'organization_code' => $organizationCode,
        ];

        if ($this->topicId !== null && $this->topicId !== '') {
            $conditions['topic_id'] = (int) $this->topicId;
        }

        if ($this->taskName !== null && $this->taskName !== '') {
            $conditions['task_name_like'] = $this->taskName;
        }

        if ($this->enabled !== null) {
            $conditions['enabled'] = $this->enabled;
        }

        if ($this->completed !== null) {
            $conditions['completed'] = $this->completed;
        }

        return $conditions;
    }
}
