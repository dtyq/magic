<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Factory;

use App\Domain\Flow\Entity\MagicFlowApiKeyEntity;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowApiKeyModel;

class MagicFlowApiKeyFactory
{
    public static function modelToEntity(MagicFlowApiKeyModel $model): MagicFlowApiKeyEntity
    {
        $entity = new MagicFlowApiKeyEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setCode($model->code);
        $entity->setName($model->name);
        $entity->setDescription($model->description);
        $entity->setType($model->type);
        $entity->setFlowCode($model->flow_code);
        $entity->setSecretKey($model->secret_key);
        $entity->setConversationId($model->conversation_id);
        $entity->setEnabled($model->enabled);
        $entity->setLastUsed($model->last_used);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);
        $entity->setCreator($model->created_uid);
        $entity->setModifier($model->updated_uid);
        return $entity;
    }
}
