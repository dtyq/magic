<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Factory;

use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Repository\Persistence\Model\AccessTokenModel;

class AccessTokenFactory
{
    public static function modelToEntity(AccessTokenModel $model): AccessTokenEntity
    {
        $type = AccessTokenType::tryFrom($model->type) ?? AccessTokenType::User;
        $entity = new AccessTokenEntity();
        $entity->setId($model->id);
        $entity->setType($type);
        $entity->setAccessToken($model->access_token);
        $entity->setRelationId($model->relation_id);
        $entity->setName($model->name);
        $entity->setDescription($model->description);
        $entity->setModels($model->models);
        $entity->setIpLimit($model->ip_limit);
        $entity->setExpireTime($model->expire_time);
        $entity->setTotalAmount($model->total_amount);
        $entity->setUseAmount($model->use_amount);
        $entity->setRpm($model->rpm);
        $entity->setOrganizationCode($model->organization_code);
        // $entity->setEnabled((bool) $model->enabled);
        $entity->setCreator($model->creator);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->modifier);
        $entity->setUpdatedAt($model->updated_at);
        return $entity;
    }
}
