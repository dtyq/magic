<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

class CreateTopicBeforeEvent
{
    public function __construct(
        private string $organizationCode,
        private string $userId,
        private int $workspaceId,
        private string $topicName
    ) {
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getWorkspaceId(): int
    {
        return $this->workspaceId;
    }

    public function getTopicName(): string
    {
        return $this->topicName;
    }
}
