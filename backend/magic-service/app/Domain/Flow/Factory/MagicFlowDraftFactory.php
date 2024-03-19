<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Factory;

use App\Domain\Flow\Entity\MagicFlowDraftEntity;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowDraftModel;

class MagicFlowDraftFactory
{
    public static function modelToEntity(MagicFlowDraftModel $magicFlowDraftModel): MagicFlowDraftEntity
    {
        $magicFlowDraftEntity = new MagicFlowDraftEntity();
        $magicFlowDraftEntity->setId($magicFlowDraftModel->id);
        $magicFlowDraftEntity->setFlowCode($magicFlowDraftModel->flow_code);
        $magicFlowDraftEntity->setCode($magicFlowDraftModel->code);
        $magicFlowDraftEntity->setName($magicFlowDraftModel->name);
        $magicFlowDraftEntity->setDescription($magicFlowDraftModel->description);
        if (! empty($magicFlowDraftModel->magic_flow)) {
            $magicFlowDraftEntity->setMagicFlow($magicFlowDraftModel->magic_flow);
        }
        $magicFlowDraftEntity->setOrganizationCode($magicFlowDraftModel->organization_code);
        $magicFlowDraftEntity->setCreator($magicFlowDraftModel->created_uid);
        $magicFlowDraftEntity->setCreatedAt($magicFlowDraftModel->created_at);
        $magicFlowDraftEntity->setModifier($magicFlowDraftModel->updated_uid);
        $magicFlowDraftEntity->setUpdatedAt($magicFlowDraftModel->updated_at);

        return $magicFlowDraftEntity;
    }
}
