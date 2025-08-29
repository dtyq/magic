<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\FormRequest;

use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentToolType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentType;
use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\trans;

class SuperMagicAgentSaveFormRequest extends FormRequest
{
    /**
     * 验证规则.
     */
    public function rules(): array
    {
        return [
            // 基本信息
            'id' => 'nullable|string|max:50',
            'name' => 'required|string|max:80',
            'description' => 'nullable|string|max:512',
            'icon' => 'nullable|string|max:100',

            // 智能体类型（动态获取枚举值）
            'type' => 'nullable|integer|in:' . SuperMagicAgentType::getValidationRule(),

            // 启用状态
            'enabled' => 'nullable|boolean',

            // 系统提示词（Editor.js格式的JSON）
            'prompt' => 'required|array',

            // 工具配置
            'tools' => 'nullable|array',
            'tools.*.code' => 'required_with:tools|string|max:100',
            'tools.*.name' => 'required_with:tools|string|max:100',
            'tools.*.description' => 'nullable|string|max:2048',
            'tools.*.icon' => 'nullable|string|max:512',
            'tools.*.type' => 'required_with:tools|integer|in:' . SuperMagicAgentToolType::getValidationRule(), // 动态获取枚举值
        ];
    }

    /**
     * 字段别名.
     */
    public function attributes(): array
    {
        return [
            'id' => trans('super_magic.agent.fields.code'),
            'name' => trans('super_magic.agent.fields.name'),
            'description' => trans('super_magic.agent.fields.description'),
            'icon' => trans('super_magic.agent.fields.icon'),
            'type' => trans('super_magic.agent.fields.type'),
            'enabled' => trans('super_magic.agent.fields.enabled'),
            'prompt' => trans('super_magic.agent.fields.prompt'),
            'tools' => trans('super_magic.agent.fields.tools'),
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
