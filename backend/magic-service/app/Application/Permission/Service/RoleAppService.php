<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Permission\Entity\RoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\RoleDomainService;
use App\Infrastructure\Core\ValueObject\Page;

class RoleAppService extends AbstractKernelAppService
{
    public function __construct(
        private readonly RoleDomainService $roleDomainService
    ) {
    }

    /**
     * 查询角色列表.
     * @return array{total: int, list: RoleEntity[]}
     */
    public function queries(PermissionDataIsolation $dataIsolation, Page $page, ?array $filters = null): array
    {
        return $this->roleDomainService->queries($dataIsolation, $page, $filters);
    }

    /**
     * 保存角色.
     */
    public function save(PermissionDataIsolation $dataIsolation, RoleEntity $roleEntity): RoleEntity
    {
        return $this->roleDomainService->save($dataIsolation, $roleEntity);
    }

    /**
     * 获取角色详情.
     */
    public function show(PermissionDataIsolation $dataIsolation, int $id): RoleEntity
    {
        return $this->roleDomainService->show($dataIsolation, $id);
    }

    /**
     * 根据名称获取角色.
     */
    public function getByName(PermissionDataIsolation $dataIsolation, string $name): ?RoleEntity
    {
        return $this->roleDomainService->getByName($dataIsolation, $name);
    }

    /**
     * 删除角色.
     */
    public function destroy(PermissionDataIsolation $dataIsolation, int $id): void
    {
        $role = $this->roleDomainService->show($dataIsolation, $id);
        $this->roleDomainService->destroy($dataIsolation, $role);
    }

    /**
     * 为角色分配权限.
     */
    public function assignPermissions(PermissionDataIsolation $dataIsolation, int $roleId, array $permissionKeys, ?string $assignedBy = null): void
    {
        $this->roleDomainService->assignPermissions($dataIsolation, $roleId, $permissionKeys, $assignedBy);
    }

    /**
     * 移除角色权限.
     */
    public function removePermissions(PermissionDataIsolation $dataIsolation, int $roleId, array $permissionKeys): void
    {
        $this->roleDomainService->removePermissions($dataIsolation, $roleId, $permissionKeys);
    }

    /**
     * 获取角色权限列表.
     */
    public function getRolePermissions(PermissionDataIsolation $dataIsolation, int $roleId): array
    {
        return $this->roleDomainService->getRolePermissions($dataIsolation, $roleId);
    }

    /**
     * 为角色分配用户.
     */
    public function assignUsers(PermissionDataIsolation $dataIsolation, int $roleId, array $userIds, ?string $assignedBy = null): void
    {
        $this->roleDomainService->assignUsers($dataIsolation, $roleId, $userIds, $assignedBy);
    }

    /**
     * 移除角色用户.
     */
    public function removeUsers(PermissionDataIsolation $dataIsolation, int $roleId, array $userIds): void
    {
        $this->roleDomainService->removeUsers($dataIsolation, $roleId, $userIds);
    }

    /**
     * 获取角色用户列表.
     */
    public function getRoleUsers(PermissionDataIsolation $dataIsolation, int $roleId): array
    {
        return $this->roleDomainService->getRoleUsers($dataIsolation, $roleId);
    }

    /**
     * 获取用户角色列表.
     */
    public function getUserRoles(PermissionDataIsolation $dataIsolation, string $userId): array
    {
        return $this->roleDomainService->getUserRoles($dataIsolation, $userId);
    }

    /**
     * 获取用户所有权限.
     */
    public function getUserPermissions(PermissionDataIsolation $dataIsolation, string $userId): array
    {
        return $this->roleDomainService->getUserPermissions($dataIsolation, $userId);
    }

    /**
     * 检查用户是否拥有指定权限.
     */
    public function hasPermission(PermissionDataIsolation $dataIsolation, string $userId, string $permissionKey): bool
    {
        return $this->roleDomainService->hasPermission($dataIsolation, $userId, $permissionKey);
    }

    /**
     * 批量检查用户权限.
     */
    public function hasPermissions(PermissionDataIsolation $dataIsolation, string $userId, array $permissionKeys): array
    {
        return $this->roleDomainService->hasPermissions($dataIsolation, $userId, $permissionKeys);
    }

    /**
     * 获取权限资源树结构.
     */
    public function getPermissionTree(): array
    {
        return $this->roleDomainService->getPermissionTree();
    }
}
