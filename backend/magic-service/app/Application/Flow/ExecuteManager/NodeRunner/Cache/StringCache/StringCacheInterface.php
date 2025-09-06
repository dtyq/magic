<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Cache\StringCache;

use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;

interface StringCacheInterface
{
    /**
     * Set cache value.
     */
    public function set(FlowDataIsolation $dataIsolation, string $prefix, string $key, string $value, int $ttl = 7200): bool;

    /**
     * Get cache value.
     */
    public function get(FlowDataIsolation $dataIsolation, string $prefix, string $key, string $default = ''): string;

    /**
     * Delete cache value.
     */
    public function del(FlowDataIsolation $dataIsolation, string $prefix, string $key): bool;
}
