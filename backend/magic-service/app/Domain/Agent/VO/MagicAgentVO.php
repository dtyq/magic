<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\VO;

use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Flow\Entity\MagicFlowEntity;

class MagicAgentVO
{
    public MagicAgentEntity $agentEntity;

    public MagicAgentEntity $botEntity;

    public ?MagicAgentVersionEntity $agentVersionEntity = null;

    public ?MagicAgentVersionEntity $botVersionEntity = null;

    public MagicUserEntity $magicUserEntity;

    public ?MagicFlowEntity $magicFlowEntity = null;

    public bool $isAdd = false;

    public function getAgentEntity(): MagicAgentEntity
    {
        return $this->agentEntity;
    }

    public function setAgentEntity(MagicAgentEntity $agentEntity): void
    {
        $this->agentEntity = $agentEntity;
        $this->botEntity = $agentEntity;
    }

    public function getAgentVersionEntity(): ?MagicAgentVersionEntity
    {
        return $this->agentVersionEntity;
    }

    public function setAgentVersionEntity(?MagicAgentVersionEntity $agentVersionEntity): void
    {
        $this->agentVersionEntity = $agentVersionEntity;
        $this->botVersionEntity = $agentVersionEntity;
    }

    public function getMagicUserEntity(): MagicUserEntity
    {
        return $this->magicUserEntity;
    }

    public function setMagicUserEntity(MagicUserEntity $magicUserEntity): void
    {
        $this->magicUserEntity = $magicUserEntity;
    }

    public function getMagicFlowEntity(): ?MagicFlowEntity
    {
        return $this->magicFlowEntity;
    }

    public function setMagicFlowEntity(?MagicFlowEntity $magicFlowEntity): void
    {
        $this->magicFlowEntity = $magicFlowEntity;
    }

    public function getIsAdd(): bool
    {
        return $this->isAdd;
    }

    public function setIsAdd(bool $isAdd): void
    {
        $this->isAdd = $isAdd;
    }
}
