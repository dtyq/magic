<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Factory;

use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Repository\Persistence\Model\UserSettingModel;

class MagicUserSettingFactory
{
    public static function createEntity(UserSettingModel $model): MagicUserSettingEntity
    {
        $entity = new MagicUserSettingEntity();
        $entity->setId($model->id);
        $entity->setMagicId($model->magic_id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setUserId($model->user_id);
        $entity->setKey($model->key);
        $entity->setValue($model->value);
        $entity->setCreator($model->creator);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->modifier);
        $entity->setUpdatedAt($model->updated_at);

        return $entity;
    }

    public static function createModel(MagicUserSettingEntity $entity): array
    {
        return [
            'id' => $entity->getId(),
            'magic_id' => $entity->getMagicId(),
            'organization_code' => $entity->getOrganizationCode(),
            'user_id' => $entity->getUserId(),
            'key' => $entity->getKey(),
            'value' => $entity->getValue(),
            'creator' => $entity->getCreator(),
            'created_at' => $entity->getCreatedAt(),
            'modifier' => $entity->getModifier(),
            'updated_at' => $entity->getUpdatedAt(),
        ];
    }
}
