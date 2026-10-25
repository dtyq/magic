<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Persistence;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Repository\Facade\AssetTagRelationRepositoryInterface;
use App\Domain\Asset\Repository\Persistence\Model\AssetTagRelationModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

/** 素材与标签的多对多关系；替换标签时先删后插，避免遗留关联。 */
class AssetTagRelationRepository implements AssetTagRelationRepositoryInterface
{
    public function syncAssetTags(AssetDataIsolation $dataIsolation, int|string $assetId, array $tagIds, string $createdUid): void
    {
        $this->deleteByAssetId($dataIsolation, $assetId);
        $tagIds = array_values(array_unique(array_filter(array_map('intval', $tagIds), static fn (int $id): bool => $id > 0)));
        if ($tagIds === []) {
            return;
        }
        $now = date('Y-m-d H:i:s');
        AssetTagRelationModel::query()->insert(array_map(static fn (int $tagId): array => [
            'id' => IdGenerator::getSnowId(), 'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'asset_id' => (int) $assetId, 'tag_id' => $tagId, 'created_uid' => $createdUid,
            'created_at' => $now, 'updated_at' => $now,
        ], $tagIds));
    }

    public function deleteByAssetId(AssetDataIsolation $dataIsolation, int|string $assetId): void
    {
        AssetTagRelationModel::query()->whereIn('organization_code', $dataIsolation->getOrganizationCodes())->where('asset_id', $assetId)->delete();
    }

    /** @return int[] */
    public function findTagIdsByAssetId(AssetDataIsolation $dataIsolation, int|string $assetId): array
    {
        return AssetTagRelationModel::query()->whereIn('organization_code', $dataIsolation->getOrganizationCodes())->where('asset_id', $assetId)->pluck('tag_id')->map(static fn ($id): int => (int) $id)->all();
    }

    /** @return array<string, int[]> */
    public function findTagIdsByAssetIds(AssetDataIsolation $dataIsolation, array $assetIds): array
    {
        $assetIds = array_values(array_unique(array_filter(array_map('intval', $assetIds), static fn (int $id): bool => $id > 0)));
        if ($assetIds === []) {
            return [];
        }
        $relations = AssetTagRelationModel::query()
            ->whereIn('organization_code', $dataIsolation->getOrganizationCodes())
            ->whereIn('asset_id', $assetIds)
            ->get(['asset_id', 'tag_id']);
        $result = [];
        foreach ($relations as $relation) {
            $result[(string) $relation->asset_id][] = (int) $relation->tag_id;
        }
        return $result;
    }

    public function deleteByTagId(AssetDataIsolation $dataIsolation, int|string $tagId): void
    {
        AssetTagRelationModel::query()
            ->whereIn('organization_code', $dataIsolation->getOrganizationCodes())
            ->where('tag_id', $tagId)
            ->delete();
    }

    /** @return int[] */
    public function findAssetIdsByTagId(AssetDataIsolation $dataIsolation, int|string $tagId): array
    {
        return AssetTagRelationModel::query()
            ->whereIn('organization_code', $dataIsolation->getOrganizationCodes())
            ->where('tag_id', $tagId)
            ->pluck('asset_id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
    }
}
