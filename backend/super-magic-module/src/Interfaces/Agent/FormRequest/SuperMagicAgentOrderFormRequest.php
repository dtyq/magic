<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\FormRequest;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\trans;

class SuperMagicAgentOrderFormRequest extends FormRequest
{
    /**
     * 验证规则.
     */
    public function rules(): array
    {
        return [
            // 常用智能体排序列表
            'frequent' => 'nullable|array',
            'frequent.*' => 'string|max:50', // 智能体code

            // 全部智能体排序列表
            'all' => 'nullable|array',
            'all.*' => 'string|max:50', // 智能体code
        ];
    }

    /**
     * 字段别名.
     */
    public function attributes(): array
    {
        return [
            'frequent' => trans('super_magic.agent.order.frequent'),
            'frequent.*' => trans('super_magic.agent.fields.code'),
            'all' => trans('super_magic.agent.order.all'),
            'all.*' => trans('super_magic.agent.fields.code'),
        ];
    }

    /**
     * 自定义验证错误消息.
     */
    public function messages(): array
    {
        return [
            // 常用智能体排序验证
            'frequent.array' => trans('super_magic.agent.validation.frequent_array'),
            'frequent.*.string' => trans('super_magic.agent.validation.frequent_code_string'),
            'frequent.*.max' => trans('super_magic.agent.validation.frequent_code_max'),

            // 全部智能体排序验证
            'all.array' => trans('super_magic.agent.validation.all_array'),
            'all.*.string' => trans('super_magic.agent.validation.all_code_string'),
            'all.*.max' => trans('super_magic.agent.validation.all_code_max'),
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
