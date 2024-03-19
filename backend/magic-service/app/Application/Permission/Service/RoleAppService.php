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
     * 创建角色.
     */
    public function createRole(PermissionDataIsolation $dataIsolation, RoleEntity $roleEntity): RoleEntity
    {
        return $this->roleDomainService->save($dataIsolation, $roleEntity);
    }

    /**
     * 更新角色.
     */
    public function updateRole(PermissionDataIsolation $dataIsolation, RoleEntity $roleEntity): RoleEntity
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
     * 获取权限资源树结构.
     *
     * @param bool $isPlatformOrganization 是否平台组织
     */
    public function getPermissionTree(bool $isPlatformOrganization = false): array
    {
        return $this->roleDomainService->getPermissionTree($isPlatformOrganization);
    }
}
