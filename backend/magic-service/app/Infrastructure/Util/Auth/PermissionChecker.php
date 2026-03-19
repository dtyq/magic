<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Auth;

use App\Application\Kernel\SuperPermissionEnum;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Permission\Service\OrganizationAdminDomainService;

class PermissionChecker
{
    /**
     * 检查手机号是否有权限访问指定的权限.
     *
     * @param string $mobile 手机号
     * @param SuperPermissionEnum $permissionEnum 要检查的权限类型
     * @return bool 是否有权限
     * @deprecated 请使用新的权限校验方式
     */
    public static function mobileHasPermission(string $mobile, SuperPermissionEnum $permissionEnum): bool
    {
        if (empty($mobile)) {
            return false;
        }
        // 获取权限配置
        $permissions = \Hyperf\Config\config('permission.super_whitelists', []);
        return self::checkPermission($mobile, $permissionEnum, $permissions);
    }

    /**
     * 内部权限检查方法，便于测试.
     *
     * @param string $mobile 手机号
     * @param SuperPermissionEnum $permission 要检查的权限
     * @param array $permissions 权限配置
     * @return bool 是否有权限
     * @deprecated 请使用新的权限校验方式
     */
    public static function checkPermission(
        string $mobile,
        SuperPermissionEnum $permission,
        array $permissions
    ): bool {
        if (empty($mobile)) {
            return false;
        }

        // 判断是否全局管理员
        $globalAdminsEnum = SuperPermissionEnum::GLOBAL_ADMIN->value;
        if (isset($permissions[$globalAdminsEnum]) && in_array($mobile, $permissions[$globalAdminsEnum])) {
            return true;
        }

        // 判断是否特定权限
        $permissionKey = $permission->value;
        return isset($permissions[$permissionKey]) && in_array($mobile, $permissions[$permissionKey]);
    }

    /**
     * 使用组织管理员表判断组织管理员权限（替代 isOrganizationAdmin）.
     */
    public static function isOrganizationAdminByUserId(string $organizationCode, string $userId): bool
    {
        if (empty($organizationCode) || empty($userId)) {
            return false;
        }

        $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);
        $organizationAdminDomainService = di(OrganizationAdminDomainService::class);

        return $organizationAdminDomainService->isOrganizationAdmin($dataIsolation, $userId);
    }

    /**
     * @deprecated 使用 isOrganizationAdminByUserId 判断组织管理员权限
     */
    public static function isOrganizationAdmin(string $organizationCode, string $mobile): bool
    {
        if (empty($organizationCode) || empty($mobile)) {
            return false;
        }

        $magicUserDomainService = di(MagicUserDomainService::class);
        $magicIds = $magicUserDomainService->getMagicIdsByPhone($mobile);
        if (empty($magicIds)) {
            return false;
        }

        $userRepository = di(MagicUserRepositoryInterface::class);
        $users = $userRepository->getUsersByMagicIdAndOrganizationCode($magicIds, $organizationCode);
        if (empty($users)) {
            return false;
        }

        $dataIsolation = DataIsolation::simpleMake($organizationCode);
        $organizationAdminDomainService = di(OrganizationAdminDomainService::class);

        foreach ($users as $user) {
            if ($organizationAdminDomainService->isOrganizationAdmin($dataIsolation, $user->getUserId())) {
                return true;
            }
        }

        return false;
    }

    /**
     * 获取用户拥有管理员权限的组织编码列表.
     */
    public static function getUserOrganizationAdminList(string $mageId): array
    {
        if (empty($mageId)) {
            return [];
        }

        $userRepository = di(MagicUserRepositoryInterface::class);
        $users = $userRepository->getUserByMagicIds([$mageId]);
        if (empty($users)) {
            return [];
        }

        $organizationAdminDomainService = di(OrganizationAdminDomainService::class);
        $organizationCodes = [];

        foreach ($users as $user) {
            $organizationCode = $user->getOrganizationCode();
            if (empty($organizationCode)) {
                continue;
            }

            $dataIsolation = DataIsolation::simpleMake($organizationCode, $user->getUserId());
            if ($organizationAdminDomainService->isOrganizationAdmin($dataIsolation, $user->getUserId())) {
                $organizationCodes[] = $organizationCode;
            }
        }

        return array_values(array_unique($organizationCodes));
    }
}
