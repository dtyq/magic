<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Auth\Permission;

interface PermissionInterface
{
    /**
     * 判断是否组织管理员.
     *
     * @param string $organizationCode 组织编码
     * @param string $mobile 手机号
     *
     * @return bool 是否超级管理员
     */
    public function isOrganizationAdmin(string $organizationCode, string $mobile): bool;

    /**
     * 获取用户所拥有的组织管理员代码.
     */
    public function getOrganizationAdminList(string $magicId): array;
}
