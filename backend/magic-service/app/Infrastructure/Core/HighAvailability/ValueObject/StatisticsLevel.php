<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\HighAvailability\ValueObject;

/**
 * 统计级别枚举类.
 */
enum StatisticsLevel: int
{
    /**
     * 统计级别：秒级.
     */
    case LEVEL_SECOND = 0;

    /**
     * 统计级别：分钟级.
     */
    case LEVEL_MINUTE = 1;

    /**
     * 统计级别：小时级.
     */
    case LEVEL_HOUR = 2;

    /**
     * 统计级别：天级.
     */
    case LEVEL_DAY = 3;

    /**
     * 获取统计级别名称.
     */
    public function getName(): string
    {
        return match ($this) {
            self::LEVEL_SECOND => '秒级',
            self::LEVEL_MINUTE => '分钟级',
            self::LEVEL_HOUR => '小时级',
            self::LEVEL_DAY => '天级',
        };
    }

    /**
     * 获取统计级别名称（静态方法，用于兼容旧代码）.
     * @deprecated 使用枚举实例的 getName() 方法代替
     */
    public static function getLevelName(int|self $level): string
    {
        if (is_int($level)) {
            return match ($level) {
                self::LEVEL_SECOND->value => '秒级',
                self::LEVEL_MINUTE->value => '分钟级',
                self::LEVEL_HOUR->value => '小时级',
                self::LEVEL_DAY->value => '天级',
                default => '未知级别',
            };
        }

        return $level->getName();
    }
}
