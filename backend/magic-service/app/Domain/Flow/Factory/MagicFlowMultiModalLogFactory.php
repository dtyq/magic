<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Factory;

use App\Domain\Flow\Entity\MagicFlowMultiModalLogEntity;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowMultiModalLogModel;
use Carbon\Carbon;

class MagicFlowMultiModalLogFactory
{
    public static function modelToEntity(MagicFlowMultiModalLogModel $model): MagicFlowMultiModalLogEntity
    {
        $entity = new MagicFlowMultiModalLogEntity();
        $entity->setId($model->id);
        $entity->setMessageId($model->message_id);
        $entity->setType($model->type);
        $entity->setModel($model->model);
        $entity->setAnalysisResult($model->analysis_result);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);
        return $entity;
    }

    public static function entityToModel(MagicFlowMultiModalLogEntity $entity): MagicFlowMultiModalLogModel
    {
        $model = new MagicFlowMultiModalLogModel();
        if ($entity->getId() !== null) {
            $model->id = $entity->getId();
        }
        $model->message_id = $entity->getMessageId();
        $model->type = $entity->getType();
        $model->model = $entity->getModel();
        $model->analysis_result = $entity->getAnalysisResult();
        $model->created_at = Carbon::make($entity->getCreatedAt());
        $model->updated_at = Carbon::make($entity->getUpdatedAt());
        return $model;
    }
}
