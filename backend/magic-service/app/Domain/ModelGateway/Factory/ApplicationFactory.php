<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Factory;

use App\Domain\ModelGateway\Entity\ApplicationEntity;
use App\Domain\ModelGateway\Repository\Persistence\Model\ApplicationModel;

class ApplicationFactory
{
    public static function modelToEntity(ApplicationModel $model): ApplicationEntity
    {
        $entity = new ApplicationEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setCode($model->code);
        $entity->setName($model->name);
        $entity->setDescription($model->description);
        $entity->setCreator($model->created_uid);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->updated_uid);
        $entity->setUpdatedAt($model->updated_at);
        return $entity;
    }
}
