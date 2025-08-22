<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Factory;

use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\Mode\Repository\Persistence\Model\ModeGroupModel;

class ModeGroupFactory
{
    /**
     * 将模型转换为实体.
     */
    public static function modelToEntity(ModeGroupModel $model): ModeGroupEntity
    {
        $entity = new ModeGroupEntity();

        $entity->setId((string) $model->id);
        $entity->setModeId((string) $model->mode_id);
        $entity->setName($model->name);
        $entity->setIcon($model->icon);
        $entity->setColor($model->color);
        $entity->setDescription($model->description);
        $entity->setSort($model->sort);
        $entity->setStatus((bool) $model->status);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setCreatorId($model->creator_id);

        if ($model->created_at) {
            $entity->setCreatedAt($model->created_at->toDateTimeString());
        }

        if ($model->updated_at) {
            $entity->setUpdatedAt($model->updated_at->toDateTimeString());
        }

        if ($model->deleted_at) {
            $entity->setDeletedAt($model->deleted_at->toDateTimeString());
        }

        return $entity;
    }

    /**
     * 将实体转换为模型属性数组.
     */
    public static function entityToAttributes(ModeGroupEntity $entity): array
    {
        $attributes = [
            'mode_id' => (int) $entity->getModeId(),
            'name' => $entity->getName(),
            'icon' => $entity->getIcon(),
            'color' => $entity->getColor(),
            'description' => $entity->getDescription(),
            'sort' => $entity->getSort(),
            'status' => $entity->getStatus(),
            'organization_code' => $entity->getOrganizationCode(),
            'creator_id' => $entity->getCreatorId(),
        ];

        // 如果实体有ID，则包含ID（用于更新场景）
        if ($entity->getId()) {
            $attributes['id'] = (int) $entity->getId();
        }

        return $attributes;
    }
}
