<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Http;

use App\Infrastructure\Util\Http\Middleware\ProxyMiddleware;
use GuzzleHttp\Client;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\RequestOptions;

/**
 * Guzzle HTTP 客户端工厂
 * 基于中间件架构，支持灵活的配置和扩展.
 */
class GuzzleClientFactory
{
    /**
     * 创建 HTTP 客户端.
     *
     * @param array $options 自定义 Guzzle 配置选项
     * @param null|string $proxyUrl 代理 URL（可选）
     */
    public static function createProxyClient(
        array $options = [],
        ?string $proxyUrl = null
    ): Client {
        // 创建中间件栈
        $stack = HandlerStack::create();

        if ($proxyUrl) {
            $stack->push(ProxyMiddleware::create($proxyUrl), 'proxy');
        }

        // 基础默认配置
        $defaultOptions = [
            RequestOptions::TIMEOUT => 180,
            RequestOptions::CONNECT_TIMEOUT => 5,
            RequestOptions::VERIFY => false,
            RequestOptions::HEADERS => [],
            'handler' => $stack,
        ];

        // 合并配置
        $finalOptions = array_replace_recursive($defaultOptions, $options);

        return new Client($finalOptions);
    }
}
