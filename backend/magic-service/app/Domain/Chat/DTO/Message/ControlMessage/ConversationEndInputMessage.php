<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class ConversationEndInputMessage extends AbstractControlMessageStruct
{
    protected string $conversationId = '';

    protected ?string $topicId;

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
        return $this->topicId ?? null;
    }

    public function setTopicId(?string $topicId): void
    {
        $this->topicId = $topicId;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::EndConversationInput;
    }
}
