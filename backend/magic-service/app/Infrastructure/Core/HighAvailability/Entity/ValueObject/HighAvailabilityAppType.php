<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\HighAvailability\Entity\ValueObject;

use InvalidArgumentException;

/**
 * 高可用应用类型枚举.
 */
enum HighAvailabilityAppType: string
{
    /**
     * 模型网关类型.
     */
    case MODEL_GATEWAY = 'modelGateway';

    /**
     * 获取所有应用类型值数组.
     */
    public static function values(): array
    {
        return [
            self::MODEL_GATEWAY->value,
        ];
    }

    /**
     * 检查是否是有效的应用类型.
     */
    public static function isValid(string $type): bool
    {
        return in_array($type, self::values(), true);
    }

    /**
     * 从字符串创建枚举实例.
     */
    public static function fromString(string $type): self
    {
        return match ($type) {
            self::MODEL_GATEWAY->value => self::MODEL_GATEWAY,
            default => throw new InvalidArgumentException("无效的高可用应用类型: {$type}"),
        };
    }

    /**
     * 获取应用类型的描述文本.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::MODEL_GATEWAY => '模型网关',
        };
    }
}
