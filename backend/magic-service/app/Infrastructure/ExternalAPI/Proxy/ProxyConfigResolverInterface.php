<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Proxy;

interface ProxyConfigResolverInterface
{
    /**
     * @return null|string 返回格式如 "socks5h://user:pass@host:port"
     */
    public function resolve(array $config = []): ?string;
}
