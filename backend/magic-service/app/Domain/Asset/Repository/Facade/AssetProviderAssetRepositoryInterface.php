<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Facade;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\ProviderAssetEntity;
use App\Domain\Asset\Repository\Persistence\Model\AssetProviderAssetModel;

interface AssetProviderAssetRepositoryInterface
{
    /**
     * Provider 映射按 asset_id + provider 幂等保存。
     */
    public function saveMapping(AssetDataIsolation $dataIsolation, ProviderAssetEntity $providerAsset): AssetProviderAssetModel;

    public function findMapping(AssetDataIsolation $dataIsolation, int|string $assetId, string $providerCode): ?AssetProviderAssetModel;

    /**
     * @param array<int, int|string> $assetIds
     * @return array<string, ProviderAssetEntity>
     */
    public function findMappings(
        AssetDataIsolation $dataIsolation,
        array $assetIds,
        string $providerCode,
        string $projectName = '',
    ): array;

    /**
     * 批量取映射行（模型自带 updated_at），供批量合规查询判定审核超时。
     *
     * @param array<int, int|string> $assetIds
     * @return array<string, AssetProviderAssetModel> 素材主键 => 映射行
     */
    public function findMappingModels(
        AssetDataIsolation $dataIsolation,
        array $assetIds,
        string $providerCode,
    ): array;

    /**
     * 按内容指纹直接取一条已通过审核的凭证（单条 JOIN 查询）。
     */
    public function findPassedMappingByContentHash(
        string $contentHash,
        string $providerCode,
        string $organizationCode = '',
        string $userId = '',
    ): ?ProviderAssetEntity;

    /**
     * 统计同一第三方素材/素材组还被多少条其他映射引用。
     */
    public function countOtherReferences(ProviderAssetEntity $mapping): int;

    /**
     * 统计某个 Provider 实际占用的第三方素材与素材组数量。
     * @return array{assets: int, groups: int}
     */
    public function countProviderResourceUsage(string $providerCode): array;

    /**
     * 统计指定用户已通过审核的个人素材数量。
     */
    public function countPassedAssetsByUser(string $userId, string $providerCode): int;

    /**
     * 软删除一条映射；第三方资源确认回收后调用，保留行便于审计。
     */
    public function deleteMapping(
        AssetDataIsolation $dataIsolation,
        int|string $assetId,
        string $providerCode,
        string $projectName,
    ): bool;
}
