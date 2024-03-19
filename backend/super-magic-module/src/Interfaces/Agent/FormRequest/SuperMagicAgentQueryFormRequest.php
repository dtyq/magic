<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\FormRequest;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\trans;

class SuperMagicAgentQueryFormRequest extends FormRequest
{
    /**
     * 验证规则.
     */
    public function rules(): array
    {
        return [
            // 分页参数
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:1000',

            // 搜索条件 - 只保留SuperMagicAgentQuery中实际存在的字段
            'name' => 'nullable|string|max:80',
            'enabled' => 'nullable|boolean',
            'codes' => 'nullable|array',
            'codes.*' => 'string|max:50',
            'creator_id' => 'nullable|string|max:40',
        ];
    }

    /**
     * 字段别名.
     */
    public function attributes(): array
    {
        return [
            'page' => trans('super_magic.agent.fields.page'),
            'page_size' => trans('super_magic.agent.fields.page_size'),
            'name' => trans('super_magic.agent.fields.name'),
            'enabled' => trans('super_magic.agent.fields.enabled'),
            'codes' => trans('super_magic.agent.fields.codes'),
            'codes.*' => trans('super_magic.agent.fields.code'),
            'creator_id' => trans('super_magic.agent.fields.creator_id'),
        ];
    }

    /**
     * 自定义验证错误消息.
     */
    public function messages(): array
    {
        return [
            // 分页参数验证
            'page.integer' => trans('super_magic.agent.validation.page_integer'),
            'page.min' => trans('super_magic.agent.validation.page_min'),
            'page_size.integer' => trans('super_magic.agent.validation.page_size_integer'),
            'page_size.min' => trans('super_magic.agent.validation.page_size_min'),
            'page_size.max' => trans('super_magic.agent.validation.page_size_max'),

            // 搜索条件验证
            'name.string' => trans('super_magic.agent.validation.name_string'),
            'name.max' => trans('super_magic.agent.validation.name_max'),
            'enabled.boolean' => trans('super_magic.agent.validation.enabled_boolean'),
            'codes.array' => trans('super_magic.agent.validation.codes_array'),
            'codes.*.string' => trans('super_magic.agent.validation.code_string'),
            'codes.*.max' => trans('super_magic.agent.validation.code_max'),
            'creator_id.string' => trans('super_magic.agent.validation.creator_id_string'),
            'creator_id.max' => trans('super_magic.agent.validation.creator_id_max'),
        ];
    }

    /**
     * 授权验证.
     */
    public function authorize(): bool
    {
        return true;
    }
}
