<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\LLMMessageInterface;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageTrait;
use App\Domain\Chat\DTO\Message\StreamMessageInterface;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\DTO\Message\Trait\LLMMessageTrait;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

class TextMessage extends AbstractAttachmentMessage implements TextContentInterface, StreamMessageInterface, LLMMessageInterface
{
    use StreamMessageTrait;
    use LLMMessageTrait;

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::Text;
    }
}
