<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Service;

use App\Application\Kernel\DTO\PlatformSettings;
use App\Domain\Kernel\Service\PlatformSettingsDomainService;

/**
 * Platform Settings Application Service.
 * Delegates to domain service.
 */
class PlatformSettingsAppService
{
    public function __construct(
        private readonly PlatformSettingsDomainService $platformSettingsDomainService,
    ) {
    }

    public function get(): PlatformSettings
    {
        return $this->platformSettingsDomainService->get();
    }

    public function save(PlatformSettings $settings): PlatformSettings
    {
        return $this->platformSettingsDomainService->save($settings);
    }
}
