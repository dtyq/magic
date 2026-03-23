<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Persistence;

use App\Domain\Permission\Entity\ResourceVisibilityEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType;
use App\Domain\Permission\Factory\ResourceVisibilityFactory;
use App\Domain\Permission\Repository\Facade\ResourceVisibilityRepositoryInterface;
use App\Domain\Permission\Repository\Persistence\Model\ResourceVisibilityModel;

/**
 * 资源可见性仓库实现.
 */
class ResourceVisibilityRepository extends MagicAbstractRepository implements ResourceVisibilityRepositoryInterface
{
    protected array $attributeMaps = [];

    /**
     * 批量插入可见性配置.
     *
     * @param array<ResourceVisibilityEntity> $entities
     */
    public function batchInsert(PermissionDataIsolation $dataIsolation, array $entities): void
    {
        if (empty($entities)) {
            return;
        }

        $insertData = [];
        foreach ($entities as $entity) {
            $insertData[] = $this->getAttributes($entity);
        }

        ResourceVisibilityModel::insert($insertData);
    }

    /**
     * 批量更新可见性配置.
     *
     * @param array<ResourceVisibilityEntity> $entities
     */
    public function batchUpdate(PermissionDataIsolation $dataIsolation, array $entities): void
    {
        foreach ($entities as $entity) {
            if (! $entity->getId()) {
                continue;
            }
            $builder = $this->createBuilder($dataIsolation, ResourceVisibilityModel::query());
            $builder->where('id', $entity->getId())->update($this->getAttributes($entity));
        }
    }

    /**
     * 批量删除可见性配置.
     *
     * @param array<ResourceVisibilityEntity> $entities
     */
    public function batchDelete(PermissionDataIsolation $dataIsolation, array $entities): void
    {
        $ids = [];
        foreach ($entities as $entity) {
            if ($entity->getId()) {
                $ids[] = $entity->getId();
            }
        }
        if (empty($ids)) {
            return;
        }

        $builder = $this->createBuilder($dataIsolation, ResourceVisibilityModel::query());
        $builder->whereIn('id', $ids);
        $builder->delete();
    }

    /**
     * 删除资源的所有可见性记录.
     */
    public function deleteByResourceCode(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceCode): bool
    {
        $builder = $this->createBuilder($dataIsolation, ResourceVisibilityModel::query());

        return $builder
            ->where('resource_type', $resourceType->value)
            ->where('resource_code', $resourceCode)
            ->delete() > 0;
    }

    /**
     * @param array<string> $principalIds
     */
    public function deleteByResourceAndPrincipals(
        PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceCode,
        PrincipalType $principalType,
        array $principalIds
    ): int {
        if ($principalIds === []) {
            return 0;
        }

        $builder = $this->createBuilder($dataIsolation, ResourceVisibilityModel::query());

        return $builder
            ->where('resource_type', $resourceType->value)
            ->where('resource_code', $resourceCode)
            ->where('principal_type', $principalType->value)
            ->whereIn('principal_id', array_values(array_unique($principalIds)))
            ->delete();
    }

    /**
     * @param array<string> $principalIds
     * @return array<string>
     */
    public function listExistingPrincipalIdsByResourceAndType(
        PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceCode,
        PrincipalType $principalType,
        array $principalIds
    ): array {
        if ($principalIds === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, ResourceVisibilityModel::query());

        return $builder
            ->where('resource_type', $resourceType->value)
            ->where('resource_code', $resourceCode)
            ->where('principal_type', $principalType->value)
            ->whereIn('principal_id', array_values(array_unique($principalIds)))
            ->pluck('principal_id')
            ->map(static fn (mixed $principalId): string => (string) $principalId)
            ->toArray();
    }

    /**
     * @param array<ResourceVisibilityEntity> $entities
     */
    public function batchInsertOrIgnore(PermissionDataIsolation $dataIsolation, array $entities): int
    {
        if ($entities === []) {
            return 0;
        }

        $insertData = [];
        foreach ($entities as $entity) {
            $entity->prepareForCreation();
            $insertData[] = $this->getAttributes($entity);
        }

        return ResourceVisibilityModel::query()->insertOrIgnore($insertData);
    }

    /**
     * 根据主体ID列表查询可见性实体列表.
     *
     * @return array<ResourceVisibilityEntity>
     */
    public function listByPrincipalIds(
        PermissionDataIsolation $dataIsolation,
        array $principalIds,
        ResourceType $resourceType,
        ?array $resourceIds = null
    ): array {
        if (empty($principalIds) || $resourceIds === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, ResourceVisibilityModel::query());

        $builder->where('resource_type', $resourceType->value);
        $builder->whereIn('principal_id', $principalIds);
        if ($resourceIds !== null) {
            $builder->whereIn('resource_code', $resourceIds);
        }

        $list = [];
        /** @var ResourceVisibilityModel $model */
        foreach ($builder->get() as $model) {
            $list[] = ResourceVisibilityFactory::createEntity($model);
        }

        return $list;
    }

    /**
     * 根据资源查询可见性列表.
     *
     * @return array<ResourceVisibilityEntity>
     */
    public function listByResource(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceCode): array
    {
        $builder = $this->createBuilder($dataIsolation, ResourceVisibilityModel::query());

        $builder->where('resource_type', $resourceType->value);
        $builder->where('resource_code', $resourceCode);

        $list = [];
        /** @var ResourceVisibilityModel $model */
        foreach ($builder->get() as $model) {
            $list[] = ResourceVisibilityFactory::createEntity($model);
        }

        return $list;
    }
}
