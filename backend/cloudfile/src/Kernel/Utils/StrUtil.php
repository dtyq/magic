<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils;

/**
 * 字符串工具类.
 */
class StrUtil
{
    /**
     * 判断字符串是否以指定子串开头.
     *
     * @param string $haystack 要检查的字符串
     * @param string|string[] $needles 要查找的子串（或子串数组）
     */
    public static function startsWith(string $haystack, $needles): bool
    {
        if (! is_array($needles)) {
            $needles = [$needles];
        }

        foreach ($needles as $needle) {
            if ($needle !== '' && str_starts_with($haystack, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 判断字符串是否以指定子串结尾.
     *
     * @param string $haystack 要检查的字符串
     * @param string|string[] $needles 要查找的子串（或子串数组）
     */
    public static function endsWith(string $haystack, $needles): bool
    {
        if (! is_array($needles)) {
            $needles = [$needles];
        }

        foreach ($needles as $needle) {
            if ($needle !== '' && str_ends_with($haystack, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 替换字符串中第一次出现的子串.
     *
     * @param string $search 要搜索的子串
     * @param string $replace 替换的内容
     * @param string $subject 目标字符串
     * @return string 替换后的字符串
     */
    public static function replaceFirst(string $search, string $replace, string $subject): string
    {
        if ($search === '') {
            return $subject;
        }

        $position = strpos($subject, $search);

        if ($position === false) {
            return $subject;
        }

        return substr_replace($subject, $replace, $position, strlen($search));
    }

    /**
     * 替换字符串中最后一次出现的子串.
     *
     * @param string $search 要搜索的子串
     * @param string $replace 替换的内容
     * @param string $subject 目标字符串
     * @return string 替换后的字符串
     */
    public static function replaceLast(string $search, string $replace, string $subject): string
    {
        if ($search === '') {
            return $subject;
        }

        $position = strrpos($subject, $search);

        if ($position === false) {
            return $subject;
        }

        return substr_replace($subject, $replace, $position, strlen($search));
    }

    /**
     * 判断字符串是否包含指定子串.
     *
     * @param string $haystack 要检查的字符串
     * @param string|string[] $needles 要查找的子串（或子串数组）
     * @param bool $ignoreCase 是否忽略大小写
     */
    public static function contains(string $haystack, $needles, bool $ignoreCase = false): bool
    {
        if (! is_array($needles)) {
            $needles = [$needles];
        }

        foreach ($needles as $needle) {
            if ($needle !== '') {
                if ($ignoreCase) {
                    if (stripos($haystack, $needle) !== false) {
                        return true;
                    }
                } else {
                    if (str_contains($haystack, $needle)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * 限制字符串长度.
     *
     * @param string $value 要限制的字符串
     * @param int $limit 最大长度
     * @param string $end 超出长度时的结尾字符串
     */
    public static function limit(string $value, int $limit = 100, string $end = '...'): string
    {
        if (mb_strlen($value) <= $limit) {
            return $value;
        }

        return mb_substr($value, 0, $limit) . $end;
    }

    /**
     * 将字符串转换为小驼峰命名.
     *
     * @param string $value 要转换的字符串
     */
    public static function camel(string $value): string
    {
        return lcfirst(static::studly($value));
    }

    /**
     * 将字符串转换为大驼峰命名.
     *
     * @param string $value 要转换的字符串
     */
    public static function studly(string $value): string
    {
        $value = ucwords(str_replace(['-', '_'], ' ', $value));

        return str_replace(' ', '', $value);
    }

    /**
     * 将字符串转换为蛇形命名.
     *
     * @param string $value 要转换的字符串
     * @param string $delimiter 分隔符
     */
    public static function snake(string $value, string $delimiter = '_'): string
    {
        if (! ctype_lower($value)) {
            $value = preg_replace('/\s+/u', '', ucwords($value));
            $value = strtolower(preg_replace('/(.)(?=[A-Z])/u', '$1' . $delimiter, $value));
        }

        return $value;
    }

    /**
     * 将字符串转换为短横线命名.
     *
     * @param string $value 要转换的字符串
     */
    public static function kebab(string $value): string
    {
        return static::snake($value, '-');
    }

    /**
     * 生成随机字符串.
     *
     * @param int $length 长度
     */
    public static function random(int $length = 16): string
    {
        $string = '';
        $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

        for ($i = 0; $i < $length; ++$i) {
            $string .= $characters[random_int(0, 61)];
        }

        return $string;
    }

    /**
     * 移除字符串开头的指定子串.
     *
     * @param string $prefix 要移除的前缀
     * @param string $subject 目标字符串
     */
    public static function removePrefix(string $prefix, string $subject): string
    {
        if (static::startsWith($subject, $prefix)) {
            return substr($subject, strlen($prefix));
        }

        return $subject;
    }

    /**
     * 移除字符串结尾的指定子串.
     *
     * @param string $suffix 要移除的后缀
     * @param string $subject 目标字符串
     */
    public static function removeSuffix(string $suffix, string $subject): string
    {
        if (static::endsWith($subject, $suffix)) {
            return substr($subject, 0, -strlen($suffix));
        }

        return $subject;
    }
}
