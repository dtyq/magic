<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Service;

use App\Domain\Mode\Entity\DistributionTypeEnum;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ModeGroupAggregate;
use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\Mode\Repository\Facade\ModeGroupRelationRepositoryInterface;
use App\Domain\Mode\Repository\Facade\ModeGroupRepositoryInterface;
use App\Domain\Mode\Repository\Facade\ModeRepositoryInterface;
use App\ErrorCode\ModeErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;

class ModeDomainService
{
    public function __construct(
        private ModeRepositoryInterface $modeRepository,
        private ModeGroupRepositoryInterface $groupRepository,
        private ModeGroupRelationRepositoryInterface $relationRepository
    ) {
    }

    /**
     * @return array{total: int, list: ModeEntity[]}
     */
    public function getModes(ModeDataIsolation $dataIsolation, Page $page): array
    {
        return $this->modeRepository->queries($dataIsolation, $page);
    }

    /**
     * 根据ID获取模式聚合根（包含模式详情、分组、模型关系）.
     */
    public function getModeDetailById(ModeDataIsolation $dataIsolation, int|string $id): ?ModeAggregate
    {
        $mode = $this->modeRepository->findById($dataIsolation, $id);
        if (! $mode) {
            return null;
        }

        // 如果是跟随模式，递归获取被跟随模式的配置
        if ($mode->isInheritedConfiguration() && $mode->hasFollowMode()) {
            return $this->getModeDetailById($dataIsolation, $mode->getFollowModeId());
        }

        // 构建聚合根
        return $this->buildModeAggregate($dataIsolation, $mode);
    }

    /**
     * 根据ID获取模式实体（仅获取模式基本信息）.
     */
    public function getModeById(ModeDataIsolation $dataIsolation, int|string $id): ?ModeEntity
    {
        return $this->modeRepository->findById($dataIsolation, $id);
    }

    /**
     * 根据标识符获取模式.
     */
    public function getModeByIdentifier(ModeDataIsolation $dataIsolation, string $identifier): ?ModeEntity
    {
        return $this->modeRepository->findByIdentifier($dataIsolation, $identifier);
    }

    /**
     * 获取默认模式.
     */
    public function getDefaultMode(ModeDataIsolation $dataIsolation): ?ModeAggregate
    {
        $defaultMode = $this->modeRepository->findDefaultMode($dataIsolation);
        if (! $defaultMode) {
            return null;
        }

        return $this->buildModeAggregate($dataIsolation, $defaultMode);
    }

    /**
     * 创建模式.
     */
    public function createMode(ModeDataIsolation $dataIsolation, ModeEntity $modeEntity): ModeEntity
    {
        $this->valid($dataIsolation, $modeEntity);
        return $this->modeRepository->save($dataIsolation, $modeEntity);
    }

    /**
     * 更新模式.
     */
    public function updateMode(ModeDataIsolation $dataIsolation, ModeEntity $modeEntity): ModeEntity
    {
        // 如果是跟随模式，验证跟随的目标模式存在 todo xhy 使用业务异常
        if ($modeEntity->isInheritedConfiguration() && $modeEntity->hasFollowMode()) {
            $followMode = $this->modeRepository->findById($dataIsolation, $modeEntity->getFollowModeId());
            if (! $followMode) {
                ExceptionBuilder::throw(ModeErrorCode::FOLLOW_MODE_NOT_FOUND);
            }

            // 防止循环跟随
            if ($this->hasCircularFollow($dataIsolation, $modeEntity->getId(), $modeEntity->getFollowModeId())) {
                ExceptionBuilder::throw(ModeErrorCode::CANNOT_FOLLOW_SELF);
            }
        }

        return $this->modeRepository->save($dataIsolation, $modeEntity);
    }

