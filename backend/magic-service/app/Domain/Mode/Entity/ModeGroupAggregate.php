<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Entity;

use InvalidArgumentException;

class ModeGroupAggregate
{
    private ModeGroupEntity $group;

    /**
     * @var ModeGroupRelationEntity[] 该分组对应的模型关联关系数组
     */
    private array $relations = [];

    /**
     * @param ModeGroupRelationEntity[] $relations
     */
    public function __construct(ModeGroupEntity $group, array $relations = [])
    {
        $this->group = $group;
        $this->relations = $relations;
    }

    public function getGroup(): ModeGroupEntity
    {
        return $this->group;
    }

    public function setGroup(ModeGroupEntity $group): void
    {
        $this->group = $group;
    }

    /**
     * @return ModeGroupRelationEntity[]
     */
    public function getRelations(): array
    {
        return $this->relations;
    }

    /**
     * @param ModeGroupRelationEntity[] $relations
     */
    public function setRelations(array $relations): void
    {
        $this->relations = $relations;
    }

    /**
     * 添加模型到分组（业务方法）.
     */
    public function addModel(string $modelId, string $organizationCode): void
    {
        // 业务验证：检查模型是否已存在
        if ($this->hasModelId($modelId)) {
            throw new InvalidArgumentException("Model {$modelId} already exists in this group");
        }

        // 业务逻辑：自动计算排序值
        $maxSort = $this->getMaxSort();

        // 创建新的关联关系
        $relation = new ModeGroupRelationEntity();
        $relation->setModeId($this->group->getModeId());
        $relation->setGroupId($this->group->getId());
        $relation->setModelId($modelId); // setter会自动转换string到int
        $relation->setSort($maxSort + 1);
        $relation->setOrganizationCode($organizationCode);

        $this->relations[] = $relation;

        // 业务逻辑：保持排序一致性
        $this->reorderRelations();
    }

    /**
     * 移除模型从分组（业务方法）.
     */
    public function removeModel(string $modelId): bool
    {
        $originalCount = count($this->relations);

        $this->relations = array_filter($this->relations, fn ($relation) => (string) $relation->getModelId() !== (string) $modelId);

        if (count($this->relations) < $originalCount) {
            // 业务逻辑：重新计算排序，保持连续性
            $this->reorderRelations();
            return true;
        }

        return false;
    }

    /**
     * 调整模型在分组中的排序（业务方法）.
     */
    public function moveModel(string $modelId, int $newPosition): bool
    {
        if (! $this->hasModelId($modelId)) {
            return false;
        }

        if ($newPosition < 0 || $newPosition >= count($this->relations)) {
            throw new InvalidArgumentException("Invalid position: {$newPosition}");
        }

        // 找到要移动的关联关系
        $targetRelation = null;
        $targetIndex = -1;

        foreach ($this->relations as $index => $relation) {
            if ((string) $relation->getModelId() === (string) $modelId) {
                $targetRelation = $relation;
                $targetIndex = $index;
                break;
            }
        }

        if ($targetRelation && $targetIndex !== $newPosition) {
            // 移除原位置的关联
            array_splice($this->relations, $targetIndex, 1);
            // 插入到新位置
            array_splice($this->relations, $newPosition, 0, [$targetRelation]);

            // 重新计算排序值
            $this->reorderRelations();
            return true;
        }

        return false;
    }

    /**
     * 批量设置模型顺序（业务方法）.
     */
    public function setModelOrder(array $modelIds): void
    {
        // 验证所有模型ID都存在
        foreach ($modelIds as $modelId) {
            if (! $this->hasModelId($modelId)) {
                throw new InvalidArgumentException("Model {$modelId} not found in this group");
            }
        }

        // 验证数量一致
        if (count($modelIds) !== count($this->relations)) {
            throw new InvalidArgumentException('Model count mismatch');
        }

        // 重新排序关联关系
        $newRelations = [];
        foreach ($modelIds as $index => $modelId) {
            foreach ($this->relations as $relation) {
                if ((string) $relation->getModelId() === (string) $modelId) {
                    $relation->setSort($index);
                    $newRelations[] = $relation;
                    break;
                }
            }
        }

        $this->relations = $newRelations;
    }

    /**
     * 检查是否包含指定模型ID的关联.
     */
    public function hasModelId(string $modelId): bool
    {
        foreach ($this->relations as $relation) {
            if ((string) $relation->getModelId() === (string) $modelId) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取指定模型的关联关系.
     */
    public function getRelationByModelId(string $modelId): ?ModeGroupRelationEntity
    {
        foreach ($this->relations as $relation) {
            if ((string) $relation->getModelId() === (string) $modelId) {
                return $relation;
            }
        }
        return null;
    }

    /**
     * 获取按排序值排列的模型ID数组.
     * @return string[]
     */
    public function getOrderedModelIds(): array
    {
        $sortedRelations = $this->relations;
        usort($sortedRelations, fn ($a, $b) => $a->getSort() <=> $b->getSort());

        return array_map(fn ($relation) => (string) $relation->getModelId(), $sortedRelations);
    }

    /**
     * 获取模型ID数组（为了向后兼容）.
     * @return string[]
     */
    public function getModelIds(): array
    {
        return $this->getOrderedModelIds();
    }

    /**
     * 获取模型数量.
     */
    public function getModelCount(): int
    {
        return count($this->relations);
    }

    /**
     * 检查分组是否为空.
     */
    public function isEmpty(): bool
    {
        return empty($this->relations);
    }

    /**
     * 验证聚合根的数据一致性.
     */
    public function validate(): array
    {
        $errors = [];

        // 验证分组信息
        if (! $this->group->getId()) {
            $errors[] = 'Group ID is required';
        }

        if (empty($this->group->getName())) {
            $errors[] = 'Group name is required';
        }

        // 验证关联关系
        $modelIds = [];
        foreach ($this->relations as $index => $relation) {
            // 检查重复的模型ID
            $modelId = (string) $relation->getModelId();
            if (in_array($modelId, $modelIds)) {
                $errors[] = "Duplicate model ID: {$modelId}";
            }
            $modelIds[] = $modelId;

            // 检查关联关系的完整性
            if (! $relation->getGroupId() || (string) $relation->getGroupId() !== (string) $this->group->getId()) {
                $errors[] = "Relation {$index} group ID mismatch";
            }

            if (! $relation->getModeId() || (string) $relation->getModeId() !== (string) $this->group->getModeId()) {
                $errors[] = "Relation {$index} mode ID mismatch";
            }
        }

        return $errors;
    }

    /**
     * 获取最大排序值.
     */
    private function getMaxSort(): int
    {
        if (empty($this->relations)) {
            return 0;
        }

        return max(array_map(fn ($relation) => $relation->getSort(), $this->relations));
    }

    /**
     * 重新计算关联关系的排序值，保持连续性.
     */
    private function reorderRelations(): void
    {
        // 按当前排序值排序
        usort($this->relations, fn ($a, $b) => $a->getSort() <=> $b->getSort());

        // 重新分配连续的排序值
        foreach ($this->relations as $index => $relation) {
            $relation->setSort($index);
        }
    }
}
