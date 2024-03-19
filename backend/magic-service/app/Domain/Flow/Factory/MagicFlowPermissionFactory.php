<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Factory;

use App\Domain\Flow\Entity\MagicFlowPermissionEntity;
use App\Domain\Flow\Entity\ValueObject\Permission\Operation;
use App\Domain\Flow\Entity\ValueObject\Permission\ResourceType;
use App\Domain\Flow\Entity\ValueObject\Permission\TargetType;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowPermissionModel;

class MagicFlowPermissionFactory
{
    public static function createEntity(MagicFlowPermissionModel $model): MagicFlowPermissionEntity
    {
        $entity = new MagicFlowPermissionEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setResourceType(ResourceType::from($model->resource_type));
        $entity->setResourceId($model->resource_id);
        $entity->setTargetType(TargetType::from($model->target_type));
        $entity->setTargetId($model->target_id);
        $entity->setOperation(Operation::from($model->operation));
        $entity->setCreator($model->created_uid);
        $entity->setModifier($model->updated_uid);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);
        return $entity;
    }
}
