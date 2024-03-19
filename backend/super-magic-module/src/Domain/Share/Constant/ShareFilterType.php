<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Constant;

/**
 * 分享过滤类型枚举.
 */
enum ShareFilterType: string
{
    case All = 'all';              // 全部
    case Active = 'active';        // 分享中 (actively sharing)
    case Expired = 'expired';      // 已失效 (expired/no longer valid)
    case Cancelled = 'cancelled';  // 已取消 (cancelled by user)

    /**
     * 获取过滤类型的描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::All => '全部',
            self::Active => '分享中',
            self::Expired => '已失效',
            self::Cancelled => '已取消',
        };
    }

    /**
     * 从字符串创建枚举实例.
     */
    public static function fromString(string $value): ?self
    {
        return match ($value) {
            'all' => self::All,
            'active' => self::Active,
            'expired' => self::Expired,
            'cancelled' => self::Cancelled,
            default => null,
        };
    }

    /**
     * 获取所有可用的过滤类型值.
     * @return array<string>
     */
    public static function values(): array
    {
        return ['all', 'active', 'expired', 'cancelled'];
    }

    /**
     * 检查给定的值是否是有效的过滤类型.
     */
    public static function isValid(string $value): bool
    {
        return in_array($value, self::values(), true);
    }
}
