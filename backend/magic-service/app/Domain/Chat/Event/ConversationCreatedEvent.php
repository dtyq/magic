<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Event;

use App\Domain\Chat\Entity\MagicConversationEntity;

class ConversationCreatedEvent
{
    /**
     * @param MagicConversationEntity $conversation 创建的会话实体
     */
    public function __construct(private readonly MagicConversationEntity $conversation)
    {
    }

    /**
     * 获取创建的会话实体.
     */
    public function getConversation(): MagicConversationEntity
    {
        return $this->conversation;
    }
}
