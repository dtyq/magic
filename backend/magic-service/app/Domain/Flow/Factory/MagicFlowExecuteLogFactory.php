<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Factory;

use App\Domain\Flow\Entity\MagicFlowExecuteLogEntity;
use App\Domain\Flow\Entity\ValueObject\ExecuteLogStatus;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowExecuteLogModel;

class MagicFlowExecuteLogFactory
{
    public static function modelToEntity(MagicFlowExecuteLogModel $model): MagicFlowExecuteLogEntity
    {
        $entity = new MagicFlowExecuteLogEntity();
        $entity->setId($model->id);
        $entity->setExecuteDataId($model->execute_data_id);
        $entity->setFlowCode($model->flow_code);
        $entity->setFlowVersionCode($model->flow_version_code);
        $entity->setConversationId($model->conversation_id);
        $entity->setStatus(ExecuteLogStatus::from($model->status));
        $entity->setCreatedAt($model->created_at);
        $entity->setExtParams($model->ext_params);
        $entity->setResult($model->result);
        $entity->setRetryCount($model->retry_count);
        return $entity;
    }
}
