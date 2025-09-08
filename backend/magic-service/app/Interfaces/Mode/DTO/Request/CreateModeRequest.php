<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class CreateModeRequest extends FormRequest
{
    protected array $nameI18n = [];

    protected array $placeholderI18n = [];

    protected string $identifier;

    protected ?string $icon = null;

    protected ?string $color = null;

    protected ?string $description = '';

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
        ];
    }

    public function getName(): string
    {
        return $this->input('name');
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
        return $this->input('color') ?: '#1890ff';
    }

    public function getDescription(): ?string
    {
        return $this->input('description');
    }

    public function getPlaceholderI18n(): array
    {
        return $this->input('placeholder_i18n', []);
    }
}
