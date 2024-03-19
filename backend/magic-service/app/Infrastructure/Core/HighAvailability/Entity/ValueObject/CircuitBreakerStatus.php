<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\HighAvailability\Entity\ValueObject;

use InvalidArgumentException;

/**
 * 熔断器状态枚举.
 */
enum CircuitBreakerStatus: string
{
    /**
     * 关闭状态 - 正常服务中.
     */
    case CLOSED = 'closed';

    /**
     * 开启状态 - 熔断中.
     */
    case OPEN = 'open';

    /**
     * 半开状态 - 尝试恢复中.
     */
    case HALF_OPEN = 'half_open';

    /**
     * 获取所有状态值数组.
     */
    public static function values(): array
    {
        return [
            self::CLOSED->value,
            self::OPEN->value,
            self::HALF_OPEN->value,
        ];
    }

    /**
     * 检查是否是有效的状态值
     */
    public static function isValid(string $status): bool
    {
        return in_array($status, self::values(), true);
    }

    /**
     * 从字符串创建枚举实例.
     */
    public static function fromString(string $status): self
    {
        return match ($status) {
            self::CLOSED->value => self::CLOSED,
            self::OPEN->value => self::OPEN,
            self::HALF_OPEN->value => self::HALF_OPEN,
            default => throw new InvalidArgumentException("Invalid circuit breaker status: {$status}"),
        };
    }
}
