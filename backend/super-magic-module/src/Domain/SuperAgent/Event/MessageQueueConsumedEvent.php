<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;

/**
 * Message Queue Consumed Event.
 */
class MessageQueueConsumedEvent extends AbstractEvent
{
    public function __construct(
        private readonly MessageQueueEntity $messageQueueEntity,
        private readonly TopicEntity $topicEntity,
        private readonly bool $success,
    ) {
        parent::__construct();
    }

    public function getMessageQueueEntity(): MessageQueueEntity
    {
        return $this->messageQueueEntity;
    }

    public function getTopicEntity(): TopicEntity
    {
        return $this->topicEntity;
    }

    public function isSuccess(): bool
    {
        return $this->success;
    }
}
