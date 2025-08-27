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
    protected string $name;

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
            'name' => 'required|string|max:100',
            'identifier' => 'required|string|max:50',
            'icon' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:10|regex:/^#[0-9a-fA-F]{6}$/',
            'description' => 'nullable|string|max:1000',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => __('mode.name_required'),
            'name.max' => __('mode.name_max'),
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
}
