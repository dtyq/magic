<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\Entity\ValueObject;

/**
 * 记忆状态枚举.
 */
enum MemoryStatus: string
{
    case PENDING = 'pending';   // 待接受
    case ACCEPTED = 'accepted'; // 已接受

    /**
     * 获取状态描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::PENDING => '待接受',
            self::ACCEPTED => '已接受',
        };
    }

    /**
     * 获取所有状态值.
     */
    public static function getAllValues(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * 检查状态是否有效.
     */
    public static function isValid(string $status): bool
    {
        return in_array($status, self::getAllValues(), true);
    }
}
