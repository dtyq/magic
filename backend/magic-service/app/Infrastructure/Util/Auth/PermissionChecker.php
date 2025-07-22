<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Auth;

use App\Application\Kernel\SuperPermissionEnum;
use App\Infrastructure\Util\Auth\Permission\PermissionInterface;

class PermissionChecker
{
    /**
     * 检查手机号是否有权限访问指定的权限.
     *
     * @param string $mobile 手机号
     * @param SuperPermissionEnum $permissionEnum 要检查的权限类型
     * @return bool 是否有权限
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

    public static function isOrganizationAdmin(string $organizationCode, string $mobile): bool
    {
        $permission = di(PermissionInterface::class);
        return $permission->isOrganizationAdmin($organizationCode, $mobile);
    }

    /**
     * 获取用户拥有管理员权限的组织编码列表.
     */
    public static function getUserOrganizationAdminList(string $mageId): array
    {
        $permission = di(PermissionInterface::class);
        return $permission->getOrganizationAdminList($mageId);
    }
}
