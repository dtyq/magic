<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Repository\Facade;

use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Entity\ModeGroupRelationEntity;

interface ModeGroupRelationRepositoryInterface
{
    /**
     * 根据ID获取关联关系.
     */
    public function findById(ModeDataIsolation $dataIsolation, int|string $id): ?ModeGroupRelationEntity;

    /**
     * 根据模式ID获取所有关联关系.
     * @return ModeGroupRelationEntity[]
     */
    public function findByModeId(ModeDataIsolation $dataIsolation, int|string $modeId): array;

    /**
     * 根据分组ID获取关联关系.
     * @return ModeGroupRelationEntity[]
     */
    public function findByGroupId(ModeDataIsolation $dataIsolation, int|string $groupId): array;

    /**
     * 保存关联关系.
     */
    public function save(ModeGroupRelationEntity $relationEntity): ModeGroupRelationEntity;

    /**
     * 根据分组ID删除关联关系.
     */
    public function deleteByGroupId(ModeDataIsolation $dataIsolation, int|string $groupId): bool;

    /**
     * 根据模式ID删除所有关联关系.
     */
    public function deleteByModeId(ModeDataIsolation $dataIsolation, int|string $modeId): bool;

    /**
     * @param $relationEntities ModeGroupRelationEntity[]
     */
    public function batchSave(ModeDataIsolation $dataIsolation, array $relationEntities);

    /**
     * 根据多个模式ID批量获取关联关系.
     * @param int[]|string[] $modeIds
     * @return ModeGroupRelationEntity[]
     */
    public function findByModeIds(ModeDataIsolation $dataIsolation, array $modeIds): array;
}
