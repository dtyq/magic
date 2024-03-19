<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\Query;

use DateTime;

class MagicFlowMemoryHistoryQuery extends Query
{
    private int $type = 0;

    private string $conversationId = '';

    private ?string $topicId = null;

    private string $mountId = '';

    private array $mountIds = [];

    private array $ignoreRequestIds = [];

    private ?DateTime $startTime = null;

    public function getStartTime(): ?DateTime
    {
        return $this->startTime;
    }

    public function setStartTime(?DateTime $startTime): void
    {
        $this->startTime = $startTime;
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(int $type): void
    {
        $this->type = $type;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getTopicId(): ?string
    {
        return $this->topicId;
    }

    public function setTopicId(?string $topicId): void
    {
        $this->topicId = $topicId;
    }

    public function getIgnoreRequestIds(): array
    {
        return $this->ignoreRequestIds;
    }

    public function setIgnoreRequestIds(array $ignoreRequestIds): void
    {
        $this->ignoreRequestIds = $ignoreRequestIds;
    }

    public function getMountId(): string
    {
        return $this->mountId;
    }

    public function setMountId(string $mountId): void
    {
        $this->mountId = $mountId;
    }

    public function setMountIds(array $mountIds): void
    {
        $this->mountIds = $mountIds;
    }

    public function getMountIds(): array
    {
        return $this->mountIds;
    }
}
