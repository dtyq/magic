<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Entity\Item;

use App\Domain\Chat\Entity\AbstractEntity;

class MagicEnvironmentExtra extends AbstractEntity
{
    // 预发布和生产可以看做是一个环境，所以这里存一下关联的环境 ids
    protected array $relationEnvIds;

    public function getRelationEnvIds(): array
    {
        // 预发布和生产可以看做是一个环境，所以这里存一下关联的环境 ids
        return $this->relationEnvIds;
    }

    public function setRelationEnvIds(array $relationEnvIds): void
    {
        $this->relationEnvIds = $relationEnvIds;
    }
}
