<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\SSRF;

use Throwable;

/**
 * SSRF防御工具类.
 *
 * 使用示例：
 * // 简单使用，默认配置
 * $safeUrl = SSRFUtil::getSafeUrl('https://example.com');
 *
 * // 自定义参数
 * $safeUrl = SSRFUtil::getSafeUrl('https://example.com', replaceIp: false, allowRedirect: true);
 *
 * // 高级配置
 * $safeUrl = SSRFUtil::getSafeUrl(
 *     'https://example.com',
 *     blackList: ['192.168.1.1'],
 *     whiteList: ['trusted.example.com'],
 *     replaceIp: false
 * );
 */
class SSRFUtil
{
    /**
     * 获取SSRF防御安全链接.
     *
     * @param string $url 需要检查的URL
     * @param array $blackList 黑名单IP或域名
     * @param array $whiteList 白名单IP或域名
     * @param array $allowProtocols 允许的协议
     * @param bool $replaceIp 是否替换为IP访问
     * @param bool $allowRedirect 是否允许重定向
     * @return string 安全的URL
     * @throws Exception\SSRFException 当URL不安全时抛出异常
     */
    public static function getSafeUrl(
        string $url,
        array $blackList = [],
        array $whiteList = [],
        array $allowProtocols = ['http', 'https'],
        bool $replaceIp = true,
        bool $allowRedirect = false
    ): string {
        $options = new SSRFDefenseOptions(
            $blackList,
            $whiteList,
            $allowProtocols,
            $replaceIp,
            $allowRedirect
        );

        $defense = new SSRFDefense($url, $options);
        return $defense->getSafeUrl($allowRedirect);
    }

    /**
     * 检查URL是否安全（不抛异常，返回布尔值）.
     *
     * @param string $url 需要检查的URL
     * @param array $blackList 黑名单IP或域名
     * @param array $whiteList 白名单IP或域名
     * @param array $allowProtocols 允许的协议
     * @param bool $replaceIp 是否替换为IP访问
     * @param bool $allowRedirect 是否允许重定向
     * @return bool 是否安全
     */
    public static function isSafeUrl(
        string $url,
        array $blackList = [],
        array $whiteList = [],
        array $allowProtocols = ['http', 'https'],
        bool $replaceIp = true,
        bool $allowRedirect = false
    ): bool {
        try {
            self::getSafeUrl($url, $blackList, $whiteList, $allowProtocols, $replaceIp, $allowRedirect);
            return true;
        } catch (Exception\SSRFException $e) {
            return false;
        }
    }

    /**
     * 获取URL对应的IP.
     *
     * @param string $url URL
     * @return null|string IP地址或null（如果解析失败）
     */
    public static function getUrlIp(string $url): ?string
    {
        try {
            $options = new SSRFDefenseOptions();
            $defense = new SSRFDefense($url, $options);
            return $defense->getIp();
        } catch (Throwable $e) {
            return null;
        }
    }
}
