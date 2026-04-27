<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Factory;

use App\Domain\Permission\Entity\FunctionPermissionPolicyEntity;
use App\Domain\Permission\Repository\Persistence\Model\FunctionPermissionPolicyModel;

class FunctionPermissionPolicyFactory
{
    public static function createEntity(FunctionPermissionPolicyModel $model): FunctionPermissionPolicyEntity
    {
        $entity = new FunctionPermissionPolicyEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setFunctionCode($model->function_code);
        $entity->setEnabled($model->enabled);
        $entity->setBindingScope($model->binding_scope ?? []);
        $entity->setRemark($model->remark);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);
        return $entity;
    }
}
