<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\Factory;

use App\Domain\Authentication\Entity\ApiKeyProviderEntity;
use App\Domain\Authentication\Entity\ValueObject\ApiKeyProviderType;
use App\Domain\Authentication\Repository\Persistence\Model\ApiKeyProviderModel;

class ApiKeyProviderFactory
{
    public static function modelToEntity(ApiKeyProviderModel $model): ApiKeyProviderEntity
    {
        $entity = new ApiKeyProviderEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setCode($model->code);
        $entity->setRelCode($model->flow_code);
        $entity->setConversationId($model->conversation_id);
        $entity->setRelType(ApiKeyProviderType::tryFrom($model->type));
        $entity->setName($model->name);
        $entity->setDescription($model->description);
        $entity->setSecretKey($model->secret_key);
        $entity->setEnabled($model->enabled);
        $entity->setLastUsed($model->last_used);
        $entity->setCreator($model->created_uid);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->updated_uid);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }
}
