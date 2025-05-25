<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

class RunTaskBeforeEvent
{
    public function __construct(
        private string $organizationCode,
        private string $userId,
        private int $topicId,
        private int $rounds,
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

    public function getTopicId(): int
    {
        return $this->topicId;
    }

    public function getRounds(): int
    {
        return $this->rounds;
    }
}
