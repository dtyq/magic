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
     * Use SCAN command instead of KEYS command to return all keys matching the pattern.
     *
     * @param string $pattern Matching pattern (e.g., 'user:*')
     * @param int $count Number of elements returned per SCAN
     * @param int $maxIterations Maximum iterations to prevent infinite loops
     * @param int $timeout Timeout in seconds to prevent long blocking
     * @return array All keys matching the pattern
     * @throws RuntimeException When maximum iterations are exceeded or timeout occurs
     */
    public static function scanKeys(string $pattern, int $count = 100, int $maxIterations = 1000, int $timeout = 3): array
    {
        $redis = di(Redis::class);
        $keys = [];
        $iterator = null; // PhpRedis 第一次必须是 null，不能是 0
        $iterations = 0;
        $startTime = time();

        while (true) {
            // Check timeout
            if (time() - $startTime > $timeout) {
                throw new RuntimeException("Redis scan operation timeout after {$timeout} seconds");
            }

            // Check maximum iterations
            if (++$iterations > $maxIterations) {
                throw new RuntimeException("Redis scan operation exceeded maximum iterations ({$maxIterations})");
            }

            $batchKeys = $redis->scan($iterator, $pattern, $count);

            if ($batchKeys !== false && is_array($batchKeys)) {
                $keys[] = $batchKeys;
            }

            // When iterator is 0 or false, scanning is complete
            // 注意：第一次 iterator 是 null，scan 后会变成数字或 0
            /* @phpstan-ignore-next-line */
            if ($iterator === 0 || $iterator === false || $iterator === '0') {
                break;
            }
        }
        /* @phpstan-ignore-next-line */
        ! empty($keys) && $keys = array_merge(...$keys);
        return $keys;
    }
}
