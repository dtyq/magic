<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Facade;

use App\Application\Permission\Service\RoleAppService;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class PermissionApi extends AbstractPermissionApi
{
    #[Inject]
    protected RoleAppService $roleAppService;

    public function getPermissionTree(): array
    {
        // 认证上下文获取（按项目规范）
        $this->getAuthorization();
        return $this->roleAppService->getPermissionTree();
    }

    public function getUserPermissions(): array
    {
        // 获取当前登录用户的认证信息
        $authorization = $this->getAuthorization();

        // 构建权限数据隔离上下文
        $dataIsolation = PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 获取用户拥有的权限列表（扁平权限键数组）
        $permissions = $this->roleAppService->getUserPermissions($dataIsolation, $authorization->getId());
        return ['permission_key' => $permissions];
    }
}
