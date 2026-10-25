<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\Request;

use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Contract\ValidatorInterface;
use Hyperf\Validation\Request\FormRequest;

class IdentityWatermarkUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'watermark' => 'sometimes|array',
            'watermark.enabled' => 'sometimes|boolean',
            'watermark.fields' => 'sometimes|array',
            'watermark.fields.*' => 'string|min:1|max:64',
            'watermark.depth' => 'sometimes|string|in:light,standard,strong',
        ];
    }

    protected function failedValidation(ValidatorInterface $validator)
    {
        $message = $validator->errors()->first() ?: 'platform_settings.validation_failed';
        ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, $message);
    }
}
