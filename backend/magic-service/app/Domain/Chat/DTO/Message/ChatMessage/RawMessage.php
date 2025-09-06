<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\MagicMessageStruct;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageTrait;
use App\Domain\Chat\DTO\Message\StreamMessageInterface;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

/**
 * 原始消息，可快速用于一些需要临时转发的数据格式，原样输出.
 */
class RawMessage extends MagicMessageStruct implements StreamMessageInterface
{
    use StreamMessageTrait;

    protected array $rawData = [];

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::Raw;
    }
}
