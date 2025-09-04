<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Factory;

use App\Domain\Mode\Entity\DistributionTypeEnum;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Repository\Persistence\Model\ModeModel;
use Hyperf\Database\Model\Model;

class ModeFactory
{
    /**
     * 将模型转换为实体.
     */
    public static function modelToEntity(Model|ModeModel $model): ModeEntity
    {
        $entity = new ModeEntity();

        $entity->setId((string) $model->id);
        $entity->setNameI18n($model->name_i18n);
        $entity->setIdentifier($model->identifier);
        $entity->setIcon($model->icon);
        $entity->setColor($model->color);
        $entity->setSort($model->sort);
        $entity->setDescription($model->description);
        $entity->setIsDefault($model->is_default);
        $entity->setStatus($model->status);
        $entity->setPlaceholderI18n($model->placeholder_i18n ?? []);

        $entity->setDistributionType(DistributionTypeEnum::fromValue($model->distribution_type));
        $entity->setFollowModeId((string) $model->follow_mode_id);
        $entity->setRestrictedModeIdentifiers($model->restricted_mode_identifiers ?? []);
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
