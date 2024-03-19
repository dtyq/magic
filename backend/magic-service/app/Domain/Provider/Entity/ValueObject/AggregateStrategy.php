<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

/**
 * 聚合模型策略枚举.
 * 定义动态模型（聚合模型）的解析策略类型.
 */
enum AggregateStrategy: string
{
    /**
     * 权限降级策略.
     * 按照配置的模型顺序，找到第一个用户有权限使用的模型.
     */
    case PERMISSION_FALLBACK = 'permission_fallback';

    /**
     * 获取策略描述.
     */
    public function label(): string
    {
        return match ($this) {
            self::PERMISSION_FALLBACK => '权限降级策略',
        };
    }

    /**
     * 获取默认策略.
     */
    public static function default(): self
    {
        return self::PERMISSION_FALLBACK;
    }

    /**
     * 从字符串创建枚举实例，如果无效则返回默认值.
     */
    public static function fromString(?string $value): self
    {
        if ($value === null || $value === '') {
            return self::default();
        }

        return self::tryFrom($value) ?? self::default();
    }
}
