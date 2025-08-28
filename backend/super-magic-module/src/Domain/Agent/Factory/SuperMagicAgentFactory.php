<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Factory;

use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\SuperMagicAgentModel;

class SuperMagicAgentFactory
{
    public static function createEntity(SuperMagicAgentModel $model): SuperMagicAgentEntity
    {
        $entity = new SuperMagicAgentEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setCode($model->code);
        $entity->setName($model->name);
        $entity->setDescription($model->description);
        $entity->setIcon($model->icon);
        $entity->setPrompt($model->prompt);
        $entity->setEnabled($model->enabled);
        $entity->setCreator($model->creator);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->modifier);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }
}
