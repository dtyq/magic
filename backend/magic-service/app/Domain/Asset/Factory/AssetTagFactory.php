<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Factory;

use App\Domain\Asset\Entity\AssetTagEntity;
use App\Domain\Asset\Repository\Persistence\Model\AssetTagModel;

class AssetTagFactory
{
    public static function modelToEntity(AssetTagModel $model): AssetTagEntity
    {
        return (new AssetTagEntity())
            ->setId($model->id)
            ->setOrganizationCode((string) $model->organization_code)
            ->setBusinessType($model->business_type)
            ->setParentId($model->parent_id)
            ->setNodeType((string) $model->node_type)
            ->setNameI18n($model->name_i18n ?? [])
            ->setStatus($model->status)
            ->setSort($model->sort)
            ->setOwnerUid($model->owner_uid)
            ->setCreatedUid($model->created_uid)
            ->setUpdatedUid($model->updated_uid);
    }
}
