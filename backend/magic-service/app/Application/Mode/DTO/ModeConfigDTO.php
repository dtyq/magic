<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO;

use App\Domain\Mode\Entity\DistributionTypeEnum;
use App\Infrastructure\Core\AbstractDTO;

class ModeConfigDTO extends AbstractDTO
{
    protected string $modeId;

    protected int $distributionType;

    protected ?string $followModeId = null;

    /**
     * @var ModeGroupConfigDTO[] 分组配置数组
     */
    protected array $groupConfigs = [];

    public function getModeId(): string
    {
        return $this->modeId;
    }

    public function setModeId(int|string $modeId): void
    {
        $this->modeId = (string) $modeId;
    }

    public function getDistributionType(): int
    {
        return $this->distributionType;
    }

    public function setDistributionType(int $distributionType): void
    {
        $this->distributionType = $distributionType;
    }

    public function getFollowModeId(): ?string
    {
        return $this->followModeId;
    }

    public function setFollowModeId(?string $followModeId): void
    {
        $this->followModeId = $followModeId;
    }

    /**
     * @return ModeGroupConfigDTO[]
     */
    public function getGroupConfigs(): array
    {
        return $this->groupConfigs;
    }

    /**
     * @param ModeGroupConfigDTO[] $groupConfigs
     */
    public function setGroupConfigs(array $groupConfigs): void
    {
        $this->groupConfigs = $groupConfigs;
    }

    /**
     * 添加分组配置.
     */
    public function addGroupConfig(ModeGroupConfigDTO $groupConfig): void
    {
        $this->groupConfigs[] = $groupConfig;
    }

    /**
     * 是否为独立配置.
     */
    public function isIndependentConfiguration(): bool
    {
        return $this->distributionType === DistributionTypeEnum::INDEPENDENT->value;
    }

    /**
     * 是否为继承配置.
     */
    public function isInheritedConfiguration(): bool
    {
        return $this->distributionType === DistributionTypeEnum::INHERITED->value;
    }

    /**
     * 获取所有模型ID.
     */
    public function getAllModelIds(): array
    {
        $allModelIds = [];
        foreach ($this->groupConfigs as $groupConfig) {
            $allModelIds = array_merge($allModelIds, $groupConfig->getModelIds());
        }
        return array_unique($allModelIds);
    }

    /**
     * 获取分组数量.
     */
    public function getGroupCount(): int
    {
        return count($this->groupConfigs);
    }
}
