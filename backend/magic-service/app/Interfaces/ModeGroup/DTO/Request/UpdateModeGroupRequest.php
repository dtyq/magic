<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModeGroup\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class UpdateModeGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:100',
            'icon' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:20',
            'description' => 'nullable|string|max:500',
            'sort' => 'nullable|integer|min:0',
            'status' => 'nullable|integer|in:0,1',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => __('mode.group_name_required'),
            'name.max' => __('mode.group_name_max'),
            'icon.max' => __('mode.icon_max'),
            'color.max' => __('mode.color_max'),
            'description.max' => __('mode.description_max'),
            'sort.integer' => __('mode.sort_integer'),
            'sort.min' => __('mode.sort_min'),
            'status.integer' => __('mode.status_integer'),
            'status.in' => __('mode.status_in'),
        ];
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
