<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Factory;

use App\Domain\Mode\Entity\ModeGroupRelationEntity;
use App\Domain\Mode\Repository\Persistence\Model\ModeGroupRelationModel;

class ModeGroupRelationFactory
{
    /**
     * 将模型转换为实体.
     */
    public static function modelToEntity(ModeGroupRelationModel $model): ModeGroupRelationEntity
    {
        $entity = new ModeGroupRelationEntity();

        $entity->setId((string) $model->id);
        $entity->setModeId((string) $model->mode_id);
        $entity->setGroupId((string) $model->group_id);
        $entity->setModelId((string) $model->model_id);
        $entity->setSort($model->sort);
        $entity->setOrganizationCode($model->organization_code);

        if ($model->created_at) {
            $entity->setCreatedAt($model->created_at->toDateTimeString());
        }

        if ($model->updated_at) {
            $entity->setUpdatedAt($model->updated_at->toDateTimeString());
        }

        return $entity;
    }

    /**
     * 将实体转换为模型属性数组.
     */
    public static function entityToAttributes(ModeGroupRelationEntity $entity): array
    {
        $attributes = [
            'mode_id' => (int) $entity->getModeId(),
            'group_id' => (int) $entity->getGroupId(),
            'model_id' => (int) $entity->getModelId(),
            'sort' => $entity->getSort(),
            'organization_code' => $entity->getOrganizationCode(),
        ];

        // 如果实体有ID，则包含ID（用于更新场景）
        if ($entity->getId()) {
            $attributes['id'] = (int) $entity->getId();
        }

        return $attributes;
    }
}
