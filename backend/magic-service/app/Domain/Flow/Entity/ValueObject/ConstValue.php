<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject;

class ConstValue
{
    public const string TOOL_SET_DEFAULT_CODE = 'not_grouped';

    public const string KNOWLEDGE_USER_CURRENT_TOPIC = 'knowledge_user_current_topic';

    public const string KNOWLEDGE_USER_CURRENT_CONVERSATION = 'knowledge_user_current_conversation';

    public static function isSystemKnowledge(?string $knowledgeCode): bool
    {
        return in_array($knowledgeCode, [
            self::KNOWLEDGE_USER_CURRENT_TOPIC,
            self::KNOWLEDGE_USER_CURRENT_CONVERSATION,
        ], true);
    }
}
