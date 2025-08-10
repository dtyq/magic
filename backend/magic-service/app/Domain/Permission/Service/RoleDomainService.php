<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Application\Kernel\MagicPermission;
use App\Domain\Permission\Entity\RoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Facade\RoleRepositoryInterface;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Throwable;

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
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 查询角色列表
        $result = $this->roleRepository->queries($organizationCode, $page, $filters);

        // 批量查询用户ID，避免 N+1 查询
        $roleIds = array_map(static fn (RoleEntity $r) => $r->getId(), $result['list']);
        $roleUsersMap = $this->roleRepository->getRoleUsersMap($organizationCode, $roleIds);

        foreach ($result['list'] as $roleEntity) {
            /* @var RoleEntity $roleEntity */
            $userIds = $roleUsersMap[$roleEntity->getId()] ?? [];
            $roleEntity->setUserIds($userIds);
        }

        return $result;
    }

    /**
     * 保存角色.
     */
    public function save(PermissionDataIsolation $dataIsolation, RoleEntity $savingRoleEntity): RoleEntity
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $savingRoleEntity->setOrganizationCode($organizationCode);

        // 1. 校验权限键有效性
        // 更新 permissionTag 信息：根据权限键提取二级模块标签，用于前端展示分类
        $permissionTags = [];
        foreach ($savingRoleEntity->getPermissions() as $permissionKey) {
            // 校验权限键有效性
            if (! $this->permission->isValidPermission($permissionKey)) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.invalid_permission_key', ['key' => $permissionKey]);
            }

            // 跳过全局权限常量，无需参与标签提取
            if ($permissionKey === MagicPermission::ALL_PERMISSIONS) {
                continue;
            }

            // 解析权限键，获取资源并提取其二级模块标签
            try {
                $parsed = $this->permission->parsePermission($permissionKey);
                $resource = $parsed['resource'];
                $moduleLabel = $this->permission->getResourceModule($resource);
                $permissionTags[$moduleLabel] = $moduleLabel; // 使用键值去重
            } catch (Throwable $e) {
                // 解析失败时忽略该权限的标签提取，校验已通过，不影响保存
            }
        }

        // 将标签列表写入 RoleEntity
        if (! empty($permissionTags)) {
            $savingRoleEntity->setPermissionTag(array_values($permissionTags));
        }

        if ($savingRoleEntity->shouldCreate()) {
            $roleEntity = clone $savingRoleEntity;
            $roleEntity->prepareForCreation($dataIsolation->getCurrentOrganizationCode());

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
                $dataIsolation->getCurrentUserId()
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

        // 补充角色关联的用户ID信息
        $roleUsers = $this->roleRepository->getRoleUsers($dataIsolation->getCurrentOrganizationCode(), $id);
        $roleEntity->setUserIds($roleUsers);

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
            // 先删除角色与用户的关联关系
            $this->roleRepository->removeUsers($organizationCode, $roleEntity->getId(), $roleUsers);
        }

        $this->roleRepository->delete($organizationCode, $roleEntity);
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
