<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\TopicTaskMessageDTO;

class RunTaskCallbackEvent
{
    public function __construct(
        private string $organizationCode,
        private string $userId,
        private int $topicId,
        private TopicTaskMessageDTO $taskMessage
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

    public function getTaskMessage(): TopicTaskMessageDTO
    {
        return $this->taskMessage;
    }
}
