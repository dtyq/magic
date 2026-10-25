<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Facade;

use App\Domain\Asset\Entity\AssetDataIsolation;

interface AssetTagRelationRepositoryInterface
{
    /** @param int[] $tagIds */
    public function syncAssetTags(AssetDataIsolation $dataIsolation, int|string $assetId, array $tagIds, string $createdUid): void;

    public function deleteByAssetId(AssetDataIsolation $dataIsolation, int|string $assetId): void;

    public function deleteByTagId(AssetDataIsolation $dataIsolation, int|string $tagId): void;

    /** @return int[] */
    public function findTagIdsByAssetId(AssetDataIsolation $dataIsolation, int|string $assetId): array;

    /**
     * Batch lookup of the tag IDs of several assets: one query instead of one per asset.
     *
     * @param array<int, int|string> $assetIds
     * @return array<string, int[]> keyed by asset ID; assets without tags are absent
     */
    public function findTagIdsByAssetIds(AssetDataIsolation $dataIsolation, array $assetIds): array;

    /** @return int[] */
    public function findAssetIdsByTagId(AssetDataIsolation $dataIsolation, int|string $tagId): array;
}
