<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\SuperMagic\Agent;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\SuperMagic\Agent\Service\MagicClawReconciliationAppService;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use Dtyq\ApiResponse\Annotation\ApiResponse;

#[ApiResponse(version: 'low_code')]
class AdminMagicClawRuntimeApi extends AbstractSuperMagicAdminApi
{
    #[CheckPermission(MagicResourceEnum::ADMIN_SAFE_FUNCTION_PERMISSION, MagicOperationEnum::QUERY)]
    public function show(): array
    {
        return ['runtime_reconciliation' => di(MagicClawReconciliationAppService::class)->status($this->getAuthorization()->getOrganizationCode())];
    }

    #[CheckPermission(MagicResourceEnum::ADMIN_SAFE_FUNCTION_PERMISSION, MagicOperationEnum::EDIT)]
    public function retry(): array
    {
        $operationId = (string) $this->request->input('operation_id', '');
        if ($operationId === '' || ! ctype_digit($operationId)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'invalid operation_id');
        }
        return di(MagicClawReconciliationAppService::class)->retry($this->getAuthorization()->getOrganizationCode(), $operationId);
    }
}
