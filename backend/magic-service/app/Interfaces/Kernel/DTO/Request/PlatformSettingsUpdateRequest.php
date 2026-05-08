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

class PlatformSettingsUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'logo_zh_url' => 'sometimes|nullable|string|min:1|regex:/^https?:\/\/.+$/',
            'logo_en_url' => 'sometimes|nullable|string|min:1|regex:/^https?:\/\/.+$/',
            'favicon_url' => 'sometimes|nullable|string|min:1|regex:/^https?:\/\/.+$/',
            'minimal_logo_url' => 'sometimes|nullable|string|min:1|regex:/^https?:\/\/.+$/',
            'default_language' => 'sometimes|string|in:zh_CN,en_US',
            'footer' => 'sometimes|array',
            'footer.copyright_i18n' => 'sometimes|array',
            'footer.copyright_i18n.*' => 'nullable|string|max:255',
            'footer.filing' => 'sometimes|array',
            'footer.filing.enabled' => 'sometimes|boolean',
            'footer.filing.number' => 'sometimes|nullable|string|max:64',
            'footer.filing.link' => 'sometimes|nullable|string|regex:/^https?:\/\/.+$/',
            'name_i18n' => 'sometimes|array',
            'name_i18n.*' => 'nullable|string|max:255',
            'title_i18n' => 'sometimes|array',
            'title_i18n.*' => 'nullable|string|max:255',
            'keywords_i18n' => 'sometimes|array',
            'keywords_i18n.*' => 'nullable|string|max:255',
            'description_i18n' => 'sometimes|array',
            'description_i18n.*' => 'nullable|string|max:1000',
            'agent_role_name_i18n' => 'sometimes|array',
            'agent_role_name_i18n.*' => 'nullable|string|max:255',
            'agent_role_description_i18n' => 'sometimes|array',
            'agent_role_description_i18n.*' => 'nullable|string|max:1000',
            'custom_service_provider_whitelist' => 'sometimes|array',
            'custom_service_provider_whitelist.*' => 'string|max:128',
        ];
    }

    public function messages(): array
    {
        return [
            'logo_zh_url.regex' => 'platform_settings.invalid_url',
            'logo_en_url.regex' => 'platform_settings.invalid_url',
            'favicon_url.regex' => 'platform_settings.invalid_url',
            'minimal_logo_url.regex' => 'platform_settings.invalid_url',
            'footer.filing.link.regex' => 'platform_settings.invalid_url',
            'default_language.in' => 'platform_settings.invalid_locale',
        ];
    }

    protected function validationData(): array
    {
        $data = array_merge_recursive($this->all(), $this->getUploadedFiles());
        foreach (['logo_zh_url', 'logo_en_url', 'favicon_url', 'minimal_logo_url', 'default_language'] as $field) {
            if (array_key_exists($field, $data) && is_string($data[$field]) && trim($data[$field]) === '') {
                $data[$field] = null;
            }
        }
        if (isset($data['footer']['filing']) && is_array($data['footer']['filing'])) {
            foreach (['number', 'link'] as $field) {
                if (
                    array_key_exists($field, $data['footer']['filing'])
                    && is_string($data['footer']['filing'][$field])
                    && trim($data['footer']['filing'][$field]) === ''
                ) {
                    $data['footer']['filing'][$field] = null;
                }
            }
        }
        return $data;
    }

    protected function failedValidation(ValidatorInterface $validator)
    {
        $message = $validator->errors()->first() ?: 'platform_settings.validation_failed';
        ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, $message);
    }
}
