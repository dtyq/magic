<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Knowledge;

use Hyperf\Redis\Redis;

class VectorProgress
{
    private Redis $redis;

    public function __construct(Redis $redis)
    {
        $this->redis = $redis;
    }

    /**
     * 追加总数.
     */
    public function additionalTotal(string $key, int $num): void
    {
        $key = $this->getProgressKey($key);
        $this->redis->hIncrBy($key, 'total', $num);
    }

    /**
     * 追加完成数.
     */
    public function additionalComplete(string $key, int $num): void
    {
        $key = $this->getProgressKey($key);
        $this->redis->hIncrBy($key, 'complete', $num);
    }

    /**
     * 获取进度.
     */
    public function getProgress(string $key): array
    {
        $key = $this->getProgressKey($key);
        $data = $this->redis->hGetAll($key);
        if (! array_key_exists('total', $data)) {
            $this->redis->hSet($key, 'total', '0');
        }
        if (! array_key_exists('complete', $data)) {
            $this->redis->hSet($key, 'complete', '0');
        }
        return $this->redis->hGetAll($key);
    }

    public function clearProgress(string $key): void
    {
        $key = $this->getProgressKey($key);
        $this->redis->del($key);
    }

    private function getProgressKey(string $key): string
    {
        return 'vector_progress:' . $key;
    }
}
