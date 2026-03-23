<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Facade;

use App\Domain\Permission\Entity\ResourceVisibilityEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType;

interface ResourceVisibilityRepositoryInterface
{
    /**
     * 批量插入可见性配置.
     *
     * @param array<ResourceVisibilityEntity> $entities
     */
    public function batchInsert(PermissionDataIsolation $dataIsolation, array $entities): void;

    /**
     * 批量更新可见性配置.
     *
     * @param array<ResourceVisibilityEntity> $entities
     */
    public function batchUpdate(PermissionDataIsolation $dataIsolation, array $entities): void;

    /**
     * 批量删除可见性配置.
     *
     * @param array<ResourceVisibilityEntity> $entities
     */
    public function batchDelete(PermissionDataIsolation $dataIsolation, array $entities): void;

    /**
     * 删除资源的所有可见性记录.
     */
    public function deleteByResourceCode(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceCode): bool;

    /**
     * 按资源和主体批量删除可见性记录.
     *
     * @param array<string> $principalIds
     */
    public function deleteByResourceAndPrincipals(
        PermissionDataIsolation $dataIsolation,
        ResourceType $resourceType,
        string $resourceCode,
        PrincipalType $principalType,
        array $principalIds
    ): int;

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
    ): array;

    /**
     * @param array<ResourceVisibilityEntity> $entities
     */
    public function batchInsertOrIgnore(PermissionDataIsolation $dataIsolation, array $entities): int;

    /**
     * 根据主体ID列表查询可见性实体列表.
     *
     * @param PermissionDataIsolation $dataIsolation 数据隔离对象
     * @param array $principalIds 主体ID数组（包含用户ID、部门ID列表、组织code）
     * @param ResourceType $resourceType 资源类型
     * @param null|array $resourceIds 资源编码过滤列表，null 表示不过滤
     * @return array<ResourceVisibilityEntity> 实体数组
     */
    public function listByPrincipalIds(
        PermissionDataIsolation $dataIsolation,
        array $principalIds,
        ResourceType $resourceType,
        ?array $resourceIds = null
    ): array;

    /**
     * 根据资源查询可见性列表.
     *
     * @return array<ResourceVisibilityEntity>
     */
    public function listByResource(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceCode): array;
}
