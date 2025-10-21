<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\OrganizationEnvironment\Facade\Platform;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\OrganizationEnvironment\Service\OrganizationAdminPlusWhitelistAppService;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class OrganizationAdminPlusWhitelistApi extends AbstractApi
{
    #[Inject]
    protected OrganizationAdminPlusWhitelistAppService $appService;

    #[CheckPermission(MagicResourceEnum::PLATFORM_ORGANIZATION_WHITELIST, MagicOperationEnum::QUERY)]
    public function queries(): array
    {
        $page = (int) $this->request->input('page', 1);
        $pageSize = (int) $this->request->input('page_size', 20);
        $organizationCode = (string) $this->request->input('organization_code', '');
        $organizationCode = $organizationCode === '' ? null : $organizationCode;
        return $this->appService->queries($organizationCode, $page, $pageSize);
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_ORGANIZATION_WHITELIST, MagicOperationEnum::EDIT)]
    public function upsert(): array
    {
        $organizationCode = (string) $this->request->input('organization_code', '');
        $enabled = (bool) $this->request->input('enabled', true);
        return $this->appService->upsert($organizationCode, $enabled);
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_ORGANIZATION_WHITELIST, MagicOperationEnum::EDIT)]
    public function delete(): array
    {
        $id = (int) $this->request->route('id');
        $this->appService->deleteById($id);
        return ['success' => true];
    }
}
