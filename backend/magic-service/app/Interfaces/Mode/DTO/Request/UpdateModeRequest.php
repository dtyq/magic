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
            'name' => 'required|string|max:100',
            'identifier' => 'required|string|max:50',
            'icon' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:10|regex:/^#[0-9a-fA-F]{6}$/',
            'description' => 'nullable|string|max:1000',
            'distribution_type' => 'required|integer|in:1,2',
            'follow_mode_id' => 'nullable|integer|min:1',
            'restricted_mode_identifiers' => 'nullable|array',
            'restricted_mode_identifiers.*' => 'string|max:50',
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
            'distribution_type.required' => __('mode.distribution_type_required'),
            'distribution_type.in' => __('mode.distribution_type_in'),
            'follow_mode_id.integer' => __('mode.follow_mode_id_integer'),
            'follow_mode_id.min' => __('mode.follow_mode_id_min'),
            'restricted_mode_identifiers.array' => __('mode.restricted_mode_identifiers_array'),
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
}
