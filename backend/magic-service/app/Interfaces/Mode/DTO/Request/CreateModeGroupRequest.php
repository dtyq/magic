<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class CreateModeGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'mode_id' => 'required|integer',
            'name_i18n' => 'required|array',
            'name_i18n.zh_CN' => 'required|string|max:100',
            'name_i18n.en_US' => 'required|string|max:100',
            'icon' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:20',
            'description' => 'nullable|string|max:500',
            'sort' => 'nullable|integer|min:0',
            'status' => 'nullable|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'mode_id.required' => __('mode.mode_id_required'),
            'mode_id.integer' => __('mode.mode_id_integer'),
            'mode_id.min' => __('mode.mode_id_min'),
            'name_i18n.required' => __('mode.name_i18n_required'),
            'name_i18n.array' => __('mode.name_i18n_array'),
            'name_i18n.zh_CN.required' => __('mode.name_zh_cn_required'),
            'name_i18n.zh_CN.max' => __('mode.name_zh_cn_max'),
            'name_i18n.en_US.required' => __('mode.name_en_us_required'),
            'name_i18n.en_US.max' => __('mode.name_en_us_max'),
            'icon.max' => __('mode.icon_max'),
            'color.max' => __('mode.color_max'),
            'color.regex' => __('mode.color_regex'),
            'description.max' => __('mode.description_max'),
            'sort.integer' => __('mode.sort_integer'),
            'sort.min' => __('mode.sort_min'),
            'status.boolean' => __('mode.status_boolean'),
        ];
    }

    public function getModeId(): int
    {
        return (int) $this->input('mode_id');
    }

    public function getName(): string
    {
        return (string) $this->input('name');
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

    public function getSort(): int
    {
        return (int) $this->input('sort', 0);
    }

    public function getStatus(): int
    {
        return (int) $this->input('status', 1);
    }
}
