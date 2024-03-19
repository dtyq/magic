<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Memory;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionType;
use App\Domain\Flow\Entity\ValueObject\MemoryType;
use DateTime;

class MemoryQuery
{
    private MemoryType $memoryType;

    private string $conversationId;

    private ?string $topicId;

    private int $limit;

    private ?DateTime $startTime = null;

    private ?DateTime $endTime = null;

    private string $originConversationId;

    private ?array $rangMessageTypes = null;

    public function __construct(ExecutionType $executionType, string $conversationId, string $originConversationId, ?string $topicId = null, int $limit = 10)
    {
        $memoryType = match ($executionType) {
            ExecutionType::IMChat => MemoryType::IMChat,
            default => MemoryType::Chat,
        };
        $this->memoryType = $memoryType;
        $this->limit = $limit;
        $this->conversationId = $conversationId;
        $this->originConversationId = $originConversationId;
        $this->topicId = $topicId;
    }

    public function getMemoryType(): MemoryType
    {
        return $this->memoryType;
    }

    public function getTopicId(): ?string
    {
        return $this->topicId;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function getOriginConversationId(): string
    {
        return $this->originConversationId;
    }

    public function getLimit(): int
    {
        return $this->limit;
    }

    public function setLimit(int $limit): void
    {
        $this->limit = $limit;
    }

    public function getStartTime(): ?DateTime
    {
        return $this->startTime;
    }

    public function setStartTime(?DateTime $startTime): void
    {
        $this->startTime = $startTime;
    }

    public function getEndTime(): ?DateTime
    {
        return $this->endTime;
    }

    public function setEndTime(?DateTime $endTime): void
    {
        $this->endTime = $endTime;
    }

    public function getRangMessageTypes(): ?array
    {
        return $this->rangMessageTypes;
    }

    public function setRangMessageTypes(?array $rangMessageTypes): void
    {
        $this->rangMessageTypes = $rangMessageTypes;
    }
}
