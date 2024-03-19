<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Factory;

use App\Domain\Flow\Entity\MagicFlowTriggerTestcaseEntity;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowTriggerTestcaseModel;

class MagicFlowTriggerTestcaseFactory
{
    public static function modelToEntity(MagicFlowTriggerTestcaseModel $model): MagicFlowTriggerTestcaseEntity
    {
        $entity = new MagicFlowTriggerTestcaseEntity();
        $entity->setId($model->id);
        $entity->setFlowCode($model->flow_code);
        $entity->setCode($model->code);
        $entity->setName($model->name);
        $entity->setDescription($model->description);
        $entity->setCaseConfig($model->case_config);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setCreator($model->created_uid);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->updated_uid);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }
}
