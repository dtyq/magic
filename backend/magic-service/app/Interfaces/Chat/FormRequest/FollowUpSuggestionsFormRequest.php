<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\FormRequest;

use Hyperf\Validation\Request\FormRequest;

class FollowUpSuggestionsFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => 'required|integer|in:1',
            'relation_id' => 'required|string|max:64',
        ];
    }

    public function messages(): array
    {
        return [
            'type.required' => '建议类型不能为空',
            'type.integer' => '建议类型必须为整数',
            'type.in' => '建议类型无效',
            'relation_id.required' => '关联 ID 不能为空',
            'relation_id.string' => '关联 ID 必须为字符串',
            'relation_id.max' => '关联 ID 不能超过 64 个字符',
        ];
    }
}
