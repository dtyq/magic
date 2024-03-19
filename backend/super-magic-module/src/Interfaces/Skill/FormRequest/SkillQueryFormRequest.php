<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\FormRequest;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\trans;

class SkillQueryFormRequest extends FormRequest
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

            // 搜索条件
            'keyword' => 'nullable|string|max:255',
            'source_type' => 'nullable|string',
            'publisher_type' => 'nullable|string|in:USER,OFFICIAL,VERIFIED_CREATOR,PARTNER',
        ];
    }

    /**
     * 字段别名.
     */
    public function attributes(): array
    {
        return [
            'page' => trans('skill.page'),
            'page_size' => trans('skill.page_size'),
            'keyword' => trans('skill.keyword'),
            'source_type' => trans('skill.source_type'),
            'publisher_type' => trans('skill.publisher_type'),
        ];
    }

    /**
     * 自定义验证错误消息.
     */
    public function messages(): array
    {
        return [
            // 分页参数验证
            'page.integer' => trans('skill.page_must_be_integer'),
            'page.min' => trans('skill.page_must_be_greater_than_zero'),
            'page_size.integer' => trans('skill.page_size_must_be_integer'),
            'page_size.min' => trans('skill.page_size_must_be_greater_than_zero'),
            'page_size.max' => trans('skill.page_size_must_not_exceed_100'),

            // 搜索条件验证
            'keyword.string' => trans('skill.keyword_must_be_string'),
            'keyword.max' => trans('skill.keyword_too_long'),
            'source_type.in' => trans('skill.invalid_source_type'),
            'publisher_type.in' => trans('skill.publisher_type_invalid'),
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
