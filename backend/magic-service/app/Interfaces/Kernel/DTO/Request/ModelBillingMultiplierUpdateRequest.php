<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\DTO\Request;

use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Contract\ValidatorInterface;
use Hyperf\Validation\Request\FormRequest;

/** 倍率专用请求，只接收倍率配置，不接受其他平台字段。 */
class ModelBillingMultiplierUpdateRequest extends FormRequest
{
    /** 资源权限由接口注解统一校验。 */
    public function authorize(): bool
    {
        return true;
    }

    /** 旧平台设置与专用接口共用金额字符串验证规则。 */
    public static function multiplierRules(): array
    {
        return [
            'model_billing_multiplier' => 'sometimes|array',
            'model_billing_multiplier.enabled' => 'sometimes|boolean',
            'model_billing_multiplier.currency' => 'sometimes|string|in:CNY,USD',
            'model_billing_multiplier.input_price' => 'sometimes|nullable|string|max:25',
            'model_billing_multiplier.output_price' => 'sometimes|nullable|string|max:25',
            'model_billing_multiplier.usd_to_cny_rate' => 'sometimes|nullable|string|max:25',
            'model_billing_multiplier.model_overrides' => 'sometimes|array',
            'model_billing_multiplier.model_overrides.*' => 'required|array:model_id,multiplier',
            'model_billing_multiplier.model_overrides.*.model_id' => 'required|string',
            'model_billing_multiplier.model_overrides.*.multiplier' => 'required|string|max:25',
        ];
    }

    /** 专用保存必须明确携带配置对象，并拒绝未知配置键。 */
    public function rules(): array
    {
        return array_replace(self::multiplierRules(), ['model_billing_multiplier' => 'required|array']);
    }

    /** 在验证器过滤字段前拒绝无关字段，避免误以为其他配置也已保存。 */
    protected function validationData(): array
    {
        $data = array_merge_recursive($this->all(), $this->getUploadedFiles());
        $allowed = array_map(static fn (string $key): string => substr($key, strlen('model_billing_multiplier.')), array_slice(array_keys(self::multiplierRules()), 1));
        if (array_diff(array_keys($data), ['model_billing_multiplier']) !== []
            || (is_array($data['model_billing_multiplier'] ?? null) && array_diff(array_keys($data['model_billing_multiplier']), $allowed) !== [])) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'platform_settings.invalid_model_billing_multiplier');
        }
        return $data;
    }

    /** 统一返回平台配置校验错误。 */
    protected function failedValidation(ValidatorInterface $validator)
    {
        ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'platform_settings.invalid_model_billing_multiplier');
    }
}
