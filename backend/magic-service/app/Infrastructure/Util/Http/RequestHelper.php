<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Http;

use Hyperf\HttpServer\Contract\RequestInterface;
use Throwable;

/**
 * HTTP请求工具类.
 */
class RequestHelper
{
    /**
     * 获取客户端真实IP地址.
     *
     * 优先级：
     * 1. X-Original-Forwarded-For（原始转发IP）
     * 2. X-Real-IP（Nginx代理真实IP）
     * 3. X-Forwarded-For（代理转发的原始IP，取第一个）
     * 4. remote_addr（直接连接IP）
     *
     * @param RequestInterface $request HTTP请求对象
     * @return null|string 客户端IP地址，获取失败返回null
     */
    public static function getClientIp(RequestInterface $request): ?string
    {
        // 1. 尝试从 X-Original-Forwarded-For 获取
        $ip = $request->getHeaderLine('x-original-forwarded-for');
        if (! empty($ip)) {
            $ips = explode(',', $ip);
            $realIp = trim($ips[0]);
            if (self::isValidIp($realIp)) {
                return $realIp;
            }
        }

        // 2. 尝试从 X-Real-IP 获取
        $ip = $request->getHeaderLine('x-real-ip');
        if (! empty($ip) && self::isValidIp($ip)) {
            return $ip;
        }

        // 3. 尝试从 X-Forwarded-For 获取（可能包含多个IP，取第一个）
        $ip = $request->getHeaderLine('x-forwarded-for');
        if (! empty($ip)) {
            $ips = explode(',', $ip);
            $realIp = trim($ips[0]);
            if (self::isValidIp($realIp)) {
                return $realIp;
            }
        }

        // 4. 从服务器参数获取直接连接的IP
        $serverParams = $request->getServerParams();
        $ip = $serverParams['remote_addr'] ?? null;

        if ($ip && self::isValidIp($ip)) {
            return $ip;
        }

        return null;
    }

    /**
     * 获取User-Agent.
     *
     * @param RequestInterface $request HTTP请求对象
     * @return null|string User-Agent字符串，获取失败返回null
     */
    public static function getUserAgent(RequestInterface $request): ?string
    {
        $userAgent = $request->getHeaderLine('user-agent');
        return ! empty($userAgent) ? $userAgent : null;
    }

    /**
     * 获取请求方法.
     *
     * @param RequestInterface $request HTTP请求对象
     * @return null|string 请求方法（GET/POST/PUT/DELETE等），获取失败返回null
     */
    public static function getMethod(RequestInterface $request): ?string
    {
        return strtoupper($request->getMethod());
    }

    /**
     * 获取请求URI.
     *
     * @param RequestInterface $request HTTP请求对象
     * @return null|string 请求URI，获取失败返回null
     */
    public static function getUri(RequestInterface $request): ?string
    {
        return $request->getUri()->getPath();
    }

    /**
     * 获取完整的请求信息（用于日志记录）.
     *
     * @param RequestInterface $request HTTP请求对象
     * @return array 包含IP、Method、URI、UserAgent的数组（值可能为null）
     */
    public static function getRequestInfo(RequestInterface $request): array
    {
        return [
            'ip' => self::getClientIp($request),
            'method' => self::getMethod($request),
            'uri' => self::getUri($request),
            'user_agent' => self::getUserAgent($request),
        ];
    }

    /**
     * 获取完整的请求URL（包含方法、协议、域名、路径及查询参数）.
     * GET 请求的 query 优先用 getQueryParams() 拼接，避免 fullUrl() 依赖的 query_string 为空导致参数丢失.
     *
     * @param RequestInterface $request HTTP请求对象
     * @return null|string 完整URL，格式：GET https://example.com/api/users?page=1&page_size=10
     */
    public static function getFullUrl(RequestInterface $request): ?string
    {
        try {
            $method = self::getMethod($request) ?? 'UNKNOWN';
            $queryParams = $request->getQueryParams();
            if ($queryParams !== []) {
                $baseUrl = $request->url();
                $url = $baseUrl . '?' . http_build_query($queryParams);
            } else {
                // 无 query 时用 url()，避免 fullUrl() 在 query 为空时仍拼上结尾的 ?
                $url = $request->url();
                if ($url === '') {
                    $url = rtrim(preg_replace('/\?.*/', '', (string) $request->getUri()), '/');
                }
            }

            return sprintf('%s %s', $method, $url);
        } catch (Throwable $e) {
            // 获取失败返回 null
            return null;
        }
    }

    /**
     * 获取请求体内容（JSON格式）.
     *
     * @param RequestInterface $request HTTP请求对象
     * @return null|string 请求体内容，JSON字符串格式
     */
    public static function getRequestBody(RequestInterface $request): ?string
    {
        try {
            $method = self::getMethod($request);

            // 只记录可能有 body 的请求方法
            if (! in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'])) {
                return null;
            }

            /**
             * 重要：这里不能读取 body stream（getContents），否则可能消费掉主流程后续读取的内容。
             * 只基于已解析的 parsedBody 记录，拿不到就返回 null，绝不影响业务执行。
             */
            $parsedBody = $request->getParsedBody();

            if (is_array($parsedBody)) {
                $data = self::filterSensitiveFields($parsedBody);
                return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }

            if (is_string($parsedBody) && $parsedBody !== '') {
                return mb_substr($parsedBody, 0, 10000);
            }

            return null;
        } catch (Throwable $e) {
            // 获取失败返回 null
            return null;
        }
    }

    /**
     * 过滤敏感字段.
     *
     * @param array $data 请求数据
     * @return array 过滤后的数据
     */
    private static function filterSensitiveFields(array $data): array
    {
        // 敏感字段列表
        $sensitiveFields = [
            'password',
            'password_confirmation',
            'old_password',
            'new_password',
            'token',
            'access_token',
            'refresh_token',
            'secret',
            'api_key',
            'private_key',
            'credit_card',
            'card_number',
            'cvv',
            'ssn',
        ];

        foreach ($data as $key => $value) {
            // 检查是否是敏感字段（不区分大小写）
            if (in_array(strtolower($key), $sensitiveFields)) {
                $data[$key] = '***FILTERED***';
                continue;
            }

            // 递归处理嵌套数组
            if (is_array($value)) {
                $data[$key] = self::filterSensitiveFields($value);
            }
        }

        return $data;
    }

    /**
     * 验证IP地址是否有效.
     *
     * @param string $ip IP地址
     * @return bool 是否为有效的IPv4或IPv6地址
     */
    private static function isValidIp(string $ip): bool
    {
        return filter_var($ip, FILTER_VALIDATE_IP) !== false;
    }
}
