<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Domain\Permission\Entity\RoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Facade\RoleRepositoryInterface;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;

readonly class RoleDomainService
{
    public function __construct(
        private RoleRepositoryInterface $roleRepository,
        private MagicPermissionInterface $permission
    ) {
    }

    /**
     * 查询角色列表.
     * @return array{total: int, list: RoleEntity[]}
     */
    public function queries(PermissionDataIsolation $dataIsolation, Page $page, ?array $filters = null): array
    {
        return $this->roleRepository->queries($dataIsolation->getCurrentOrganizationCode(), $page, $filters);
    }

    /**
     * 保存角色.
     */
    public function save(PermissionDataIsolation $dataIsolation, RoleEntity $savingRoleEntity): RoleEntity
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 1. 校验权限键有效性
        foreach ($savingRoleEntity->getPermissions() as $permissionKey) {
            if (! $this->permission->isValidPermission($permissionKey)) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.invalid_permission_key', ['key' => $permissionKey]);
            }
        }

        if ($savingRoleEntity->shouldCreate()) {
            $roleEntity = clone $savingRoleEntity;
            $roleEntity->prepareForCreation();

            // 检查名称在组织下是否唯一
            if ($this->roleRepository->getByName($organizationCode, $savingRoleEntity->getName())) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.role_name_exists', ['name' => $savingRoleEntity->getName()]);
            }
        } else {
            $roleEntity = $this->roleRepository->getById($organizationCode, $savingRoleEntity->getId());
            if (! $roleEntity) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.role_not_found', ['id' => $savingRoleEntity->getId()]);
            }

            // 检查名称修改后是否冲突
            if ($roleEntity->getName() !== $savingRoleEntity->getName()) {
                $existingRole = $this->roleRepository->getByName($organizationCode, $savingRoleEntity->getName());
                if ($existingRole && $existingRole->getId() !== $savingRoleEntity->getId()) {
                    ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.role_name_exists', ['name' => $savingRoleEntity->getName()]);
                }
            }

            $savingRoleEntity->prepareForModification();
            $roleEntity = $savingRoleEntity;
        }

        // 保存角色本身
        $savedRoleEntity = $this->roleRepository->save($organizationCode, $roleEntity);

        // 2. 维护角色与用户的关联关系
        $userIds = $savedRoleEntity->getUserIds();
        if (! empty($userIds)) {
            $this->roleRepository->assignUsers(
                $organizationCode,
                $savedRoleEntity->getId(),
                $userIds,
                $savedRoleEntity->getUpdatedUid() ?? $savedRoleEntity->getCreatedUid()
            );
        }

        return $savedRoleEntity;
    }

    /**
     * 获取角色详情.
     */
    public function show(PermissionDataIsolation $dataIsolation, int $id): RoleEntity
    {
        $roleEntity = $this->roleRepository->getById($dataIsolation->getCurrentOrganizationCode(), $id);
        if (! $roleEntity) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.role_not_found', ['id' => $id]);
        }
        return $roleEntity;
    }

    /**
     * 根据名称获取角色.
     */
    public function getByName(PermissionDataIsolation $dataIsolation, string $name): ?RoleEntity
    {
        return $this->roleRepository->getByName($dataIsolation->getCurrentOrganizationCode(), $name);
    }

    /**
     * 删除角色.
     */
    public function destroy(PermissionDataIsolation $dataIsolation, RoleEntity $roleEntity): void
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 检查角色是否还有用户关联
        $roleUsers = $this->roleRepository->getRoleUsers($organizationCode, $roleEntity->getId());
        if (! empty($roleUsers)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.role_has_users', ['count' => count($roleUsers)]);
        }

        $this->roleRepository->delete($organizationCode, $roleEntity);
    }

    /**
     * 为角色分配权限.
     */
    public function assignPermissions(PermissionDataIsolation $dataIsolation, int $roleId, array $permissionKeys, ?string $assignedBy = null): void
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 验证角色存在
        $role = $this->show($dataIsolation, $roleId);

        // 验证权限键有效性
        foreach ($permissionKeys as $permissionKey) {
            if (! $this->permission->isValidPermission($permissionKey)) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.invalid_permission_key', ['key' => $permissionKey]);
            }
        }

        $this->roleRepository->assignPermissions($organizationCode, $roleId, $permissionKeys, $assignedBy);
    }

    /**
     * 移除角色权限.
     */
    public function removePermissions(PermissionDataIsolation $dataIsolation, int $roleId, array $permissionKeys): void
    {
        // 验证角色存在
        $this->show($dataIsolation, $roleId);

        $this->roleRepository->removePermissions($dataIsolation->getCurrentOrganizationCode(), $roleId, $permissionKeys);
    }

    /**
     * 获取角色权限列表.
     */
    public function getRolePermissions(PermissionDataIsolation $dataIsolation, int $roleId): array
    {
        // 验证角色存在
        $this->show($dataIsolation, $roleId);

        return $this->roleRepository->getRolePermissions($dataIsolation->getCurrentOrganizationCode(), $roleId);
    }

    /**
     * 为角色分配用户.
     */
    public function assignUsers(PermissionDataIsolation $dataIsolation, int $roleId, array $userIds, ?string $assignedBy = null): void
    {
        // 验证角色存在
        $this->show($dataIsolation, $roleId);

        if (empty($userIds)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.empty_user_ids');
        }

        $this->roleRepository->assignUsers($dataIsolation->getCurrentOrganizationCode(), $roleId, $userIds, $assignedBy);
    }

    /**
     * 移除角色用户.
     */
    public function removeUsers(PermissionDataIsolation $dataIsolation, int $roleId, array $userIds): void
    {
        // 验证角色存在
        $this->show($dataIsolation, $roleId);

        $this->roleRepository->removeUsers($dataIsolation->getCurrentOrganizationCode(), $roleId, $userIds);
    }

    /**
     * 获取角色用户列表.
     */
    public function getRoleUsers(PermissionDataIsolation $dataIsolation, int $roleId): array
    {
        // 验证角色存在
        $this->show($dataIsolation, $roleId);

        return $this->roleRepository->getRoleUsers($dataIsolation->getCurrentOrganizationCode(), $roleId);
    }

    /**
     * 获取用户角色列表.
     */
    public function getUserRoles(PermissionDataIsolation $dataIsolation, string $userId): array
    {
        return $this->roleRepository->getUserRoles($dataIsolation->getCurrentOrganizationCode(), $userId);
    }

    /**
     * 获取用户所有权限.
     */
    public function getUserPermissions(PermissionDataIsolation $dataIsolation, string $userId): array
    {
        return $this->roleRepository->getUserPermissions($dataIsolation->getCurrentOrganizationCode(), $userId);
    }

    /**
     * 检查用户是否拥有指定权限.
     */
    public function hasPermission(PermissionDataIsolation $dataIsolation, string $userId, string $permissionKey): bool
    {
        return $this->roleRepository->hasPermission($dataIsolation->getCurrentOrganizationCode(), $userId, $permissionKey);
    }

    /**
     * 批量检查用户权限.
     */
    public function hasPermissions(PermissionDataIsolation $dataIsolation, string $userId, array $permissionKeys): array
    {
        return $this->roleRepository->hasPermissions($dataIsolation->getCurrentOrganizationCode(), $userId, $permissionKeys);
    }

    /**
     * 获取权限资源树结构.
     */
    public function getPermissionTree(): array
    {
        $permissionEnum = di(MagicPermissionInterface::class);
        return $permissionEnum->getPermissionTree();
    }
}
