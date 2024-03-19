<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Factory;

use App\Domain\ModelGateway\Entity\UserConfigEntity;
use App\Domain\ModelGateway\Repository\Persistence\Model\UserConfigModel;

class UserConfigFactory
{
    public static function modelToEntity(UserConfigModel $model): UserConfigEntity
    {
        $entity = new UserConfigEntity();
        $entity->setId($model->id);
        $entity->setUserId($model->user_id);
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
