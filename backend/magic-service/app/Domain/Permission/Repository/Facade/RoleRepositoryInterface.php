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
     * 批量获取多个角色的用户列表。
     * 返回格式为 [roleId => userId[]].
     *
     * @param string $organizationCode 组织编码
     * @param int[] $roleIds 角色 ID 列表
     *
     * @return array<int, array>
     */
    public function getRoleUsersMap(string $organizationCode, array $roleIds): array;

    /**
     * 获取用户的角色列表.
     */
    public function getUserRoles(string $organizationCode, string $userId): array;

    /**
     * 获取用户的所有权限.
     */
    public function getUserPermissions(string $organizationCode, string $userId): array;
}
