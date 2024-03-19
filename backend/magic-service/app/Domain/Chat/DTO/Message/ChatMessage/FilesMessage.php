<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

class FilesMessage extends AbstractAttachmentMessage
{
    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::Files;
    }
}
