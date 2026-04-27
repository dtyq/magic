<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence;

use App\Domain\Permission\Entity\FunctionPermissionPolicyEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Factory\FunctionPermissionPolicyFactory;
use App\Domain\Permission\Repository\Persistence\Model\FunctionPermissionPolicyModel;
use Hyperf\DbConnection\Db;

class FunctionPermissionPolicyRepository extends MagicAbstractRepository
{
    protected bool $filterOrganizationCode = true;

    protected array $attributeMaps = [];

    public function getByFunctionCode(PermissionDataIsolation $dataIsolation, string $functionCode): ?FunctionPermissionPolicyEntity
    {
        $builder = $this->createBuilder($dataIsolation, FunctionPermissionPolicyModel::query());

        /** @var null|FunctionPermissionPolicyModel $model */
        $model = $builder
            ->where('function_code', $functionCode)
            ->first();

        return $model ? FunctionPermissionPolicyFactory::createEntity($model) : null;
    }

    /**
     * @return array<string, FunctionPermissionPolicyEntity>
     */
    public function listByOrganization(PermissionDataIsolation $dataIsolation): array
    {
        $builder = $this->createBuilder($dataIsolation, FunctionPermissionPolicyModel::query());

        $list = [];
        /** @var FunctionPermissionPolicyModel $model */
        foreach ($builder->get() as $model) {
            $entity = FunctionPermissionPolicyFactory::createEntity($model);
            $list[$entity->getFunctionCode()] = $entity;
        }

        return $list;
    }

    public function save(FunctionPermissionPolicyEntity $entity): FunctionPermissionPolicyEntity
    {
        /** @var null|FunctionPermissionPolicyModel $model */
        $model = FunctionPermissionPolicyModel::query()
            ->where('organization_code', $entity->getOrganizationCode())
            ->where('function_code', $entity->getFunctionCode())
            ->first();

        if ($model === null) {
            $model = new FunctionPermissionPolicyModel();
            $model->fill([
                'organization_code' => $entity->getOrganizationCode(),
                'function_code' => $entity->getFunctionCode(),
            ]);
        }

        $model->fill([
            'enabled' => $entity->getEnabled() ? 1 : 0,
            'binding_scope' => $entity->getBindingScope(),
            'remark' => $entity->getRemark(),
        ]);

        $model->save();
        return FunctionPermissionPolicyFactory::createEntity($model);
    }

    /**
     * @param array<FunctionPermissionPolicyEntity> $entities
     * @return array<FunctionPermissionPolicyEntity>
     */
    public function saveBatch(array $entities): array
    {
        if ($entities === []) {
            return [];
        }

        $savedEntities = [];
        Db::transaction(function () use ($entities, &$savedEntities): void {
            foreach ($entities as $entity) {
                $savedEntities[] = $this->save($entity);
            }
        });

        return $savedEntities;
    }
}
