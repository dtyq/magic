<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Factory;

use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Domain\ModelGateway\Repository\Persistence\Model\ModelConfigModel;

class ModelConfigFactory
{
    public static function modelToEntity(ModelConfigModel $model): ModelConfigEntity
    {
        $entity = new ModelConfigEntity();
        $entity->setId($model->id);
        $entity->setModel($model->model);
        $entity->setType($model->type);
        $entity->setName($model->name);
        $entity->setEnabled($model->enabled);
        $entity->setTotalAmount($model->total_amount);
        $entity->setUseAmount($model->use_amount);
        $entity->setExchangeRate($model->exchange_rate);
        $entity->setInputCostPer1000($model->input_cost_per_1000);
        $entity->setOutputCostPer1000($model->output_cost_per_1000);
        $entity->setRpm($model->rpm);
        $entity->setImplementation($model->implementation);
        $entity->setImplementationConfig($model->implementation_config);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);
        return $entity;
    }
}
