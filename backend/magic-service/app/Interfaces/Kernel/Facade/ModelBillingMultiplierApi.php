<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\Facade;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Kernel\Service\PlatformSettingsAppService;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Kernel\DTO\Request\ModelBillingMultiplierUpdateRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use InvalidArgumentException;

/** 倍率独立管理入口，仅读写倍率配置，不开放其他平台信息。 */
#[ApiResponse('low_code')]
class ModelBillingMultiplierApi
{
    /** 复用平台配置应用服务，不引入独立配置存储。 */
    public function __construct(private readonly PlatformSettingsAppService $settings)
    {
    }

    /** 返回倍率配置，查询不要求平台信息或模型管理权限。 */
    #[CheckPermission(MagicResourceEnum::PLATFORM_AI_MODEL_MULTIPLIER, MagicOperationEnum::QUERY)]
    public function show(): array
    {
        return ['model_billing_multiplier' => $this->settings->getPersisted()->getModelBillingMultiplier()->toArray()];
    }

    /** 保存倍率字段并返回服务端重新计算后的配置。 */
    #[CheckPermission(MagicResourceEnum::PLATFORM_AI_MODEL_MULTIPLIER, MagicOperationEnum::EDIT)]
    public function update(ModelBillingMultiplierUpdateRequest $request): array
    {
        try {
            $saved = $this->settings->updateModelBillingMultiplier($request->validated()['model_billing_multiplier']);
        } catch (InvalidArgumentException) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'platform_settings.invalid_model_billing_multiplier');
        }
        return ['model_billing_multiplier' => $saved->getModelBillingMultiplier()->toArray()];
    }
}
