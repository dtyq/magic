<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\ValueObject;

/**
 * 记忆操作场景枚举.
 */
enum MemoryOperationScenario: string
{
    case ADMIN_PANEL = 'admin_panel';           // 管理后台
    case MEMORY_CARD_QUICK = 'memory_card_quick'; // 记忆卡片快捷操作

    /**
     * 获取场景描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::ADMIN_PANEL => '管理后台',
            self::MEMORY_CARD_QUICK => '记忆卡片快捷操作',
        };
    }

    /**
     * 获取所有场景值.
     */
    public static function getAllValues(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * 检查场景是否有效.
     */
    public static function isValid(string $scenario): bool
    {
        return in_array($scenario, self::getAllValues(), true);
    }

    /**
     * 获取默认场景.
     */
    public static function getDefault(): self
    {
        return self::ADMIN_PANEL;
    }
}
