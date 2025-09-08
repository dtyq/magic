<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\Facade;

use App\Application\Kernel\DTO\GlobalConfig;
use App\Application\Kernel\Service\MagicSettingAppService;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class GlobalConfigApi
{
    use MagicUserAuthorizationTrait;

    public function __construct(
        private readonly MagicSettingAppService $magicSettingAppService,
    ) {
    }

    public function getGlobalConfig(): array
    {
        $config = $this->magicSettingAppService->get();
        return $config->toArray();
    }

    public function updateGlobalConfig(RequestInterface $request): array
    {
        $this->isCurrentOrganizationOfficial();
        $isMaintenance = (bool) $request->input('is_maintenance', false);
        $description = (string) $request->input('maintenance_description', '');

        $config = new GlobalConfig();
        $config->setIsMaintenance($isMaintenance);
        $config->setMaintenanceDescription($description);

        $this->magicSettingAppService->save($config);

        return $config->toArray();
    }

    private function isCurrentOrganizationOfficial(): bool
    {
        $officialOrganization = config('service_provider.office_organization');
        $organizationCode = $this->getAuthorization()->getOrganizationCode();
        if ($officialOrganization !== $organizationCode) {
            ExceptionBuilder::throw(PermissionErrorCode::AccessDenied, 'permission.error.access_denied');
        }
        return true;
    }
}
