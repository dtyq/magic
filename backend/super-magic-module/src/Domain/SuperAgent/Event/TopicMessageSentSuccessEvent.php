<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

class TopicMessageSentSuccessEvent extends AbstractEvent
{
    public function __construct(
        private readonly string $organizationCode,
        private readonly string $userId,
        private readonly int $topicId,
        private readonly string $taskId,
        private readonly ?string $language = null,
    ) {
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

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function getLanguage(): ?string
    {
        return $this->language;
    }
}
