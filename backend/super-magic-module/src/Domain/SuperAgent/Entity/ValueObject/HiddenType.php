<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 隐藏类型枚举（使用整数类型）.
 */
enum HiddenType: int
{
    /**
     * 预启动隐藏（用于沙箱预热）.
     */
    case PRE_WARM = 1;

    /**
     * Agent 项目隐藏（用于 custom agent 场景）.
     */
    case AGENT = 2;

    /**
     * 获取所有隐藏类型的值
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * 从值创建枚举.
     */
    public static function fromValue(?int $value): ?self
    {
        if ($value === null) {
            return null;
        }

        return self::tryFrom($value);
    }

    /**
     * 获取描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::PRE_WARM => '预启动隐藏',
            self::AGENT => 'Agent 项目隐藏',
        };
    }
}
