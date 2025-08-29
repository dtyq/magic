<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * IP地址获取工具.
 */
class IpUtil
{
    /**
     * 获取客户端IP地址
     *
     * @param RequestInterface $request HTTP请求对象
     * @return null|string 客户端IP地址
     */
    public static function getClientIpAddress(RequestInterface $request): ?string
    {
        // 优先级顺序：X-Real-IP -> X-Forwarded-For -> remote_addr
        $realIp = $request->getHeaderLine('x-real-ip');
        if (! empty($realIp)) {
            return $realIp;
        }

        $forwardedFor = $request->getHeaderLine('x-forwarded-for');
        if (! empty($forwardedFor)) {
            // X-Forwarded-For 可能包含多个IP，取第一个
            $ips = explode(',', $forwardedFor);
            return trim($ips[0]);
        }

        $serverParams = $request->getServerParams();
        return $serverParams['remote_addr'] ?? null;
    }
}
