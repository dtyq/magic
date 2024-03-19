<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use DateTime;

/**
 * 日期格式化工具类.
 */
class DateFormatUtil
{
    /**
     * 格式化过期时间为 Y/m/d H:i:s 格式（完整日期时间）.
     * 将 "Y-m-d H:i:s" 格式转换为 "Y/m/d H:i:s" 格式.
     *
     * @param null|string $expireAt 过期时间（格式：Y-m-d H:i:s，null 表示永久有效）
     * @return null|string 格式化后的日期时间（格式：Y/m/d H:i:s），如果输入为 null 则返回 null
     */
    public static function formatExpireAt(?string $expireAt): ?string
    {
        if ($expireAt === null || $expireAt === '') {
            return null;
        }

        // 尝试解析日期时间字符串
        $dateTime = DateTime::createFromFormat('Y-m-d H:i:s', $expireAt);
        if ($dateTime === false) {
            // 如果解析失败，尝试其他常见格式
            $dateTime = DateTime::createFromFormat('Y-m-d', $expireAt);
            if ($dateTime === false) {
                // 如果仍然失败，返回原始值（避免破坏数据）
                return $expireAt;
            }
        }

        // 格式化为 Y/m/d H:i:s（完整日期时间）
        return $dateTime->format('Y/m/d H:i:s');
    }
}
