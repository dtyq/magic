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
        $iterator = 0; // PhpRedis uses 0 as initial iterator
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
            if ($batchKeys !== false) {
                $keys[] = $batchKeys;
            }

            // When iterator is 0, scanning is complete
            /* @phpstan-ignore-next-line */
            if ($iterator == 0) {
                break;
            }
        }

        ! empty($keys) && $keys = array_merge(...$keys);
        return $keys;
    }
}
