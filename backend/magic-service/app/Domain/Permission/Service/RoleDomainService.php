<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Application\Kernel\MagicPermission;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\Permission\Entity\RoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Facade\RoleRepositoryInterface;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Throwable;

readonly class RoleDomainService
{
    /**
     * 组织管理员角色名称常量.
     */
    public const ORGANIZATION_ADMIN_ROLE_NAME = 'ORGANIZATION_ADMIN';

    public function __construct(
        private RoleRepositoryInterface $roleRepository,
        private MagicPermissionInterface $permission,
        private MagicUserRepositoryInterface $userRepository
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

        // 校验传入的用户ID是否属于当前组织
        $inputUserIds = $savingRoleEntity->getUserIds();
        if (! empty($inputUserIds)) {
            $validUsers = $this->userRepository->getByUserIds($organizationCode, $inputUserIds);
            if (count($validUsers) !== count($inputUserIds)) {
                $invalidIds = array_diff($inputUserIds, array_keys($validUsers));
                ExceptionBuilder::throw(
                    PermissionErrorCode::ValidateFailed,
                    'permission.error.user_not_in_organization',
                    ['userIds' => implode(',', $invalidIds)]
                );
            }
        }

        // 1. 校验权限键有效性
        // 更新 permissionTag 信息：根据权限键提取二级模块标签，用于前端展示分类
        $permissionTags = [];
        foreach ($savingRoleEntity->getPermissions() as $permissionKey) {
            // 校验权限键有效性
            if (! $this->permission->isValidPermission($permissionKey)) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.invalid_permission_key', ['key' => $permissionKey]);
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
            $roleEntity->prepareForCreation($dataIsolation->getCurrentUserId());

            // 检查名称在组织下是否唯一
            if ($this->roleRepository->getByName($organizationCode, $savingRoleEntity->getName())) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.role_name_exists', ['name' => $savingRoleEntity->getName()]);
            }
        } else {
            $roleEntity = $this->roleRepository->getById($organizationCode, $savingRoleEntity->getId());
            if (! $roleEntity) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.role_not_found', ['id' => $savingRoleEntity->getId()]);
            }

            // 检查名称修改后是否冲突
            if ($roleEntity->getName() !== $savingRoleEntity->getName()) {
                $existingRole = $this->roleRepository->getByName($organizationCode, $savingRoleEntity->getName());
                if ($existingRole && $existingRole->getId() !== $savingRoleEntity->getId()) {
                    ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.role_name_exists', ['name' => $savingRoleEntity->getName()]);
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
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.error.role_not_found', ['id' => $id]);
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
        $roleEntity = $this->roleRepository->getByName($dataIsolation->getCurrentOrganizationCode(), $name);

        // 补充角色关联的用户ID信息，避免调用方获取不到 userIds
        if ($roleEntity !== null) {
            $userIds = $this->roleRepository->getRoleUsers($dataIsolation->getCurrentOrganizationCode(), $roleEntity->getId());
            $roleEntity->setUserIds($userIds);
        }

        return $roleEntity;
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
        $isPlatformOrganization = false;
        $officialOrganization = config('service_provider.office_organization');
        if ($officialOrganization === $dataIsolation->getCurrentOrganizationCode()) {
            $isPlatformOrganization = true;
        }
        $userPermissions = $this->roleRepository->getUserPermissions($dataIsolation->getCurrentOrganizationCode(), $userId);
        return $this->permission->checkPermission($permissionKey, $userPermissions, $isPlatformOrganization);
    }

    /**
     * 获取权限资源树结构.
     *
     * @param bool $isPlatformOrganization 是否平台组织
     */
    public function getPermissionTree(bool $isPlatformOrganization = false): array
    {
        $permissionEnum = di(MagicPermissionInterface::class);
        return $permissionEnum->getPermissionTree($isPlatformOrganization);
    }

    /**
     * 为指定用户创建或维护“组织管理员”角色（拥有全局权限）。
     *
     * 逻辑：
     * 1. 根据当前组织查找是否已有同名角色；
     * 2. 若不存在，则创建新的角色并赋予 MagicPermission::ALL_PERMISSIONS；
     * 3. 若存在，则确保其包含 ALL_PERMISSIONS；
     * 4. 将用户 ID 列表加入角色关联用户列表；
     * 5. 保存角色。
     *
     * 异常由调用方自行处理，避免影响主流程。
     */
    public function addOrganizationAdmin(PermissionDataIsolation $dataIsolation, array $userIds): RoleEntity
    {
        // 获取当前组织编码
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 1. 尝试获取已存在的组织管理员角色
        $roleEntity = $this->getByName($dataIsolation, self::ORGANIZATION_ADMIN_ROLE_NAME);

        if ($roleEntity === null) {
            // 创建新角色
            $roleEntity = new RoleEntity();
            $roleEntity->setName(self::ORGANIZATION_ADMIN_ROLE_NAME);
            $roleEntity->setOrganizationCode($organizationCode);
            $roleEntity->setStatus(1);
            $roleEntity->setIsDisplay(0);
        }

        // 2. 确保拥有全局权限 ALL_PERMISSIONS
        $permissions = $roleEntity->getPermissions();
        if (! in_array(MagicPermission::ALL_PERMISSIONS, $permissions, true)) {
            $permissions[] = MagicPermission::ALL_PERMISSIONS;
            $roleEntity->setPermissions($permissions);
        }

        // 3. 将用户列表加入角色用户列表
        $existingUserIds = $roleEntity->getUserIds();
        // 合并并去重
        $mergedUserIds = array_unique(array_merge($existingUserIds, $userIds));
        $roleEntity->setUserIds($mergedUserIds);

        // 4. 保存并返回
        return $this->save($dataIsolation, $roleEntity);
    }

    /**
     * 移除用户的“组织管理员”角色。
     *
     * 逻辑：
     * 1. 获取当前组织下名为 ORGANIZATION_ADMIN_ROLE_NAME 的角色；
     * 2. 若不存在直接返回；
     * 3. 调用仓库移除用户与该角色的关联关系；
     * 4. 如果角色不再关联任何用户，保持角色本身不变（如有需要，可考虑后续清理）。
     */
    public function removeOrganizationAdmin(PermissionDataIsolation $dataIsolation, string $userId): void
    {
        // 获取组织管理员角色
        $roleEntity = $this->getByName($dataIsolation, self::ORGANIZATION_ADMIN_ROLE_NAME);

        if ($roleEntity === null) {
            // 角色不存在，无需处理
            return;
        }

        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 使用仓库移除用户与角色的关联
        $this->roleRepository->removeUsers($organizationCode, $roleEntity->getId(), [$userId]);
    }
}
