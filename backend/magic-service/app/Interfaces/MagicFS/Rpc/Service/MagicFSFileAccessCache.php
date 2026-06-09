<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MagicFS\Rpc\Service;

use Hyperf\Redis\Redis;

class MagicFSFileAccessCache
{
    public function __construct(
        private readonly Redis $redis,
    ) {
    }

    public function has(string $cacheKey): bool
    {
        return $this->redis->get($cacheKey) === '1';
    }

    public function put(string $cacheKey, int $ttl): void
    {
        $this->redis->setex($cacheKey, $ttl, '1');
    }
}
