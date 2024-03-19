<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Redis;

use Hyperf\Codec\Json;
use Hyperf\Redis\Redis;

class GlobalConfigCacheUtil
{
    private const CACHE_KEY_GLOBAL_CONFIG = 'globalConfig:all';

    private const CACHE_KEY_GLOBAL_DATA_QUERIES = 'globalDataQueries:user:%s:builtin:%s:query_type:%s';

    private const TTL_GLOBAL_CONFIG = 300; // 5 minutes

    private const TTL_GLOBAL_DATA_QUERIES = 180; // 3 minutes

    /**
     * Generate cache key for global config.
     */
    public static function getGlobalConfigKey(): string
    {
        return self::CACHE_KEY_GLOBAL_CONFIG;
    }

    /**
     * Generate cache key for global data queries.
     *
     * @param string $userId User ID
     * @param bool $withBuiltin Whether to include builtin items
     * @param array $queryType Array of query types
     */
    public static function getGlobalDataQueriesKey(string $userId, bool $withBuiltin, array $queryType): string
    {
        return sprintf(
            self::CACHE_KEY_GLOBAL_DATA_QUERIES,
            $userId,
            $withBuiltin ? '1' : '0',
            implode(',', $queryType)
        );
    }

    /**
     * Get data from cache and decode JSON.
     *
     * @param string $cacheKey Cache key
     * @return array|false Return decoded array if cache hit, false if cache miss
     */
    public static function get(string $cacheKey): array|false
    {
        $redis = di(Redis::class);
        $cachedData = $redis->get($cacheKey);

        if ($cachedData === false) {
            return false;
        }

        return Json::decode($cachedData);
    }

    /**
     * Set data to cache with JSON encoding.
     *
     * @param string $cacheKey Cache key
     * @param array $data Data to cache
     * @param int $ttl TTL in seconds
     */
    public static function set(string $cacheKey, array $data, int $ttl): bool
    {
        $redis = di(Redis::class);
        return $redis->setex($cacheKey, $ttl, Json::encode($data));
    }

    /**
     * Set global config data to cache.
     *
     * @param array $data Data to cache
     */
    public static function setGlobalConfig(array $data): bool
    {
        return self::set(self::getGlobalConfigKey(), $data, self::TTL_GLOBAL_CONFIG);
    }

    /**
     * Set global data queries to cache.
     *
     * @param string $userId User ID
     * @param bool $withBuiltin Whether to include builtin items
     * @param array $queryType Array of query types
     * @param array $data Data to cache
     */
    public static function setGlobalDataQueries(string $userId, bool $withBuiltin, array $queryType, array $data): bool
    {
        $cacheKey = self::getGlobalDataQueriesKey($userId, $withBuiltin, $queryType);
        return self::set($cacheKey, $data, self::TTL_GLOBAL_DATA_QUERIES);
    }

    /**
     * Delete cache by key.
     *
     * @param string $cacheKey Cache key
     */
    public static function delete(string $cacheKey): int
    {
        $redis = di(Redis::class);
        return $redis->del($cacheKey);
    }

    /**
     * Delete global config cache.
     */
    public static function deleteGlobalConfig(): int
    {
        return self::delete(self::getGlobalConfigKey());
    }

    /**
     * Delete global data queries cache.
     *
     * @param string $userId User ID
     * @param bool $withBuiltin Whether to include builtin items
     * @param array $queryType Array of query types
     */
    public static function deleteGlobalDataQueries(string $userId, bool $withBuiltin, array $queryType): int
    {
        $cacheKey = self::getGlobalDataQueriesKey($userId, $withBuiltin, $queryType);
        return self::delete($cacheKey);
    }

    /**
     * Delete all global data queries cache for a specific user by pattern.
     *
     * @param string $userId User ID
     */
    public static function deleteAllUserGlobalDataQueries(string $userId): int
    {
        $pattern = sprintf('globalDataQueries:user:%s:*', $userId);
        return self::deleteCacheByPattern($pattern);
    }

    /**
     * Delete all global data queries cache for all users.
     * This should be called when global data (agents, mcp servers, tool sets, etc.) changes.
     */
    public static function deleteAllGlobalDataQueries(): int
    {
        $pattern = 'globalDataQueries:user:*';
        return self::deleteCacheByPattern($pattern);
    }

    /**
     * Delete cache keys by pattern in batches.
     * Deletes at most 200 keys per batch to avoid blocking Redis.
     *
     * @param string $pattern Redis key pattern
     * @param int $batchSize Maximum number of keys to delete per batch
     * @return int Total number of keys deleted
     */
    private static function deleteCacheByPattern(string $pattern, int $batchSize = 200): int
    {
        $keys = RedisUtil::scanKeys($pattern);

        if (empty($keys)) {
            return 0;
        }

        $redis = di(Redis::class);
        $totalDeleted = 0;

        // Delete in batches to avoid blocking Redis
        $chunks = array_chunk($keys, $batchSize);
        foreach ($chunks as $chunk) {
            $totalDeleted += $redis->del(...$chunk);
        }

        return $totalDeleted;
    }
}
