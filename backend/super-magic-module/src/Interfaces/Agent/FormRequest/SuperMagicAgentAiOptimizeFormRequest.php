<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\FormRequest;

use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentOptimizationType;
use Hyperf\Validation\Request\FormRequest;

class SuperMagicAgentAiOptimizeFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'optimization_type' => ['required', 'string', function ($attribute, $value, $fail) {
                if (SuperMagicAgentOptimizationType::fromString($value) === null) {
                    $fail('The ' . $attribute . ' is invalid.');
                }
            }],
            'agent' => 'required|array',
            'agent.name' => 'nullable|string',
            'agent.description' => 'nullable|string',
            'agent.prompt' => 'nullable|array',
            'agent.tools' => 'nullable|array',
            'agent.icon' => 'nullable|array',
        ];
    }

    public function messages(): array
    {
        return [
            'optimization_type.required' => '优化类型不能为空',
            'optimization_type.in' => '优化类型无效',
            'agent.required' => '智能体数据不能为空',
            'agent.array' => '智能体数据必须是数组格式',
        ];
    }
}
