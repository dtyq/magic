<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Factory;

use App\Domain\Flow\Entity\MagicFlowToolSetEntity;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowToolSetModel;
use DateTime;

class MagicFlowToolSetFactory
{
    public static function modelToEntity(MagicFlowToolSetModel $model): MagicFlowToolSetEntity
    {
        $array = $model->toArray();
        $entity = new MagicFlowToolSetEntity();
        $entity->setId($model->id);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setCode($model->code);
        $entity->setName($model->name);
        $entity->setDescription($model->description);
        $entity->setIcon($model->icon);
        $entity->setEnabled($model->enabled);
        if (! empty($array['tools'])) {
            $entity->setTools($array['tools']);
        }
        $entity->setCreator($model->created_uid);
        $entity->setCreatedAt($model->created_at);
        $entity->setModifier($model->updated_uid);
        $entity->setUpdatedAt($model->updated_at);
        return $entity;
    }

    /**
     * 将数组转换为工具集实体.
     */
    public static function arrayToEntity(array $toolSetData): MagicFlowToolSetEntity
    {
        $entity = new MagicFlowToolSetEntity();

        // 设置基本属性
        $entity->setId($toolSetData['id'] ?? 0);
        $entity->setCode($toolSetData['code'] ?? '');
        $entity->setName($toolSetData['name'] ?? '');
        $entity->setDescription($toolSetData['description'] ?? '');
        $entity->setIcon($toolSetData['icon'] ?? '');
        $entity->setEnabled($toolSetData['enabled'] ?? true);
        $entity->setOrganizationCode($toolSetData['organization_code'] ?? '');

        // 设置工具列表
        if (! empty($toolSetData['tools'])) {
            $entity->setTools($toolSetData['tools']);
        }

        // 设置用户操作权限
        if (isset($toolSetData['user_operation'])) {
            $entity->setUserOperation($toolSetData['user_operation']);
        }

        // 设置创建者和修改者信息
        $entity->setCreator($toolSetData['created_uid'] ?? $toolSetData['creator'] ?? '');
        $entity->setModifier($toolSetData['updated_uid'] ?? $toolSetData['modifier'] ?? '');

        // 设置时间
        if (! empty($toolSetData['created_at'])) {
            $entity->setCreatedAt(is_string($toolSetData['created_at']) ? new DateTime($toolSetData['created_at']) : $toolSetData['created_at']);
        }
        if (! empty($toolSetData['updated_at'])) {
            $entity->setUpdatedAt(is_string($toolSetData['updated_at']) ? new DateTime($toolSetData['updated_at']) : $toolSetData['updated_at']);
        }

        return $entity;
    }
}
