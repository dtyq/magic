<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\AppMenu\Factory;

use App\Domain\AppMenu\Entity\AppMenuEntity;
use App\Domain\AppMenu\Repository\Persistence\Model\AppMenuModel;

class AppMenuFactory
{
    public static function createEntity(AppMenuModel $model): AppMenuEntity
    {
        $entity = new AppMenuEntity();
        $entity->setId($model->id);
        $entity->setNameI18n($model->name_i18n ?? []);
        $entity->setIcon($model->icon);
        $entity->setIconUrl($model->icon_url);
        $entity->setIconType($model->icon_type);
        $entity->setPath($model->path);
        $entity->setOpenMethod($model->open_method);
        $entity->setSortOrder($model->sort_order);
        $entity->setDisplayScope($model->display_scope);
        $entity->setStatus($model->status);
        $entity->setCreatorId($model->creator_id);
        $entity->setCreatedAt($model->created_at);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }
}
