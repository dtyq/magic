<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence;

use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Factory\MagicOperationPermissionFactory;
use App\Domain\Permission\Repository\Facade\OperationPermissionRepositoryInterface;
use App\Domain\Permission\Repository\Persistence\Model\MagicOperationPermissionModel;

class OperationPermissionRepository extends MagicAbstractRepository implements OperationPermissionRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function save(PermissionDataIsolation $dataIsolation, OperationPermissionEntity $operationPermissionEntity): OperationPermissionEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicOperationPermissionModel::query());

        /** @var null|MagicOperationPermissionModel $model */
        $model = $builder
            ->where('resource_type', $operationPermissionEntity->getResourceType()->value)
            ->where('resource_id', $operationPermissionEntity->getResourceId())
            ->where('target_type', $operationPermissionEntity->getTargetType()->value)
            ->where('target_id', $operationPermissionEntity->getTargetId())
            ->first();
        if ($model) {
            if ($model->operation === $operationPermissionEntity->getOperation()->value) {
                $operationPermissionEntity->setId($model->id);
                return $operationPermissionEntity;
            }
            $model->fill([
                'operation' => $operationPermissionEntity->getOperation()->value,
                'updated_uid' => $operationPermissionEntity->getCreator(),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        } else {
            $model = new MagicOperationPermissionModel();
            $model->fill($this->getAttributes($operationPermissionEntity));
        }
        $model->save();

        $operationPermissionEntity->setId($model->id);

        return $operationPermissionEntity;
    }

    public function getResourceOwner(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId): ?OperationPermissionEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicOperationPermissionModel::query());

        /** @var null|MagicOperationPermissionModel $model */
        $model = $builder
            ->where('resource_type', $resourceType->value)
            ->where('resource_id', $resourceId)
            ->where('target_type', TargetType::UserId->value)
            ->where('operation', Operation::Owner->value)
            ->first();
        if (! $model) {
            return null;
        }
        return MagicOperationPermissionFactory::createEntity($model);
    }

    /**
     * @return array<string, OperationPermissionEntity>
     */
    public function listByResource(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicOperationPermissionModel::query());

        $builder->where('resource_type', $resourceType->value);
        $builder->where('resource_id', $resourceId);

        $list = [];
        /** @var MagicOperationPermissionModel $model */
        foreach ($builder->get() as $model) {
            $entity = MagicOperationPermissionFactory::createEntity($model);
            $list[$entity->getTargetType()->value . '_' . $entity->getTargetId()] = $entity;
        }

        return $list;
    }

    /**
     * @return array<OperationPermissionEntity>
     */
    public function listByTargetIds(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, array $targetIds, array $resourceIds = []): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicOperationPermissionModel::query());

        $builder->where('resource_type', $resourceType->value);
        if (! empty($resourceIds)) {
            $builder->whereIn('resource_id', $resourceIds);
        }
        $builder->whereIn('target_id', $targetIds);

        $list = [];
        /** @var MagicOperationPermissionModel $model */
        foreach ($builder->get() as $model) {
            $entity = MagicOperationPermissionFactory::createEntity($model);
            $list[] = $entity;
        }

        return $list;
    }

    /**
     * @param array<OperationPermissionEntity> $operationPermissions
     */
    public function batchInsert(PermissionDataIsolation $dataIsolation, array $operationPermissions): void
    {
        $models = [];
        foreach ($operationPermissions as $operationPermission) {
            $models[] = $this->getAttributes($operationPermission);
        }
        if (empty($models)) {
            return;
        }

        MagicOperationPermissionModel::insert($models);
    }

    /**
     * @param array<OperationPermissionEntity> $operationPermissions
     */
    public function beachUpdate(PermissionDataIsolation $dataIsolation, array $operationPermissions): void
    {
        foreach ($operationPermissions as $operationPermission) {
            if (! $operationPermission->getId()) {
                continue;
            }
            $builder = $this->createBuilder($dataIsolation, MagicOperationPermissionModel::query());
            $builder->where('id', $operationPermission->getId())->update($this->getAttributes($operationPermission));
        }
    }

    /**
     * @param array<OperationPermissionEntity> $operationPermissions
     */
    public function beachDelete(PermissionDataIsolation $dataIsolation, array $operationPermissions): void
    {
        $ids = [];
        foreach ($operationPermissions as $operationPermission) {
            if ($operationPermission->getId()) {
                $ids[] = $operationPermission->getId();
            }
        }
        if (empty($ids)) {
            return;
        }

        $builder = $this->createBuilder($dataIsolation, MagicOperationPermissionModel::query());
        $builder->whereIn('id', $ids);
        $builder->delete();
    }
}
