<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Repository\Facade;

use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Entity\ModeGroupEntity;

interface ModeGroupRepositoryInterface
{
    /**
     * 根据ID获取分组.
     */
    public function findById(ModeDataIsolation $dataIsolation, int|string $id): ?ModeGroupEntity;

    /**
     * 根据模式ID获取分组列表.
     * @return ModeGroupEntity[]
     */
    public function findByModeId(ModeDataIsolation $dataIsolation, int|string $modeId): array;

    /**
     * 保存分组.
     */
    public function save(ModeDataIsolation $dataIsolation, ModeGroupEntity $groupEntity): ModeGroupEntity;

    /**
     * 更新分组.
     */
    public function update(ModeDataIsolation $dataIsolation, ModeGroupEntity $groupEntity): ModeGroupEntity;

    /**
     * 获取模式下启用的分组列表.
     * @return ModeGroupEntity[]
     */
    public function findEnabledByModeId(ModeDataIsolation $dataIsolation, int|string $modeId): array;

    /**
     * 删除分组.
     */
    public function delete(ModeDataIsolation $dataIsolation, int|string $id): bool;

    /**
     * 根据模式ID删除所有分组.
     */
    public function deleteByModeId(ModeDataIsolation $dataIsolation, int|string $modeId): bool;

    /**
     * @param $groupEntities ModeGroupEntity[]
     */
    public function batchSave(ModeDataIsolation $dataIsolation, array $groupEntities);

    /**
     * 根据多个模式ID批量获取分组列表.
     * @param int[]|string[] $modeIds
     * @return ModeGroupEntity[]
     */
    public function findByModeIds(ModeDataIsolation $dataIsolation, array $modeIds): array;
}
