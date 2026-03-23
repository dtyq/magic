<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 更新技能基本信息请求 DTO.
 */
class UpdateSkillInfoRequestDTO extends AbstractRequestDTO
{
    /**
     * 多语言名称（必须包含 default）.
     */
    public array $nameI18n = [];

    /**
     * 多语言描述.
     */
    public array $descriptionI18n = [];

    /**
     * Logo URL.
     */
    public string $logo = '';

    /**
     * 获取多语言名称.
     */
    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    /**
     * 获取多语言描述.
     */
    public function getDescriptionI18n(): array
    {
        return $this->descriptionI18n;
    }

    /**
     * 获取 Logo URL.
     */
    public function getLogo(): string
    {
        return $this->logo;
    }

    /**
     * 获取验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'name_i18n' => 'required|array',
            'name_i18n.default' => 'required|string',
            'description_i18n' => 'nullable|array',
            'logo' => 'nullable|string',
        ];
    }

    /**
     * 获取验证错误消息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'name_i18n.required' => __('skill.name_i18n_required'),
            'name_i18n.array' => __('skill.name_i18n_must_be_array'),
            'name_i18n.default.required' => __('skill.name_i18n_en_required'),
            'name_i18n.default.string' => __('skill.name_i18n_en_must_be_string'),
            'description_i18n.array' => __('skill.description_i18n_must_be_array'),
            'logo.string' => __('skill.logo_must_be_string'),
        ];
    }
}
