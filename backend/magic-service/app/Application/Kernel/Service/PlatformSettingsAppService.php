<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Service;

use App\Application\Kernel\DTO\PlatformSettings;
use App\Domain\Kernel\Service\PlatformSettingsDomainService;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Locker\Excpetion\LockException;

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

    /** 后台配置读取持久化值，避免不完整的展示缓存影响编辑和刷新。 */
    public function getPersisted(): PlatformSettings
    {
        return $this->platformSettingsDomainService->getPersisted();
    }

    public function save(PlatformSettings $settings): PlatformSettings
    {
        return $this->platformSettingsDomainService->save($settings);
    }

    /** 在统一配置更新入口中合并本次提交字段。 */
    public function update(callable $updater): PlatformSettings
    {
        try {
            return $this->platformSettingsDomainService->update($updater);
        } catch (LockException) {
            ExceptionBuilder::throw(PermissionErrorCode::BusinessException, 'platform_settings.update_busy');
        }
    }

    /** 仅修改倍率，复用配置对象的精度、覆盖和参考金额生成规则。 */
    public function updateModelBillingMultiplier(array $overrides): PlatformSettings
    {
        return $this->update(static function (PlatformSettings $current) use ($overrides): PlatformSettings {
            $data = $current->toArray();
            $data['model_billing_multiplier'] = $current->getModelBillingMultiplier()->withOverrides($overrides)->toArray();
            return PlatformSettings::fromArray($data);
        });
    }
}
