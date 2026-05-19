<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Facade;

use App\Application\Permission\Service\FunctionPermissionAppService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class FunctionPermissionApi extends AbstractPermissionApi
{
    #[Inject]
    protected FunctionPermissionAppService $functionPermissionAppService;

    public function me(): array
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();

        return $this->functionPermissionAppService->getUserPermissions($authorization);
    }
}
