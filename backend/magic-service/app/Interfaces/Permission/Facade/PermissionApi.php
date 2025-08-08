<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Facade;

use App\Application\Permission\Service\RoleAppService;
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
}
