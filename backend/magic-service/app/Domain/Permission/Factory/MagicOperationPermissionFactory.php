<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Factory;

use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Repository\Persistence\Model\MagicOperationPermissionModel;

class MagicOperationPermissionFactory
{
    public static function createEntity(MagicOperationPermissionModel $model): OperationPermissionEntity
    {
        $entity = new OperationPermissionEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setResourceType(ResourceType::tryFrom($model->resource_type));
        $entity->setResourceId($model->resource_id);
        $entity->setTargetType(TargetType::tryFrom($model->target_type));
        $entity->setTargetId($model->target_id);
        $entity->setOperation(Operation::tryFrom($model->operation));
        $entity->setCreator($model->created_uid);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->updated_uid);
        $entity->setUpdatedAt($model->updated_at);
        return $entity;
    }
}
