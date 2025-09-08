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
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Mode\Repository\Facade\ModeGroupRelationRepositoryInterface;
use App\Domain\Mode\Repository\Facade\ModeGroupRepositoryInterface;
use App\Domain\Mode\Repository\Facade\ModeRepositoryInterface;
use App\ErrorCode\ModeErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Agent\Assembler\FileAssembler;

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
    public function getModes(ModeDataIsolation $dataIsolation, ModeQuery $query, Page $page): array
    {
        return $this->modeRepository->queries($dataIsolation, $query, $page);
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

        // 如果是跟随模式，获取被跟随模式的分组配置
        if ($mode->isInheritedConfiguration() && $mode->hasFollowMode()) {
            $followModeAggregate = $this->getModeDetailById($dataIsolation, $mode->getFollowModeId());
            if ($followModeAggregate) {
                // 使用当前模式的基本信息 + 被跟随模式的分组配置
                return new ModeAggregate($mode, $followModeAggregate->getGroupAggregates());
            }
        }

        // 构建聚合根
        return $this->buildModeAggregate($dataIsolation, $mode);
    }

    public function getOriginMode(ModeDataIsolation $dataIsolation, int|string $id): ?ModeAggregate
    {
        $mode = $this->modeRepository->findById($dataIsolation, $id);
        if (! $mode) {
            return null;
        }
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
    public function getModeDetailByIdentifier(ModeDataIsolation $dataIsolation, string $identifier): ?ModeAggregate
    {
        $mode = $this->modeRepository->findByIdentifier($dataIsolation, $identifier);
        if (! $mode) {
            return null;
        }

        // 如果是跟随模式，获取被跟随模式的分组配置
        if ($mode->isInheritedConfiguration() && $mode->hasFollowMode()) {
            $followModeAggregate = $this->getModeDetailById($dataIsolation, $mode->getFollowModeId());
            if ($followModeAggregate) {
                // 使用当前模式的基本信息 + 被跟随模式的分组配置
                return new ModeAggregate($mode, $followModeAggregate->getGroupAggregates());
            }
        }

        // 构建聚合根
        return $this->buildModeAggregate($dataIsolation, $mode);
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

        // 删除该模式的所有现有分组
        $this->groupRepository->deleteByModeId($dataIsolation, $id);

        // 保存模式基本信息
        $this->modeRepository->save($dataIsolation, $mode);

        // 批量创建分组副本
        $newGroupEntities = [];
        $maxSort = count($modeAggregate->getGroupAggregates());
        foreach ($modeAggregate->getGroupAggregates() as $index => $groupAggregate) {
            $group = $groupAggregate->getGroup();

            // 创建新分组实体（提前生成ID）
            $newGroup = new ModeGroupEntity();
            $newGroup->setId(IdGenerator::getSnowId());
            $newGroup->setModeId((int) $id);
            $newGroup->setNameI18n($group->getNameI18n());
            $newGroup->setIcon(FileAssembler::formatPath($group->getIcon()));
            $newGroup->setDescription($group->getDescription());
            $newGroup->setSort($maxSort - $index);
            $newGroup->setStatus($group->getStatus());
            $newGroup->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $newGroup->setCreatorId($dataIsolation->getCurrentUserId());

            $newGroupEntities[] = $newGroup;

            // 更新聚合中的分组引用
            $groupAggregate->setGroup($newGroup);
        }

        // 批量保存分组
        if (! empty($newGroupEntities)) {
            $this->groupRepository->batchSave($dataIsolation, $newGroupEntities);
        }

        // 批量构建分组实体和关系实体
        $relationEntities = [];

        foreach ($modeAggregate->getGroupAggregates() as $groupAggregate) {
            foreach ($groupAggregate->getRelations() as $relation) {
                $relation->setModeId((string) $id);
                $relation->setOrganizationCode($mode->getOrganizationCode());

                // 设置为新创建的分组ID
                $relation->setGroupId($groupAggregate->getGroup()->getId());

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
     * 批量构建模式聚合根（优化版本，避免N+1查询）.
     * @param ModeEntity[] $modes
     * @return ModeAggregate[]
     */
    public function batchBuildModeAggregates(ModeDataIsolation $dataIsolation, array $modes): array
    {
        if (empty($modes)) {
            return [];
        }

        // 第一步：建立跟随关系映射 followMap[跟随者ID] = 被跟随者ID
        $followMap = [];
        $modeIds = [];

        foreach ($modes as $mode) {
            $modeIds[] = $mode->getId();

            // 如果是跟随模式，建立映射关系
            if ($mode->isInheritedConfiguration() && $mode->hasFollowMode()) {
                $followMap[$mode->getId()] = $mode->getFollowModeId();
                $modeIds[] = $mode->getFollowModeId(); // 也要收集被跟随的模式ID
            }
        }
        $modeIds = array_unique($modeIds);

        // 第二步：批量获取所有分组和关系
        $allGroups = $this->groupRepository->findByModeIds($dataIsolation, $modeIds);
        $allRelations = $this->relationRepository->findByModeIds($dataIsolation, $modeIds);

        // 第三步：按模式ID分组数据
        $groupsByModeId = [];
        foreach ($allGroups as $group) {
            $groupsByModeId[$group->getModeId()][] = $group;
        }

        $relationsByModeId = [];
        foreach ($allRelations as $relation) {
            $relationsByModeId[$relation->getModeId()][] = $relation;
        }

        // 第四步：构建聚合根数组
        $aggregates = [];
        foreach ($modes as $mode) {
            $modeId = $mode->getId();

            // 查找最终源模式ID（递归查找跟随链）
            $ultimateSourceId = $this->findUltimateSourceId($modeId, $followMap);

            $groups = $groupsByModeId[$ultimateSourceId] ?? [];
            $relations = $relationsByModeId[$ultimateSourceId] ?? [];

            // 构建分组聚合根数组
            $groupAggregates = [];
            foreach ($groups as $group) {
                // 获取该分组下的所有关联关系
                $groupRelations = array_filter($relations, fn ($relation) => $relation->getGroupId() === $group->getId());
                usort($groupRelations, fn ($a, $b) => $a->getSort() <=> $b->getSort());

                $groupAggregates[] = new ModeGroupAggregate($group, $groupRelations);
            }

            $aggregates[] = new ModeAggregate($mode, $groupAggregates);
        }

        return $aggregates;
    }

    /**
     * 构建模式聚合根.
     */
    private function buildModeAggregate(ModeDataIsolation $dataIsolation, ModeEntity $mode): ModeAggregate
    {
        // 获取分组和关联关系
        $groups = $this->groupRepository->findByModeId($dataIsolation, $mode->getId());
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

    /**
     * 根据跟随关系映射递归查找最终源模式ID.
     * @param int $modeId 当前模式ID
     * @param array $followMap 跟随关系映射 [跟随者ID => 被跟随者ID]
     * @param array $visited 防止循环跟随
     * @return int 最终源模式ID
     */
    private function findUltimateSourceId(int $modeId, array $followMap, array $visited = []): int
    {
        // 防止循环跟随
        if (in_array($modeId, $visited)) {
            return $modeId;
        }

        // 如果该模式没有跟随关系，说明它就是最终源
        if (! isset($followMap[$modeId])) {
            return $modeId;
        }

        $visited[] = $modeId;

        // 递归查找跟随目标的最终源
        return $this->findUltimateSourceId($followMap[$modeId], $followMap, $visited);
    }
}
