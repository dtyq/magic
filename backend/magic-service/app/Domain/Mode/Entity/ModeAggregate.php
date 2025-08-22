<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Entity;

class ModeAggregate
{
    private ModeEntity $mode;

    /**
     * @var ModeGroupAggregate[] 分组聚合根数组
     */
    private array $groupAggregates = [];

    public function __construct(ModeEntity $mode, array $groupAggregates = [])
    {
        $this->mode = $mode;
        $this->groupAggregates = $groupAggregates;
    }

    public function getMode(): ModeEntity
    {
        return $this->mode;
    }

    public function setMode(ModeEntity $mode): void
    {
        $this->mode = $mode;
    }

    /**
     * @return ModeGroupAggregate[]
     */
    public function getGroupAggregates(): array
    {
        return $this->groupAggregates;
    }

    /**
     * @param ModeGroupAggregate[] $groupAggregates
     */
    public function setGroupAggregates(array $groupAggregates): void
    {
        $this->groupAggregates = $groupAggregates;
    }

    /**
     * 添加分组聚合根.
     */
    public function addGroupAggregate(ModeGroupAggregate $groupAggregate): void
    {
        $this->groupAggregates[] = $groupAggregate;
    }

    /**
     * 根据分组ID获取分组聚合根.
     */
    public function getGroupAggregateByGroupId(int $groupId): ?ModeGroupAggregate
    {
        foreach ($this->groupAggregates as $groupAggregate) {
            if ($groupAggregate->getGroup()->getId() === $groupId) {
                return $groupAggregate;
            }
        }
        return null;
    }

    /**
     * 移除分组聚合根.
     */
    public function removeGroupAggregateByGroupId(int $groupId): void
    {
        $this->groupAggregates = array_filter(
            $this->groupAggregates,
            fn ($groupAggregate) => $groupAggregate->getGroup()->getId() !== $groupId
        );
        $this->groupAggregates = array_values($this->groupAggregates); // 重新索引
    }

    /**
     * 获取所有分组.
     *
     * @return ModeGroupEntity[]
     */
    public function getGroups(): array
    {
        return array_map(
            fn ($groupAggregate) => $groupAggregate->getGroup(),
            $this->groupAggregates
        );
    }

    /**
     * 获取所有模型ID.
     *
     * @return string[]
     */
    public function getAllModelIds(): array
    {
        $allModelIds = [];
        foreach ($this->groupAggregates as $groupAggregate) {
            $allModelIds = array_merge($allModelIds, $groupAggregate->getModelIds());
        }
        return array_unique($allModelIds);
    }

    /**
     * 获取分组数量.
     */
    public function getGroupCount(): int
    {
        return count($this->groupAggregates);
    }

    /**
     * 获取总模型数量.
     */
    public function getTotalModelCount(): int
    {
        $count = 0;
        foreach ($this->groupAggregates as $groupAggregate) {
            $count += $groupAggregate->getModelCount();
        }
        return $count;
    }
}
