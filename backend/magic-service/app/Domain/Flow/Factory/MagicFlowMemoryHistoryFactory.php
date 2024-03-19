<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Factory;

use App\Domain\Flow\Entity\MagicFlowMemoryHistoryEntity;
use App\Domain\Flow\Entity\ValueObject\MemoryType;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowMemoryHistoryModel;

class MagicFlowMemoryHistoryFactory
{
    public static function modelToEntity(MagicFlowMemoryHistoryModel $model): MagicFlowMemoryHistoryEntity
    {
        $entity = new MagicFlowMemoryHistoryEntity();
        $entity->setId($model->id);
        $entity->setType(MemoryType::from($model->type));
        $entity->setConversationId($model->conversation_id);
        $entity->setTopicId($model->topic_id);
        $entity->setRequestId($model->request_id);
        $entity->setMessageId($model->message_id);
        $entity->setRole($model->role);
        $entity->setContent($model->content);
        $entity->setMountId($model->mount_id);
        $entity->setCreatedUid($model->created_uid);
        $entity->setCreatedAt($model->created_at);
        return $entity;
    }
}
