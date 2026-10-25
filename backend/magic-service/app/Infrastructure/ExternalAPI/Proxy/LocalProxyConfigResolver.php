<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Proxy;

use function Hyperf\Support\env;

/**
 * 本地调试代理解析器，使用环境变量地址而不读取数据库代理配置。
 */
class LocalProxyConfigResolver implements ProxyConfigResolverInterface
{
    /**
     * 已启用代理的服务商使用本地地址，未启用代理的服务商保持直连。
     */
    public function resolve(array $config = []): ?string
    {
        if (empty($config['use_proxy'])) {
            return null;
        }
        return (string) env('HTTP_CLIENT_PROXY', '');
    }
}
