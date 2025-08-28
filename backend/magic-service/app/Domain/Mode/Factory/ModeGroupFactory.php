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
        $entity->setNameI18n($model->name_i18n);
        $entity->setIcon($model->icon);
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
}
