<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Repository\Facade;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\ValueObject\Query\AssetQuery;
use App\Infrastructure\Core\ValueObject\Page;

/**
 * 定义资产实体的持久化、分页查询、内容去重和层级关系检查能力。
 * 所有需要数据隔离的方法都必须限制在调用方提供的组织范围内，避免跨组织读写资产记录。
 */
interface AssetRepositoryInterface
{
    /**
     * 保存新资产或覆盖已有资产，并返回数据库中的最新实体数据。
     * 具体实现负责补齐资产主键、组织编码和时间字段，确保后续第三方映射能够关联本地记录。
     */
    public function save(AssetDataIsolation $dataIsolation, AssetEntity $asset): AssetEntity;

    /**
     * 在组织隔离范围内按资产范围、类型和业务条件分页查询，并按创建时间及主键倒序返回。
     * 团队共享资产主键由应用层通过 {@see AssetQuery::setSharedAssetIds()} 传入，仓储不得跨领域读取权限表。
     *
     * @return array{total: int, list: AssetEntity[]} 符合条件的资产总数和当前页实体列表
     */
    public function queries(
        AssetDataIsolation $dataIsolation,
        AssetQuery $query,
        Page $page,
    ): array;

    /**
     * 在允许访问的组织范围内按主键查询单个资产，并将持久化模型转换为领域实体。
     * 目标不存在、已经删除或不属于当前数据隔离范围时返回 null，不向调用方暴露其他组织的数据。
     */
    public function findById(AssetDataIsolation $dataIsolation, int|string $id): ?AssetEntity;

    /** @param array<int, int|string> $ids @return AssetEntity[] */
    public function findByIds(AssetDataIsolation $dataIsolation, array $ids): array;

    /** @return array<string> */
    public function findOwnerUidsByIds(AssetDataIsolation $dataIsolation, array $assetIds): array;

    public function batchUpdateOwner(AssetDataIsolation $dataIsolation, array $assetIds, string $ownerUid): int;

    /**
     * 按用户标识和内容指纹查询未删除的个人资产，用于判断相同内容是否已经上传。
     */
    public function findPersonalAssetByContentHash(string $userId, string $contentHash, bool $anySyncStatus = false): ?AssetEntity;

    /**
     * 判断指定资产是否存在未删除的直接子级，包括普通素材和下级素材组。
     * 该检查用于删除素材组前阻止产生孤立记录，只检查当前组织范围内的直接层级关系。
     */
    public function hasChildren(AssetDataIsolation $dataIsolation, int|string $assetId): bool;

    /**
     * 在组织隔离和用户归属条件下软删除指定资产，并返回是否找到且成功删除记录。
     * 该方法只处理本地资产数据，不负责检查子级关系，也不负责回收第三方素材及其映射。
     */
    public function delete(AssetDataIsolation $dataIsolation, AssetEntity $asset): bool;

    /**
     * 在组织隔离范围内更新资产实体的可变字段，并返回保存后的最新领域实体。
     * 目标不存在或不属于允许访问的组织时返回 null，不创建新记录，也不触发第三方同步流程。
     */
    public function update(AssetDataIsolation $dataIsolation, AssetEntity $asset): ?AssetEntity;
}
