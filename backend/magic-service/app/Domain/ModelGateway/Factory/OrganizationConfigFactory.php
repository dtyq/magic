<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Factory;

use App\Domain\ModelGateway\Entity\OrganizationConfigEntity;
use App\Domain\ModelGateway\Repository\Persistence\Model\OrganizationConfigModel;

class OrganizationConfigFactory
{
    public static function modelToEntity(OrganizationConfigModel $model): OrganizationConfigEntity
    {
        $entity = new OrganizationConfigEntity();
        $entity->setId($model->id);
        $entity->setAppCode($model->app_code);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setTotalAmount($model->total_amount);
        $entity->setUseAmount($model->use_amount);
        $entity->setRpm($model->rpm);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);
        return $entity;
    }
}
