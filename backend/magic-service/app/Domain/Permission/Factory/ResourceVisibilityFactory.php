<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Factory;

use App\Domain\Permission\Entity\ResourceVisibilityEntity;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType;
use App\Domain\Permission\Repository\Persistence\Model\ResourceVisibilityModel;

class ResourceVisibilityFactory
{
    public static function createEntity(ResourceVisibilityModel $model): ResourceVisibilityEntity
    {
        $entity = new ResourceVisibilityEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setPrincipalType(PrincipalType::tryFrom($model->principal_type));
        $entity->setPrincipalId($model->principal_id);
        $entity->setResourceType(ResourceType::tryFrom($model->resource_type));
        $entity->setResourceCode($model->resource_code);
        $entity->setCreator($model->creator);
        $entity->setModifier($model->modifier);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);
        return $entity;
    }
}
