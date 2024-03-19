<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Redis;

use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use Hyperf\Codec\Json;
use Hyperf\Redis\Redis;

class ProviderModelCacheUtil
{
    private const CACHE_KEY_PROVIDER_MODELS = 'providerModels:org:%s:user:%s:query:%s';

    private const TTL_PROVIDER_MODELS = 300; // 5 minutes

    /**
     * Generate cache key for provider models query.
     *
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     * @param ProviderModelQuery $query Query parameters
     */
    public static function getProviderModelsKey(string $organizationCode, string $userId, ProviderModelQuery $query): string
    {
        $queryHash = self::generateQueryHash($query);
        return sprintf(
            self::CACHE_KEY_PROVIDER_MODELS,
            $organizationCode,
            $userId,
            $queryHash
        );
    }

    /**
     * Get provider models from cache.
     *
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     * @param ProviderModelQuery $query Query parameters
     * @return array|false Return decoded array if cache hit, false if cache miss
     */
    public static function getProviderModels(string $organizationCode, string $userId, ProviderModelQuery $query): array|false
    {
        $cacheKey = self::getProviderModelsKey($organizationCode, $userId, $query);
        return self::get($cacheKey);
    }

    /**
     * Set provider models to cache.
     *
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     * @param ProviderModelQuery $query Query parameters
     * @param array $data Data to cache
     */
    public static function setProviderModels(string $organizationCode, string $userId, ProviderModelQuery $query, array $data): bool
    {
        $cacheKey = self::getProviderModelsKey($organizationCode, $userId, $query);
        return self::set($cacheKey, $data, self::TTL_PROVIDER_MODELS);
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
     * Delete provider models cache for specific query.
     *
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     * @param ProviderModelQuery $query Query parameters
     */
    public static function deleteProviderModels(string $organizationCode, string $userId, ProviderModelQuery $query): int
    {
        $cacheKey = self::getProviderModelsKey($organizationCode, $userId, $query);
        return self::delete($cacheKey);
    }

    /**
     * Delete all provider models cache for a specific user in an organization.
     *
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     */
    public static function deleteUserProviderModels(string $organizationCode, string $userId): int
    {
        $pattern = sprintf('providerModels:org:%s:user:%s:*', $organizationCode, $userId);
        return self::deleteCacheByPattern($pattern);
    }

    /**
     * Delete all provider models cache for a specific organization.
     * This should be called when provider configurations or models change.
     *
     * @param string $organizationCode Organization code
     */
    public static function deleteOrganizationProviderModels(string $organizationCode): int
    {
        $pattern = sprintf('providerModels:org:%s:*', $organizationCode);
        return self::deleteCacheByPattern($pattern);
    }

    /**
     * Delete all provider models cache.
     * This should be called when global provider data changes.
     */
    public static function deleteAllProviderModels(): int
    {
        $pattern = 'providerModels:org:*';
        return self::deleteCacheByPattern($pattern);
    }

    /**
     * Generate a hash from ProviderModelQuery to use as cache key part.
     *
     * @param ProviderModelQuery $query Query object
     * @return string Hash string
     */
    private static function generateQueryHash(ProviderModelQuery $query): string
    {
        $queryData = [
            'status' => $query->getStatus()?->value,
            'category' => $query->getCategory()?->value,
            'modelType' => $query->getModelType()?->value,
            'superMagicDisplay' => $query->getSuperMagicDisplay(),
            'providerConfigIds' => $query->getProviderConfigIds() ? implode(',', $query->getProviderConfigIds()) : null,
            'isOffice' => $query->isOffice(),
            'isModelIdFilter' => $query->isModelIdFilter(),
            'modelIds' => $query->getModelIds() ? implode(',', $query->getModelIds()) : null,
        ];

        // Filter out null values and generate hash
        $filteredData = array_filter($queryData, fn ($value) => $value !== null);
        return md5(Json::encode($filteredData));
    }

    /**
     * Get data from cache and decode JSON.
     *
     * @param string $cacheKey Cache key
     * @return array|false Return decoded array if cache hit, false if cache miss
     */
    private static function get(string $cacheKey): array|false
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
    private static function set(string $cacheKey, array $data, int $ttl): bool
    {
        $redis = di(Redis::class);
        return $redis->setex($cacheKey, $ttl, Json::encode($data));
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
