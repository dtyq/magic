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

    /**
     * 管理后台列表时间范围：开始时间.
     * 若为纯日期 Y-m-d 则补全为当日 00:00:00；已含时间则原样返回.
     */
    public static function normalizeQueryRangeStart(string $dateTime): string
    {
        $trimmed = trim($dateTime);
        if ($trimmed === '') {
            return $trimmed;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) === 1) {
            return $trimmed . ' 00:00:00';
        }

        return $trimmed;
    }

    /**
     * 管理后台列表时间范围：结束时间.
     * 若为纯日期 Y-m-d 则补全为当日 23:59:59；已含时间则原样返回.
     */
    public static function normalizeQueryRangeEnd(string $dateTime): string
    {
        $trimmed = trim($dateTime);
        if ($trimmed === '') {
            return $trimmed;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed) === 1) {
            return $trimmed . ' 23:59:59';
        }

        return $trimmed;
    }
}
