<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

enum SuperMagicAgentToolType: int
{
    // 1: 内置
    case BuiltIn = 1;

    // 2: 官方
    case Official = 2;

    // 3: 自定义
    case Custom = 3;

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

    public function isRemote(): bool
    {
        return in_array($this, [self::Official, self::Custom], true);
    }

    public function isBuiltIn(): bool
    {
        return $this === self::BuiltIn;
    }
}
