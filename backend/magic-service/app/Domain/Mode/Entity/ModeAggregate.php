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
}
