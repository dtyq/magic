<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ModeAggregateDTO extends AbstractDTO
{
    protected ModeDTO $mode;

    /**
     * @var ModeGroupAggregateDTO[] 分组聚合根数组
     */
    protected array $groups = [];

    public function getMode(): ModeDTO
    {
        return $this->mode;
    }

    public function setMode(array|ModeDTO $mode): void
    {
        $this->mode = $mode instanceof ModeDTO ? $mode : new ModeDTO($mode);
    }

    /**
     * @return ModeGroupAggregateDTO[]
     */
    public function getGroups(): array
    {
        return $this->groups;
    }

    public function setGroups(array $groups): void
    {
        $groupData = [];
        foreach ($groups as $group) {
            $groupData[] = $group instanceof ModeGroupAggregateDTO ? $group : new ModeGroupAggregateDTO($group);
        }

        $this->groups = $groupData;
    }

    /**
     * 添加分组聚合根.
     */
    public function addGroupAggregate(ModeGroupAggregateDTO $groupAggregate): void
    {
        $this->groups[] = $groupAggregate;
    }

    /**
     * 根据分组ID获取分组聚合根.
     */
    public function getGroupAggregateByGroupId(string $groupId): ?ModeGroupAggregateDTO
    {
        foreach ($this->groups as $groupAggregate) {
            if ($groupAggregate->getGroup()->getId() === $groupId) {
                return $groupAggregate;
            }
        }
        return null;
    }

    /**
     * 移除分组聚合根.
     */
    public function removeGroupAggregateByGroupId(string $groupId): void
    {
        $this->groups = array_filter(
            $this->groups,
            fn ($groupAggregate) => $groupAggregate->getGroup()->getId() !== $groupId
        );
        $this->groups = array_values($this->groups); // 重新索引
    }

    /**
     * 获取所有模型ID.
     *
     * @return string[]
     */
    public function getAllModelIds(): array
    {
        $allModelIds = [];
        foreach ($this->groups as $groupAggregate) {
            $allModelIds = array_merge($allModelIds, $groupAggregate->getModelIds());
        }
        return array_unique($allModelIds);
    }

    /**
     * 获取分组数量.
     */
    public function getGroupCount(): int
    {
        return count($this->groups);
    }

    /**
     * 获取总模型数量.
     */
    public function getTotalModelCount(): int
    {
        $count = 0;
        foreach ($this->groups as $groupAggregate) {
            $count += $groupAggregate->getModelCount();
        }
        return $count;
    }
}
