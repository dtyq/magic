<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Service;

use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\Mode\Repository\Facade\ModeGroupRelationRepositoryInterface;
use App\Domain\Mode\Repository\Facade\ModeGroupRepositoryInterface;
use App\Domain\Mode\Repository\Facade\ModeRepositoryInterface;
use App\ErrorCode\ModeErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class ModeGroupDomainService
{
    public function __construct(
        private ModeGroupRepositoryInterface $groupRepository,
        private ModeGroupRelationRepositoryInterface $relationRepository,
        private ModeRepositoryInterface $modeRepository
    ) {
    }

    /**
     * 根据ID获取分组.
     */
    public function getGroupById(ModeDataIsolation $dataIsolation, string $id): ?ModeGroupEntity
    {
        return $this->groupRepository->findById($dataIsolation, $id);
    }

    /**
     * 创建分组.
     */
    public function createGroup(ModeDataIsolation $dataIsolation, ModeGroupEntity $groupEntity): ModeGroupEntity
    {
        $this->validateModeExists($dataIsolation, $groupEntity->getModeId());

        return $this->groupRepository->save($dataIsolation, $groupEntity);
    }

    /**
     * 更新分组.
     */
    public function updateGroup(ModeDataIsolation $dataIsolation, ModeGroupEntity $groupEntity): ModeGroupEntity
    {
        $this->validateModeExists($dataIsolation, $groupEntity->getModeId());

        return $this->groupRepository->update($dataIsolation, $groupEntity);
    }

    /**
     * 根据模式ID获取分组列表.
     */
    public function getGroupsByModeId(ModeDataIsolation $dataIsolation, string $modeId): array
    {
        return $this->groupRepository->findByModeId($dataIsolation, $modeId);
    }

    /**
     * 删除分组.
     */
    public function deleteGroup(ModeDataIsolation $dataIsolation, string $groupId): bool
    {
        $group = $this->groupRepository->findById($dataIsolation, $groupId);
        if (! $group) {
            ExceptionBuilder::throw(ModeErrorCode::GROUP_NOT_FOUND);
        }

        // 删除分组下的所有模型关联
        $this->relationRepository->deleteByGroupId($dataIsolation, $groupId);

        // 删除分组
        return $this->groupRepository->delete($dataIsolation, $groupId);
    }

    /**
     * 获取分组下的模型关联.
     */
    public function getGroupModels(ModeDataIsolation $dataIsolation, string $groupId): array
    {
        return $this->relationRepository->findByGroupId($dataIsolation, $groupId);
    }

    /**
     * 验证模式是否存在.
     */
    private function validateModeExists(ModeDataIsolation $dataIsolation, int $modeId): void
    {
        $mode = $this->modeRepository->findById($dataIsolation, $modeId);
        if (! $mode) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_NOT_FOUND);
        }
    }
}