    /**
     * 更新模式状态
     */
    public function updateModeStatus(ModeDataIsolation $dataIsolation, string $id, bool $status): bool
    {
        $modeAggregate = $this->getModeDetailById($dataIsolation, $id);
        if (! $modeAggregate) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_NOT_FOUND);
        }
        $mode = $modeAggregate->getMode();

        // 默认模式不能被禁用
        if ($mode->isDefaultMode() && ! $status) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_IN_USE_CANNOT_DELETE);
        }

        return $this->modeRepository->updateStatus($dataIsolation, $id, $status);
    }

    /**
     * 保存模式配置.
     */
    public function saveModeConfig(ModeDataIsolation $dataIsolation, ModeAggregate $modeAggregate): ModeAggregate
    {
        $mode = $modeAggregate->getMode();

        $id = $mode->getId();
        $modeEntity = $this->getModeById($dataIsolation, $id);
        $followModeId = $mode->getFollowModeId();
        $modeEntity->setFollowModeId($followModeId);
        $modeEntity->setDistributionType($mode->getDistributionType());

        $this->updateMode($dataIsolation, $modeEntity);

        // 如果是继承配置模式
        if ($mode->getDistributionType() === DistributionTypeEnum::INHERITED) {
            return $this->getModeDetailById($dataIsolation, $id);
        }

        // 直接删除该模式的所有现有配置
        $this->relationRepository->deleteByModeId($dataIsolation, $id);

        // 保存模式基本信息
        $this->modeRepository->save($dataIsolation, $mode);

        // 批量构建分组实体和关系实体
        $relationEntities = [];

        foreach ($modeAggregate->getGroupAggregates() as $groupAggregate) {
            $group = $groupAggregate->getGroup();

            // 直接使用已有的关联关系，更新模式ID和组织代码
            foreach ($groupAggregate->getRelations() as $relation) {
                $relation->setModeId((string) $id);
                $relation->setOrganizationCode($mode->getOrganizationCode());
                $relationEntities[] = $relation;
            }
        }

        // 批量保存关系
        if (! empty($relationEntities)) {
            $this->relationRepository->batchSave($dataIsolation, $relationEntities);
        }

        // 返回更新后的聚合根
        return $this->getModeDetailById($dataIsolation, $id);
    }

    /**
     * 构建模式聚合根.
     */
    private function buildModeAggregate(ModeDataIsolation $dataIsolation, ModeEntity $mode): ModeAggregate
    {
        // 获取分组和关联关系
        $groups = $this->groupRepository->findEnabledByModeId($dataIsolation, $mode->getId());
        $relations = $this->relationRepository->findByModeId($dataIsolation, $mode->getId());

        // 构建分组聚合根数组
        $groupAggregates = [];
        foreach ($groups as $group) {
            // 类型安全检查
            if (! $group instanceof ModeGroupEntity) {
                ExceptionBuilder::throw(ModeErrorCode::VALIDATE_FAILED);
            }

            // 获取该分组下的所有关联关系
            $groupRelations = array_filter($relations, fn ($relation) => $relation->getGroupId() === $group->getId());
            usort($groupRelations, fn ($a, $b) => $a->getSort() <=> $b->getSort());

            $groupAggregates[] = new ModeGroupAggregate($group, $groupRelations);
        }

        return new ModeAggregate($mode, $groupAggregates);
    }

    /**
     * 检查是否存在循环跟随.
     */
    private function hasCircularFollow(ModeDataIsolation $dataIsolation, int|string $modeId, int|string $followModeId, array $visited = []): bool
    {
        if (in_array($followModeId, $visited)) {
            return true;
        }

        $visited[] = $followModeId;

        $followMode = $this->modeRepository->findById($dataIsolation, $followModeId);
        if (! $followMode || ! $followMode->isInheritedConfiguration() || ! $followMode->hasFollowMode()) {
            return false;
        }

        if ($followMode->getFollowModeId() === (int) $modeId) {
            return true;
        }

        return $this->hasCircularFollow($dataIsolation, $modeId, $followMode->getFollowModeId(), $visited);
    }

    private function valid(ModeDataIsolation $dataIsolation, ModeEntity $modeEntity)
    {
        // 验证标识符唯一性
        if (! $this->modeRepository->isIdentifierUnique($dataIsolation, $modeEntity->getIdentifier())) {
            ExceptionBuilder::throw(ModeErrorCode::MODE_IDENTIFIER_ALREADY_EXISTS);
        }
    }
}
