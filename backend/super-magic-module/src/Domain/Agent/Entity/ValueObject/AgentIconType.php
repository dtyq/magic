<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

/**
 * Agent 图标类型枚举.
 */
enum AgentIconType: int
{
    /**
     * 图标.
     */
    case Icon = 1;

    /**
     * 图片.
     */
    case Image = 2;

    /**
     * 获取图标类型描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::Icon => '图标',
            self::Image => '图片',
        };
    }

    /**
     * 是否为图标类型.
     */
    public function isIcon(): bool
    {
        return $this === self::Icon;
    }

    /**
     * 是否为图片类型.
     */
    public function isImage(): bool
    {
        return $this === self::Image;
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
