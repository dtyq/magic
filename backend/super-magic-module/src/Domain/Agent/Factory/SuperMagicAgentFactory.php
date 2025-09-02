<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Factory;

use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentType;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\SuperMagicAgentModel;

class SuperMagicAgentFactory
{
    public static function createEntity(SuperMagicAgentModel $model): SuperMagicAgentEntity
    {
        $entity = new SuperMagicAgentEntity();

        // 必填字段
        if ($model->id !== null) {
            $entity->setId($model->id);
        }

        if ($model->organization_code !== null) {
            $entity->setOrganizationCode($model->organization_code);
        }

        if ($model->code !== null) {
            $entity->setCode($model->code);
        }

        if ($model->name !== null) {
            $entity->setName($model->name);
        }

        // 可选字段，按需设置
        if ($model->description !== null && $model->description !== '') {
            $entity->setDescription($model->description);
        }

        if ($model->icon !== null && ! empty($model->icon)) {
            $entity->setIcon($model->icon);
        }

        if ($model->prompt !== null) {
            $entity->setPrompt($model->prompt);
        }

        if ($model->tools !== null) {
            $entity->setTools($model->tools);
        }

        if ($model->type !== null) {
            $entity->setType(SuperMagicAgentType::from($model->type));
        }

        if ($model->enabled !== null) {
            $entity->setEnabled($model->enabled);
        }

        if ($model->creator !== null) {
            $entity->setCreator($model->creator);
        }

        if ($model->created_at !== null) {
            $entity->setCreatedAt($model->created_at);
        }

        if ($model->modifier !== null) {
            $entity->setModifier($model->modifier);
        }

        if ($model->updated_at !== null) {
            $entity->setUpdatedAt($model->updated_at);
        }

        return $entity;
    }
}
