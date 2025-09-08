<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class UpdateModeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name_i18n' => 'required|array',
            'name_i18n.zh_CN' => 'required|string|max:100',
            'name_i18n.en_US' => 'required|string|max:100',
            'placeholder_i18n' => 'nullable|array',
            'placeholder_i18n.zh_CN' => 'nullable|string|max:500',
            'placeholder_i18n.en_US' => 'nullable|string|max:500',
            'identifier' => 'required|string|max:50',
            'icon' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:10|regex:/^#[0-9a-fA-F]{6}$/',
            'description' => 'nullable|string|max:1000',
            'distribution_type' => 'required|integer|in:1,2',
            'restricted_mode_identifiers' => 'nullable|array',
            'restricted_mode_identifiers.*' => 'string|max:50',
        ];
    }

    public function messages(): array
    {
        return [
            'name_i18n.required' => __('mode.name_i18n_required'),
            'name_i18n.array' => __('mode.name_i18n_array'),
            'name_i18n.zh_CN.required' => __('mode.name_zh_cn_required'),
            'name_i18n.zh_CN.max' => __('mode.name_zh_cn_max'),
            'name_i18n.en_US.required' => __('mode.name_en_us_required'),
            'name_i18n.en_US.max' => __('mode.name_en_us_max'),
            'placeholder_i18n.array' => __('mode.placeholder_i18n_array'),
            'placeholder_i18n.zh_CN.max' => __('mode.placeholder_zh_cn_max'),
            'placeholder_i18n.en_US.max' => __('mode.placeholder_en_us_max'),
            'identifier.required' => __('mode.identifier_required'),
            'identifier.max' => __('mode.identifier_max'),
            'icon.max' => __('mode.icon_max'),
            'color.max' => __('mode.color_max'),
            'color.regex' => __('mode.color_regex'),
            'description.max' => __('mode.description_max'),
            'distribution_type.required' => __('mode.distribution_type_required'),
            'distribution_type.in' => __('mode.distribution_type_in'),
            'follow_mode_id.integer' => __('mode.follow_mode_id_integer'),
            'restricted_mode_identifiers.array' => __('mode.restricted_mode_identifiers_array'),
        ];
    }

    public function getNameI18n(): array
    {
        return $this->input('name_i18n', []);
    }

    public function getName(): string
    {
        // 为了兼容性，返回中文名称
        $nameI18n = $this->getNameI18n();
        return $nameI18n['zh_CN'] ?? '';
    }

    public function getIdentifier(): string
    {
        return $this->input('identifier');
    }

    public function getIcon(): ?string
    {
        return $this->input('icon');
    }

    public function getColor(): ?string
    {
        return $this->input('color');
    }

    public function getDescription(): ?string
    {
        return $this->input('description');
    }

    public function getDistributionType(): int
    {
        return (int) $this->input('distribution_type', 1);
    }

    public function getFollowModeId(): ?int
    {
        return $this->input('follow_mode_id') ? (int) $this->input('follow_mode_id') : null;
    }

    public function getRestrictedModeIdentifiers(): array
    {
        return $this->input('restricted_mode_identifiers', []);
    }

    public function getPlaceholderI18n(): array
    {
        return $this->input('placeholder_i18n', []);
    }

    public function getSort(): int
    {
        return $this->input('sort', 0);
    }
}
