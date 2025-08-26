<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\ValueObject;

/**
 * 记忆操作动作枚举.
 */
enum MemoryOperationAction: string
{
    case ACCEPT = 'accept';   // 接受记忆建议
    case REJECT = 'reject';   // 拒绝记忆建议

    /**
     * 获取操作描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::ACCEPT => '接受',
            self::REJECT => '拒绝',
        };
    }

    /**
     * 获取所有操作值.
     */
    public static function getAllValues(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * 检查操作是否有效.
     */
    public static function isValid(string $action): bool
    {
        return in_array($action, self::getAllValues(), true);
    }
}
