<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TokenUsageDetails;

class RunTaskAfterEvent extends AbstractEvent
{
    public function __construct(
        private string $organizationCode,
        private string $userId,
        private int $topicId,
        private int $taskId,
        private string $status,
        private ?TokenUsageDetails $tokenUsageDetails,
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

    public function getTaskId(): int
    {
        return $this->taskId;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getTokenUsageDetails(): ?TokenUsageDetails
    {
        return $this->tokenUsageDetails;
    }
}
