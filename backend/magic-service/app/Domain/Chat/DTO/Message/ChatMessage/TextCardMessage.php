<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

/**
 * 文本卡片消息.
 */
class TextCardMessage extends AbstractChatMessageStruct
{
    protected ?string $title = null;

    protected ?string $description = null;

    protected ?string $url = null;

    protected ?string $btnTxt = null;

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::TextCard;
    }
}
