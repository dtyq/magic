<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

enum SuperMagicAgentType: int
{
    /**
     * 内置智能体.
     */
    case Built_In = 1;

    /**
     * 自定义智能体.
     */
    case Custom = 2;

    /**
     * 获取类型描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::Built_In => '内置',
            self::Custom => '自定义',
        };
    }

    /**
     * 是否为内置类型.
     */
    public function isBuiltIn(): bool
    {
        return $this === self::Built_In;
    }

    /**
     * 是否为自定义类型.
     */
    public function isCustom(): bool
    {
        return $this === self::Custom;
    }

    /**
     * 获取所有可用的枚举值.
     * @return array<int>
     */
    public static function getAvailableValues(): array
    {
        return array_map(fn ($case) => $case->value, self::cases());
    }

    /**
     * 获取所有可用的枚举值字符串（用于验证规则）.
     */
    public static function getValidationRule(): string
    {
        return implode(',', self::getAvailableValues());
    }
}
