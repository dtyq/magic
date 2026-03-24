<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;

use function Hyperf\Translation\__;

/**
 * 更新 Playbook 请求 DTO.
 */
class UpdatePlaybookRequestDTO extends AbstractRequestDTO
{
    /**
     * Playbook 名称（多语言）.
     */
    public ?array $nameI18n = null;

    /**
     * Playbook 描述（多语言）.
     */
    public ?array $descriptionI18n = null;

    /**
     * 图标标识（emoji 或图标 key）.
     */
    public ?string $icon = '';

    /**
     * 主题色，格式 #RRGGBB.
     */
    public ?string $themeColor = null;

    /**
     * 启用状态.
     */
    public ?bool $enabled = null;

    /**
     * 展示排序权重，数值越大越靠前.
     */
    public ?int $sortOrder = null;

    /**
     * Playbook 配置 JSON.
     */
    public ?array $config = null;

    /**
     * 获取 Hyperf 验证规则.
     */
    public static function getHyperfValidationRules(): array
    {
        return [
            'name_i18n' => 'nullable|array',
            'name_i18n.' . LanguageEnum::DEFAULT->value => 'nullable:name_i18n|string',
            'description_i18n' => 'nullable|array',
            'icon' => 'nullable|string|max:64',
            'theme_color' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'enabled' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
            'config' => 'nullable|array',
        ];
    }

    /**
     * 获取 Hyperf 验证消息.
     */
    public static function getHyperfValidationMessage(): array
    {
        return [
            'name_i18n.array' => __('super_magic.agent.name_i18n_must_be_array'),
            'name_i18n.' . LanguageEnum::DEFAULT->value . '.string' => __('super_magic.agent.name_i18n_en_must_be_string'),
            'description_i18n.array' => __('super_magic.agent.description_i18n_must_be_array'),
            'icon.string' => __('super_magic.agent.icon_must_be_string'),
            'icon.max' => __('super_magic.agent.icon_max_length_64'),
            'theme_color.regex' => __('super_magic.agent.theme_color_invalid'),
            'enabled.boolean' => __('super_magic.agent.enabled_must_be_boolean'),
            'sort_order.integer' => __('super_magic.agent.sort_order_must_be_integer'),
            'config.array' => __('super_magic.agent.config_must_be_array'),
        ];
    }

    public function getNameI18n(): ?array
    {
        return $this->nameI18n;
    }

    public function getDescriptionI18n(): ?array
    {
        return $this->descriptionI18n;
    }

    public function getIcon(): ?string
    {
        return $this->icon;
    }

    public function getThemeColor(): ?string
    {
        return $this->themeColor;
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function getSortOrder(): ?int
    {
        return $this->sortOrder;
    }

    public function getConfig(): ?array
    {
        return $this->config;
    }
}
