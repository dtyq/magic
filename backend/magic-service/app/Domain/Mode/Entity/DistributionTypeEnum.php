<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Entity;

enum DistributionTypeEnum: int
{
    /**
     * 独立配置模式.
     */
    case INDEPENDENT = 1;

    /**
     * 继承配置模式.
     */
    case INHERITED = 2;

    /**
     * 获取描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::INDEPENDENT => '独立配置',
            self::INHERITED => '继承配置',
        };
    }

    /**
     * 获取英文标识.
     */
    public function getIdentifier(): string
    {
        return match ($this) {
            self::INDEPENDENT => 'independent',
            self::INHERITED => 'inherited',
        };
    }

    /**
     * 是否为独立配置.
     */
    public function isIndependent(): bool
    {
        return $this === self::INDEPENDENT;
    }

    /**
     * 是否为继承配置.
     */
    public function isInherited(): bool
    {
        return $this === self::INHERITED;
    }

    /**
     * 获取所有类型.
     */
    public static function getAllTypes(): array
    {
        return [
            self::INDEPENDENT,
            self::INHERITED,
        ];
    }

    /**
     * 从值创建枚举.
     */
    public static function fromValue(int $value): self
    {
        return self::from($value);
    }

    /**
     * 获取选项数组（用于前端展示）.
     */
    public static function getOptions(): array
    {
        return array_map(fn (self $type) => [
            'value' => $type->value,
            'label' => $type->getDescription(),
            'identifier' => $type->getIdentifier(),
        ], self::getAllTypes());
    }
}
