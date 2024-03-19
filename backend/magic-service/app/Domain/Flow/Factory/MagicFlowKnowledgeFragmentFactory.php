<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Factory;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseFragmentEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Domain\KnowledgeBase\Repository\Persistence\Model\KnowledgeBaseFragmentsModel;

class MagicFlowKnowledgeFragmentFactory
{
    public static function modelToEntity(KnowledgeBaseFragmentsModel $model): KnowledgeBaseFragmentEntity
    {
        $entity = new KnowledgeBaseFragmentEntity();
        $entity->setId($model->id);
        $entity->setKnowledgeCode($model->knowledge_code);
        $entity->setDocumentCode($model->document_code);
        $entity->setContent($model->content);
        $entity->setMetadata($model->metadata);
        $entity->setBusinessId($model->business_id);
        $entity->setPointId($model->point_id);
        $entity->setVector($model->vector);
        $entity->setSyncStatus(KnowledgeSyncStatus::from($model->sync_status));
        $entity->setSyncTimes($model->sync_times);
        $entity->setSyncStatusMessage($model->sync_status_message);
        $entity->setCreator($model->created_uid);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->updated_uid);
        $entity->setUpdatedAt($model->updated_at);
        $entity->setVersion($model->version);
        $entity->setWordCount($model->word_count);
        return $entity;
    }
}
