<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Facade;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetTagEntity;

interface AssetTagRepositoryInterface
{
    /** @return AssetTagEntity[] */
    public function queryVisible(AssetDataIsolation $dataIsolation, ?string $ownerUid = null, ?string $businessType = null): array;

    /** @return AssetTagEntity[] */
    public function queryVisibleTree(AssetDataIsolation $dataIsolation, ?string $ownerUid = null, ?string $businessType = null): array;

    public function findById(AssetDataIsolation $dataIsolation, int|string $id): ?AssetTagEntity;

    /**
     * Batch lookup by ID, mirroring findById: no status filter, missing IDs are absent.
     *
     * @param array<int, int|string> $ids
     * @return array<string, AssetTagEntity> keyed by tag ID
     */
    public function findByIds(AssetDataIsolation $dataIsolation, array $ids): array;

    public function findOfficialByName(AssetDataIsolation $dataIsolation, array $nameI18n, string $nodeType, int $parentId): ?AssetTagEntity;

    public function save(AssetDataIsolation $dataIsolation, AssetTagEntity $entity): AssetTagEntity;

    public function delete(AssetDataIsolation $dataIsolation, int|string $id, ?string $ownerUid = null): bool;

    public function hasChildren(AssetDataIsolation $dataIsolation, int|string $parentId): bool;
}
