<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

/**
 * 文本结构的表单消息，存在自动下载 url 然后再次上传的业务场景，如审批表单。
 */
class TextFormMessage extends TextMessage
{
    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::TextForm;
    }
}
