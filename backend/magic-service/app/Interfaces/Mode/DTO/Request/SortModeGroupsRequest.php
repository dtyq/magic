<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class SortModeGroupsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'group_ids' => 'required|array|min:1',
            'group_ids.*' => 'required|string',
        ];
    }

    public function messages(): array
    {
        return [
            'group_ids.required' => __('mode.group_ids_required'),
            'group_ids.array' => __('mode.group_ids_array'),
            'group_ids.min' => __('mode.group_ids_min'),
            'group_ids.*.required' => __('mode.group_id_required'),
            'group_ids.*.string' => __('mode.group_id_string'),
        ];
    }

    public function getGroupIds(): array
    {
        return $this->input('group_ids');
    }
}
