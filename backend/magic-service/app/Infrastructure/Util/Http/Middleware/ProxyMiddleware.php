<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Http\Middleware;

use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Http\Message\RequestInterface;
use Throwable;

/**
 * Guzzle 代理中间件
 * 支持动态设置 HTTP/HTTPS/SOCKS5/SOCKS5H 代理.
 */
class ProxyMiddleware
{
    /**
     * 创建代理中间件.
     *
     * @param null|string $proxyUrl 代理 URL（如 "socks5h://user:pass@host:port"）
     */
    public static function create(?string $proxyUrl): callable
    {
        return function (callable $handler) use ($proxyUrl) {
            return function (RequestInterface $request, array $options) use ($handler, $proxyUrl) {
                $logger = self::getLogger();

                // 优先使用 options 中的 proxy_url
                $effectiveProxyUrl = $options['proxy_url'] ?? $proxyUrl;

                if ($effectiveProxyUrl) {
                    $logger->info('🌐 启用代理转发');

                    // 移除自定义参数，避免传递给 Guzzle
                    unset($options['proxy_url']);

                    // 添加代理配置
                    $proxyConfig = self::buildProxyConfig($effectiveProxyUrl);

                    // 智能合并 curl 选项（如果存在）
                    if (isset($proxyConfig['curl'], $options['curl'])) {
                        $options['curl'] = array_merge($options['curl'], $proxyConfig['curl']);
                        unset($proxyConfig['curl']);
                    }

                    $options = array_merge($options, $proxyConfig);

                    $logger->info('✅ 代理配置应用成功');
                } else {
                    $logger->info('🔓 直连模式（无代理）');
                }

                try {
                    $logger->info('📤 转发请求到 handler');
                    $response = $handler($request, $options);
                    $logger->info('📥 收到 handler 响应');
                    return $response;
                } catch (Throwable $e) {
                    $logger->error('❌ 请求执行失败', [
                        'error_message' => $e->getMessage(),
                    ]);
                    throw $e;
                }
            };
        };
    }

    /**
     * 获取日志实例.
     */
    private static function getLogger()
    {
        return ApplicationContext::getContainer()->get(LoggerFactory::class)->get('ProxyMiddleware');
    }

    /**
     * 构建 Guzzle 代理配置.
     */
    private static function buildProxyConfig(string $proxyUrl): array
    {
        $config = [];

        // 检测是否为 SOCKS5 代理 (支持 socks5:// 和 socks5h://)
        $isSocks5 = str_starts_with($proxyUrl, 'socks5://') || str_starts_with($proxyUrl, 'socks5h://');

        if ($isSocks5) {
            // SOCKS5 代理需要使用 curl 选项
            // 解析代理配置，分离主机和认证信息
            $proxyWithoutScheme = str_replace(['socks5://', 'socks5h://'], '', $proxyUrl);

            // 检查是否包含认证信息 (username:password@host:port)
            if (str_contains($proxyWithoutScheme, '@')) {
                [$auth, $hostPort] = explode('@', $proxyWithoutScheme, 2);

                $config['curl'] = [
                    CURLOPT_PROXYTYPE => CURLPROXY_SOCKS5_HOSTNAME, // 使用 SOCKS5_HOSTNAME 让代理服务器解析域名
                    CURLOPT_PROXY => $hostPort,
                    CURLOPT_PROXYUSERPWD => $auth,
                ];
            } else {
                // 没有认证信息
                $config['curl'] = [
                    CURLOPT_PROXYTYPE => CURLPROXY_SOCKS5_HOSTNAME,
                    CURLOPT_PROXY => $proxyWithoutScheme,
                ];
            }
        } else {
            // HTTP/HTTPS 代理使用标准 proxy 选项
            $config['proxy'] = $proxyUrl;
        }

        return $config;
    }
}
