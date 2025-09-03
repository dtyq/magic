<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Cache\StringCache;

use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use Psr\SimpleCache\CacheInterface;

/**
 * Redis-based string cache implementation.
 */
class RedisStringCache implements StringCacheInterface
{
    private string $keyPrefix = 'MagicFlowStringCache';

    public function __construct(private readonly CacheInterface $cache)
    {
    }

    public function set(FlowDataIsolation $dataIsolation, string $prefix, string $key, string $value, int $ttl = 7200): bool
    {
        return $this->cache->set($this->generateKey($prefix, $key), $value, $ttl);
    }

    public function get(FlowDataIsolation $dataIsolation, string $prefix, string $key, string $default = ''): string
    {
        return $this->cache->get($this->generateKey($prefix, $key), $default);
    }

    public function del(FlowDataIsolation $dataIsolation, string $prefix, string $key): bool
    {
        return $this->cache->delete($this->generateKey($prefix, $key));
    }

    private function generateKey(string $prefix, string $key): string
    {
        return "{$this->keyPrefix}:{$prefix}:{$key}";
    }
}
