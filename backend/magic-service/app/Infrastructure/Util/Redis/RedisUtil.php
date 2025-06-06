<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Redis;

use Hyperf\Redis\Redis;
use RuntimeException;

class RedisUtil
{
    /**
     * 使用SCAN命令替代KEYS命令，返回匹配模式的所有键.
     *
     * @param string $pattern 匹配模式 (例如: 'user:*')
     * @param int $count 每次 SCAN 返回的元素数量
     * @param int $maxIterations 最大迭代次数，防止死循环
     * @param int $timeout 超时时间（秒），防止长时间阻塞
     * @return array 匹配模式的所有键
     * @throws RuntimeException 当超过最大迭代次数或超时时抛出异常
     */
    public static function scanKeys(string $pattern, int $count = 100, int $maxIterations = 1000, int $timeout = 3): array
    {
        $redis = di(Redis::class);
        $keys = [];
        $iterator = 0; // PhpRedis 使用 0 作为初始迭代器
        $iterations = 0;
        $startTime = time();

        while (true) {
            // 检查超时
            if (time() - $startTime > $timeout) {
                throw new RuntimeException("Redis scan operation timeout after {$timeout} seconds");
            }

            // 检查最大迭代次数
            if (++$iterations > $maxIterations) {
                throw new RuntimeException("Redis scan operation exceeded maximum iterations ({$maxIterations})");
            }

            $batchKeys = $redis->scan($iterator, $pattern, $count);
            if ($batchKeys !== false) {
                $keys[] = $batchKeys;
            }

            // 当迭代器为 0 时，说明扫描完成
            /* @phpstan-ignore-next-line */
            if ($iterator == 0) {
                break;
            }
        }

        ! empty($keys) && $keys = array_merge(...$keys);
        return $keys;
    }
}
