<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Bootstrap\Service;

use App\Application\Bootstrap\ValueObject\BootstrapStatus;
use App\Application\Kernel\DTO\GlobalConfig;
use App\Application\Kernel\Service\MagicSettingAppService;
use Hyperf\DbConnection\Db;

class BootstrapStatusService
{
    public function __construct(
        private readonly MagicSettingAppService $magicSettingAppService,
    ) {
    }

    public function getStatus(): BootstrapStatus
    {
        $globalConfig = $this->magicSettingAppService->getWithoutCache();
        $explicitStatus = BootstrapStatus::tryFrom($globalConfig->getBootstrapStatus());
        if ($explicitStatus !== null) {
            return $explicitStatus;
        }

        if ($this->hasLegacyBusinessData()) {
            $this->persistStatus($globalConfig, BootstrapStatus::Legacy);
            return BootstrapStatus::Legacy;
        }

        return BootstrapStatus::Fresh;
    }

    public function markInitialized(): void
    {
        $globalConfig = $this->magicSettingAppService->getWithoutCache();
        $this->persistStatus($globalConfig, BootstrapStatus::Initialized);
    }

    private function hasLegacyBusinessData(): bool
    {
        return Db::table('magic_contact_users')->exists()
            || Db::table('magic_contact_accounts')->exists();
    }

    private function persistStatus(GlobalConfig $globalConfig, BootstrapStatus $status): void
    {
        $globalConfig->setBootstrapStatus($status->value);
        $this->magicSettingAppService->save($globalConfig);
    }
}
