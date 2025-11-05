<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Repository\Facade\AiAbilityRepositoryInterface;

/**
 * AI 能力仓储实现.
 */
class AiAbilityRepository implements AiAbilityRepositoryInterface
{
    /**
     * 根据能力代码获取AI能力实体.
     */
    public function getByCode(AiAbilityCode $code): ?AiAbilityEntity
    {
        $configData = config('ai_abilities.abilities.' . $code->value, null) ?? null;
        if ($configData === null) {
            return null;
        }

        return $this->buildEntity($configData);
    }

    /**
     * 根据配置数据构建实体.
     */
    private function buildEntity(array $configData): AiAbilityEntity
    {
        $entity = new AiAbilityEntity();
        $entity->setCode($configData['code']);
        $entity->setName($configData['name']);
        $entity->setDescription($configData['description']);
        $entity->setIcon($configData['icon']);
        $entity->setSortOrder($configData['sort_order']);
        $entity->setStatus($configData['status']);
        $entity->setConfig($configData['config'] ?? []);

        return $entity;
    }
}
