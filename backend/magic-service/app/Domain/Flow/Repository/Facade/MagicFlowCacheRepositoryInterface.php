<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowCacheEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;

/**
 * Flow缓存仓储接口.
 */
interface MagicFlowCacheRepositoryInterface
{
    /**
     * Save cache entity (create or update based on entity state).
     */
    public function save(FlowDataIsolation $dataIsolation, MagicFlowCacheEntity $entity): MagicFlowCacheEntity;

    /**
     * Find cache by prefix and key (using hash internally).
     */
    public function findByPrefixAndKey(FlowDataIsolation $dataIsolation, string $cachePrefix, string $cacheKey): ?MagicFlowCacheEntity;

    /**
     * Delete cache by prefix and key (using hash internally).
     */
    public function deleteByPrefixAndKey(FlowDataIsolation $dataIsolation, string $cachePrefix, string $cacheKey): bool;

    public function delete(FlowDataIsolation $dataIsolation, MagicFlowCacheEntity $entity): bool;
}
