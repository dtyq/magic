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
            'all' => 'required|array',
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
     * 授权验证.
     */
    public function authorize(): bool
    {
        return true;
    }
}
