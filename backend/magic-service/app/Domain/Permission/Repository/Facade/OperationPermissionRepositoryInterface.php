<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Facade;

use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;

interface OperationPermissionRepositoryInterface
{
    public function save(PermissionDataIsolation $dataIsolation, OperationPermissionEntity $operationPermissionEntity): OperationPermissionEntity;

    public function getResourceOwner(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId): ?OperationPermissionEntity;

    /**
     * @return array<string, OperationPermissionEntity>
     */
    public function listByResource(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, string $resourceId): array;

    /**
     * @return array<OperationPermissionEntity>
     */
    public function listByTargetIds(PermissionDataIsolation $dataIsolation, ResourceType $resourceType, array $targetIds, array $resourceIds = []): array;

    /**
     * @param array<OperationPermissionEntity> $operationPermissions
     */
    public function batchInsert(PermissionDataIsolation $dataIsolation, array $operationPermissions): void;

    /**
     * @param array<OperationPermissionEntity> $operationPermissions
     */
    public function beachUpdate(PermissionDataIsolation $dataIsolation, array $operationPermissions): void;

    /**
     * @param array<OperationPermissionEntity> $operationPermissions
     */
    public function beachDelete(PermissionDataIsolation $dataIsolation, array $operationPermissions): void;
}
