<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Contract;

/**
 * 权限枚举接口
 * 提供权限管理的统一抽象
 */
interface MagicPermissionInterface
{
    /**
     * 获取所有操作类型.
     */
    public function getOperations(): array;

    /**
     * 获取所有资源.
     */
    public function getResources(): array;

    /**
     * 构建权限标识.
     */
    public function buildPermission(string $resource, string $operation): string;

    /**
     * 解析权限标识.
     */
    public function parsePermission(string $permissionKey): array;

    /**
     * 生成所有可能的权限组合.
     */
    public function generateAllPermissions(): array;

    /**
     * 获取权限树结构.
     *
     * @param bool $isPlatformOrganization 是否平台组织，平台组织下才包含 platform 平台的资源树
     */
    public function getPermissionTree(bool $isPlatformOrganization = false): array;

    /**
     * 检查权限键是否有效.
     */
    public function isValidPermission(string $permissionKey): bool;

    /**
     * 获取资源标签.
     */
    public function getResourceLabel(string $resource): string;

    /**
     * 获取操作标签.
     */
    public function getOperationLabel(string $operation): string;

    /**
     * 获取资源的模块.
     */
    public function getResourceModule(string $resource): string;

    /**
     * 检查用户权限集合中是否包含指定权限（考虑隐式包含）。
     */
    public function checkPermission(string $permissionKey, array $userPermissions, bool $isPlatformOrganization = false): bool;
}
