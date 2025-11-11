<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;

/**
 * Message Queue Deleted Event.
 */
class MessageQueueDeletedEvent extends AbstractEvent
{
    public function __construct(
        private readonly MessageQueueEntity $messageQueueEntity,
        private readonly string $userId,
        private readonly string $organizationCode,
    ) {
        parent::__construct();
    }

    public function getMessageQueueEntity(): MessageQueueEntity
    {
        return $this->messageQueueEntity;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }
}
