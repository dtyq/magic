<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

/**
 * HTTP 请求工具类
 * 提供请求头相关的通用方法.
 */
class RequestUtil
{
    /**
     * 从请求头获取 API-Key.
     *
     * 支持以下格式：
     * 1. Header: api-key: xxx
     * 2. Header: x-api-key: xxx
     *
     * @param array<string, array<string>|string> $headers 请求头数组（PSR-7 格式）
     * @return string API-Key 的值，如果不存在则返回空字符串
     */
    public static function getApiKeyHeader(array $headers): string
    {
        $normalized = self::normalizeHeaders($headers);

        // 优先从 api-key header 获取
        $apiKey = $normalized['api-key'] ?? '';
        if ($apiKey !== '') {
            return $apiKey;
        }

        // 从 x-api-key header 获取
        $apiKey = $normalized['x-api-key'] ?? '';
        if ($apiKey !== '') {
            return $apiKey;
        }
        return '';
    }

    /**
     * 标准化请求头：将键名转为小写，值转为字符串.
     *
     * @param array<string, array<string>|string> $headers 请求头数组
     * @return array<string, string> 标准化后的请求头数组
     */
    public static function normalizeHeaders(array $headers): array
    {
        $normalized = [];
        foreach ($headers as $name => $values) {
            $lowerName = strtolower($name);
            $normalized[$lowerName] = is_array($values) && ! empty($values) ? $values[0] : (string) $values;
        }
        return $normalized;
    }

    /**
     * 解析 Authorization header 值
     * 如果以 Bearer 开头（忽略大小写），则去除该前缀
     *
     * @param string $authorization Authorization header 值
     * @return string 处理后的 token
     */
    public static function parseAuthorizationToken(string $authorization): string
    {
        if ($authorization === '') {
            return '';
        }

        if (stripos($authorization, 'bearer ') === 0) {
            return substr($authorization, 7);
        }

        return $authorization;
    }
}
