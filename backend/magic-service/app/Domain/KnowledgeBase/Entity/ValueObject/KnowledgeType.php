<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

enum KnowledgeType: int
{
    /*
     * 用户自建知识库
     */
    case UserKnowledgeBase = 1;

    /*
     * 用户话题
     */
    case UserTopic = 4;

    /*
     * 用户会话
     */
    case UserConversation = 5;

    /**
     * @return array<int>
     */
    public static function getAll(): array
    {
        return [
            self::UserKnowledgeBase->value,
            self::UserTopic->value,
            self::UserConversation->value,
        ];
    }
}
