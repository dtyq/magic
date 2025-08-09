<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Repository\Facade;

use App\Domain\Permission\Entity\RoleEntity;
use App\Infrastructure\Core\ValueObject\Page;

interface RoleRepositoryInterface
{
    /**
     * 保存角色.
     */
    public function save(string $organizationCode, RoleEntity $roleEntity): RoleEntity;

    /**
     * 根据ID获取角色.
     */
    public function getById(string $organizationCode, int $id): ?RoleEntity;

    /**
     * 根据名称获取角色.
     */
    public function getByName(string $organizationCode, string $name): ?RoleEntity;

    /**
     * 查询角色列表.
     * @return array{total: int, list: RoleEntity[]}
     */
    public function queries(string $organizationCode, Page $page, ?array $filters = null): array;

    /**
     * 删除角色.
     */
    public function delete(string $organizationCode, RoleEntity $roleEntity): void;

    /**
     * 为角色分配权限.
     */
    public function assignPermissions(string $organizationCode, int $roleId, array $permissionKeys, ?string $assignedUid = null): void;

    /**
     * 移除角色权限.
     */
    public function removePermissions(string $organizationCode, int $roleId, array $permissionKeys): void;

    /**
     * 获取角色的权限列表.
     */
    public function getRolePermissions(string $organizationCode, int $roleId): array;

    /**
     * 为角色分配用户.
     */
    public function assignUsers(string $organizationCode, int $roleId, array $userIds, ?string $assignedBy = null): void;

    /**
     * 移除角色用户.
     */
    public function removeUsers(string $organizationCode, int $roleId, array $userIds): void;

    /**
     * 获取角色的用户列表.
     */
    public function getRoleUsers(string $organizationCode, int $roleId): array;

    /**
     * 获取用户的角色列表.
     */
    public function getUserRoles(string $organizationCode, string $userId): array;

    /**
     * 获取用户的所有权限.
     */
    public function getUserPermissions(string $organizationCode, string $userId): array;

    /**
     * 检查用户是否拥有指定权限.
     */
    public function hasPermission(string $organizationCode, string $userId, string $permissionKey): bool;

    /**
     * 批量检查用户权限.
     */
    public function hasPermissions(string $organizationCode, string $userId, array $permissionKeys): array;
}
