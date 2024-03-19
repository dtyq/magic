<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Runtime;

class RuntimeContainer
{
    /** @var RuntimeProxy[] */
    private static array $proxies;

    /** @var array<int> */
    private static array $refCount = [];

    public static function set(RuntimeProxy $runtimeProxy): void
    {
        if (! isset(static::$proxies[$runtimeProxy->getHash()])) {
            static::$refCount[$runtimeProxy->getHash()] = 1;
        } else {
            ++static::$refCount[$runtimeProxy->getHash()];
        }

        if (isset(static::$proxies[$runtimeProxy->getHash()])) {
            return;
        }

        static::$proxies[$runtimeProxy->getHash()] = $runtimeProxy;
    }

    public static function get(string $hash): ?RuntimeProxy
    {
        return static::$proxies[$hash] ?? null;
    }

    public static function destroy(RuntimeProxy $runtimeProxy): void
    {
        if (! isset(static::$proxies[$runtimeProxy->getHash()])) {
            return;
        }

        --static::$refCount[$runtimeProxy->getHash()];
        if (static::$refCount[$runtimeProxy->getHash()] > 0) {
            return;
        }

        unset(static::$proxies[$runtimeProxy->getHash()]);
    }
}
