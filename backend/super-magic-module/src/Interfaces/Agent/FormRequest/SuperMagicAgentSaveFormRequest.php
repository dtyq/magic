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
            'icon' => 'nullable|array',

            // 智能体类型（动态获取枚举值）
            'type' => 'nullable|integer|in:' . SuperMagicAgentType::getValidationRule(),

            // 启用状态
            'enabled' => 'nullable|boolean',

            // 系统提示词（Editor.js格式的JSON）
            'prompt_shadow' => 'nullable|string',
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
            'tools.*.code' => trans('super_magic.agent.fields.tool_code'),
            'tools.*.name' => trans('super_magic.agent.fields.tool_name'),
            'tools.*.type' => trans('super_magic.agent.fields.tool_type'),
        ];
    }

    /**
     * 自定义验证错误消息.
     */
    public function messages(): array
    {
        return [
            // 基本字段验证
            'name.required' => trans('super_magic.agent.validation.name_required'),
            'name.string' => trans('super_magic.agent.validation.name_string'),
            'name.max' => trans('super_magic.agent.validation.name_max'),
            'description.string' => trans('super_magic.agent.validation.description_string'),
            'description.max' => trans('super_magic.agent.validation.description_max'),
            'icon.array' => trans('super_magic.agent.validation.icon_array'),
            'type.integer' => trans('super_magic.agent.validation.type_integer'),
            'type.in' => trans('super_magic.agent.validation.type_invalid'),
            'enabled.boolean' => trans('super_magic.agent.validation.enabled_boolean'),
            'prompt.required' => trans('super_magic.agent.validation.prompt_required'),
            'prompt.array' => trans('super_magic.agent.validation.prompt_array'),
            'tools.array' => trans('super_magic.agent.validation.tools_array'),

            // 工具字段验证
            'tools.*.code.required_with' => trans('super_magic.agent.validation.tool_code_required'),
            'tools.*.code.string' => trans('super_magic.agent.validation.tool_code_string'),
            'tools.*.code.max' => trans('super_magic.agent.validation.tool_code_max'),
            'tools.*.name.required_with' => trans('super_magic.agent.validation.tool_name_required'),
            'tools.*.name.string' => trans('super_magic.agent.validation.tool_name_string'),
            'tools.*.name.max' => trans('super_magic.agent.validation.tool_name_max'),
            'tools.*.description.string' => trans('super_magic.agent.validation.tool_description_string'),
            'tools.*.description.max' => trans('super_magic.agent.validation.tool_description_max'),
            'tools.*.icon.string' => trans('super_magic.agent.validation.tool_icon_string'),
            'tools.*.icon.max' => trans('super_magic.agent.validation.tool_icon_max'),
            'tools.*.type.required_with' => trans('super_magic.agent.validation.tool_type_required'),
            'tools.*.type.integer' => trans('super_magic.agent.validation.tool_type_integer'),
            'tools.*.type.in' => trans('super_magic.agent.validation.tool_type_invalid'),
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
