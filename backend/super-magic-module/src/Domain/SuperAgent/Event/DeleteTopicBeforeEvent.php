<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;

/**
 * Delete topic before event - triggered before topic deletion to handle sandbox termination.
 */
class DeleteTopicBeforeEvent extends AbstractEvent
{
    public function __construct(
        private string $organizationCode,
        private string $userId,
        private int $topicId,
        private TopicEntity $topicEntity,
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

    public function getTopicEntity(): TopicEntity
    {
        return $this->topicEntity;
    }
}
