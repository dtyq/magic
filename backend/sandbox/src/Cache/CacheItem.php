<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Cache;

use DateInterval;
use DateTimeInterface;
use Psr\Cache\CacheItemInterface;

class CacheItem implements CacheItemInterface
{
    protected string $key;

    protected mixed $value = null;

    protected bool $isHit = false;

    protected null|DateInterval|int $expiry = null;

    public function getKey(): string
    {
        return $this->key;
    }

    public function get(): mixed
    {
        return $this->value;
    }

    public function isHit(): bool
    {
        return $this->isHit;
    }

    public function set(mixed $value): static
    {
        $this->value = $value;

        return $this;
    }

    public function expiresAt(?DateTimeInterface $expiration): static
    {
        $this->expiry = $expiration !== null ? $expiration->getTimestamp() - time() : null;

        return $this;
    }

    public function expiresAfter(null|DateInterval|int $time): static
    {
        $this->expiry = $time;

        return $this;
    }
}
