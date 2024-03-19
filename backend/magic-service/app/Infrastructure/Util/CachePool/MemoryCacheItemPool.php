<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\CachePool;

use Psr\Cache\CacheItemInterface;
use Psr\Cache\CacheItemPoolInterface;
use Symfony\Component\Cache\Adapter\ArrayAdapter;

class MemoryCacheItemPool implements CacheItemPoolInterface
{
    private static CacheItemPoolInterface $pool;

    public function __construct(int $defaultLifetime = 0, bool $storeSerialized = true, float $maxLifetime = 0, int $maxItems = 0)
    {
        if (empty(self::$pool)) {
            self::$pool = new ArrayAdapter($defaultLifetime, $storeSerialized, $maxLifetime, $maxItems);
        }
    }

    public function getItem(string $key): CacheItemInterface
    {
        return self::$pool->getItem($key);
    }

    public function getItems(array $keys = []): iterable
    {
        return self::$pool->getItems($keys);
    }

    public function hasItem(string $key): bool
    {
        return self::$pool->hasItem($key);
    }

    public function clear(): bool
    {
        return self::$pool->clear();
    }

    public function deleteItem(string $key): bool
    {
        return self::$pool->deleteItem($key);
    }

    public function deleteItems(array $keys): bool
    {
        return self::$pool->deleteItems($keys);
    }

    public function save(CacheItemInterface $item): bool
    {
        return self::$pool->save($item);
    }

    public function saveDeferred(CacheItemInterface $item): bool
    {
        return self::$pool->saveDeferred($item);
    }

    public function commit(): bool
    {
        return self::$pool->commit();
    }
}
