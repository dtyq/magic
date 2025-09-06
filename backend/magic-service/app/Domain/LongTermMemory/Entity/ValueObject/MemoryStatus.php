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
    case PENDING = 'pending';                   // 待接受（第一次生成记忆时）
    case ACTIVE = 'active';                     // 已生效（记忆已被接受，pending_content为空）
    case PENDING_REVISION = 'pending_revision'; // 待修订（记忆已被接受，但pending_content不为空）

    /**
     * 获取状态描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::PENDING => '待接受',
            self::ACTIVE => '已生效',
            self::PENDING_REVISION => '待修订',
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
