<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\Facade;

use App\Application\Kernel\DTO\GlobalConfig;
use App\Application\Kernel\Service\MagicSettingAppService;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class GlobalConfigApi
{
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
        $isMaintenance = (bool) $request->input('is_maintenance', false);
        $description = (string) $request->input('maintenance_description', '');

        $config = new GlobalConfig();
        $config->setIsMaintenance($isMaintenance);
        $config->setMaintenanceDescription($description);

        $this->magicSettingAppService->save($config);

        return $config->toArray();
    }
}
