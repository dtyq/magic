<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Request;

use function Hyperf\Translation\__;

/**
 * 更新员工基本信息请求 DTO.
 */
class UpdateAgentInfoRequestDTO extends CreateAgentRequestDTO
{
    /**
     * 获取验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        // 继承父类的验证规则，但所有字段改为 nullable（部分更新）
        return [
            'name_i18n' => 'nullable|array',
            'name_i18n.en_US' => 'nullable|string',
            'role_i18n' => 'nullable|array',
            'role_i18n.zh_CN' => 'nullable|array',
            'role_i18n.en_US' => 'nullable|array',
            'description_i18n' => 'nullable|array',
            'description_i18n.zh_CN' => 'nullable|string',
            'description_i18n.en_US' => 'nullable|string',
            'icon' => 'nullable|array',
            'icon.url' => 'nullable|string|max:512',
            'icon.type' => 'nullable|string',
            'icon.color' => 'nullable|string',
            'icon_type' => 'nullable|integer|in:1,2',
            'prompt_shadow' => 'nullable|string',
            'file_key' => 'nullable|string|max:500',
        ];
    }

    /**
     * 获取验证错误消息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'name_i18n.array' => __('super_magic.agent.name_i18n_must_be_array'),
            'name_i18n.en_US.required_with' => __('super_magic.agent.name_i18n_en_required'),
            'name_i18n.en_US.string' => __('super_magic.agent.name_i18n_en_must_be_string'),
            'role_i18n.array' => __('super_magic.agent.role_i18n_must_be_array'),
            'description_i18n.array' => __('super_magic.agent.description_i18n_must_be_array'),
            'icon.array' => __('super_magic.agent.icon_must_be_array'),
            'icon_type.integer' => __('super_magic.agent.icon_type_must_be_integer'),
            'icon_type.in' => __('super_magic.agent.icon_type_invalid'),
            'prompt_shadow.string' => __('super_magic.agent.prompt_shadow_must_be_string'),
            'file_key.string' => __('validation.string', ['attribute' => 'file_key']),
            'file_key.max' => __('validation.max.string', ['attribute' => 'file_key', 'max' => 500]),
        ];
    }
}
