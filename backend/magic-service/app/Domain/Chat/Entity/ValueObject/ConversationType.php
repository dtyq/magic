<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

/**
 * 会话的消息类型.
 */
enum ConversationType: int
{
    // 与ai的会话(私聊)
    case Ai = 0;

    // 与人类的会话(私聊)
    case User = 1;

    // 群聊
    case Group = 2;

    // 系统消息
    case System = 3;

    // 云文档
    case CloudDocument = 4;

    // 多维表格
    case MultidimensionalTable = 5;

    // 话题
    case Topic = 6;

    // 应用消息
    case App = 7;

    /**
     * 将枚举类型转换.
     */
    public static function getCaseFromName(string $typeName): ?ConversationType
    {
        foreach (self::cases() as $conversationType) {
            if ($conversationType->name === $typeName) {
                return $conversationType;
            }
        }
        return null;
    }
}
