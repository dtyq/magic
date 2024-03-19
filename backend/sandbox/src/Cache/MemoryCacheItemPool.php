<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Cache;

use Closure;
use Exception;
use Generator;
use InvalidArgumentException;
use Psr\Cache\CacheItemInterface;
use Psr\Cache\CacheItemPoolInterface;

use function count;
use function is_scalar;
use function is_string;

use const PHP_INT_MAX;

class MemoryCacheItemPool implements CacheItemPoolInterface
{
    private bool $storeSerialized;

    private array $values = [];

    private array $expiries = [];

    private int $defaultLifetime;

    private float $maxLifetime;

    private int $maxItems;

    private static Closure $createCacheItem;

    private static MemoryCacheItemPool $instance;

    public function __construct(int $defaultLifetime = 0, bool $storeSerialized = true, float $maxLifetime = 0, int $maxItems = 0)
    {
        if (0 > $maxLifetime) {
            throw new InvalidArgumentException(sprintf('Argument $maxLifetime must be positive, %F passed.', $maxLifetime));
        }

        if (0 > $maxItems) {
            throw new InvalidArgumentException(sprintf('Argument $maxItems must be a positive integer, %d passed.', $maxItems));
        }

        $this->defaultLifetime = $defaultLifetime;
        $this->storeSerialized = $storeSerialized;
        $this->maxLifetime = $maxLifetime;
        $this->maxItems = $maxItems;
        self::$createCacheItem ?? self::$createCacheItem = Closure::bind(
            static function ($key, $value, $isHit) {
                $item = new CacheItem();
                $item->key = $key;
                $item->value = $value;
                $item->isHit = $isHit;

                return $item;
            },
            null,
            CacheItem::class
        );
    }

    public static function getInstance(int $defaultLifetime = 0, bool $storeSerialized = true, float $maxLifetime = 0, int $maxItems = 0): self
    {
        if (empty(static::$instance)) {
            static::$instance = new self($defaultLifetime, $storeSerialized, $maxLifetime, $maxItems);
        }

        return static::$instance;
    }

    public function getItem(string $key): CacheItemInterface
    {
        if (! $isHit = $this->hasItem($key)) {
            $value = null;

            if (! $this->maxItems) {
                // Track misses in non-LRU mode only
                $this->values[$key] = null;
            }
        } else {
            $value = $this->storeSerialized ? $this->unfreeze($key, $isHit) : $this->values[$key];
        }

        return (self::$createCacheItem)($key, $value, $isHit);
    }

    public function getItems(array $keys = []): iterable
    {
        return $this->generateItems($keys, microtime(true), self::$createCacheItem);
    }

    public function hasItem(string $key): bool
    {
        if (isset($this->expiries[$key]) && $this->expiries[$key] > microtime(true)) {
            if ($this->maxItems) {
                // Move the item last in the storage
                $value = $this->values[$key];
                unset($this->values[$key]);
                $this->values[$key] = $value;
            }

            return true;
        }

        return isset($this->expiries[$key]) && ! $this->deleteItem($key);
    }

    public function clear(): bool
    {
        $this->values = $this->expiries = [];

        return true;
    }

    public function deleteItem(string $key): bool
    {
        unset($this->values[$key], $this->expiries[$key]);

        return true;
    }

    public function deleteItems(array $keys): bool
    {
        foreach ($keys as $key) {
            $this->deleteItem($key);
        }

        return true;
    }

    public function save(CacheItemInterface $item): bool
    {
        $item = (array) $item;
        $key = $item["\0*\0key"];
        $value = $item["\0*\0value"];
        $expiry = $item["\0*\0expiry"];

        $now = microtime(true);

        if ($expiry !== null) {
            if (! $expiry) {
                $expiry = PHP_INT_MAX;
            } else {
                $expiry += $now;
            }

            if ($expiry <= $now) {
                $this->deleteItem($key);

                return true;
            }
        }
        if ($this->storeSerialized && null === $value = $this->freeze($value, $key)) {
            return false;
        }
        if ($expiry === null && 0 < $this->defaultLifetime) {
            $expiry = $this->defaultLifetime;
            $expiry = $now + ($expiry > ($this->maxLifetime ?: $expiry) ? $this->maxLifetime : $expiry);
        } elseif ($this->maxLifetime && ($expiry === null || $expiry > $now + $this->maxLifetime)) {
            $expiry = $now + $this->maxLifetime;
        }

        if ($this->maxItems) {
            unset($this->values[$key]);

            // Iterate items and vacuum expired ones while we are at it
            foreach ($this->values as $k => $v) {
                if ($this->expiries[$k] > $now && count($this->values) < $this->maxItems) {
                    break;
                }

                unset($this->values[$k], $this->expiries[$k]);
            }
        }

        $this->values[$key] = $value;
        $this->expiries[$key] = $expiry ?? PHP_INT_MAX;

        return true;
    }

    public function saveDeferred(CacheItemInterface $item): bool
    {
        return $this->save($item);
    }

    public function commit(): bool
    {
        return true;
    }

    private function generateItems(array $keys, float $now, Closure $f): Generator
    {
        foreach ($keys as $i => $key) {
            if (! $isHit = isset($this->expiries[$key]) && ($this->expiries[$key] > $now || ! $this->deleteItem($key))) {
                $value = null;

                if (! $this->maxItems) {
                    // Track misses in non-LRU mode only
                    $this->values[$key] = null;
                }
            } else {
                if ($this->maxItems) {
                    // Move the item last in the storage
                    $value = $this->values[$key];
                    unset($this->values[$key]);
                    $this->values[$key] = $value;
                }

                $value = $this->storeSerialized ? $this->unfreeze($key, $isHit) : $this->values[$key];
            }
            unset($keys[$i]);

            yield $key => $f($key, $value, $isHit);
        }

        foreach ($keys as $key) {
            yield $key => $f($key, null, false);
        }
    }

    private function freeze($value, string $key)
    {
        if ($value === null) {
            return 'N;';
        }
        if (is_string($value)) {
            // Serialize strings if they could be confused with serialized objects or arrays
            if ($value === 'N;' || (isset($value[2]) && $value[1] === ':')) {
                return serialize($value);
            }
        } elseif (! is_scalar($value)) {
            try {
                $serialized = serialize($value);
            } catch (Exception $e) {
                unset($this->values[$key]);
                return;
            }
            // Keep value serialized if it contains any objects or any internal references
            if ($serialized[0] === 'C' || $serialized[0] === 'O' || preg_match('/;[OCRr]:[1-9]/', $serialized)) {
                return $serialized;
            }
        }

        return $value;
    }

    private function unfreeze(string $key, bool &$isHit)
    {
        if ('N;' === $value = $this->values[$key]) {
            return null;
        }
        if (is_string($value) && isset($value[2]) && $value[1] === ':') {
            try {
                $value = unserialize($value);
            } catch (Exception $e) {
                $value = false;
            }
            if ($value === false) {
                $value = null;
                $isHit = false;

                if (! $this->maxItems) {
                    $this->values[$key] = null;
                }
            }
        }

        return $value;
    }
}
