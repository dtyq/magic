<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 创建员工请求 DTO.
 */
class CreateAgentRequestDTO extends AbstractRequestDTO
{
    /**
     * code.
     */
    public ?string $code = null;

    /**
     * 多语言名称.
     */
    public ?array $nameI18n = null;

    /**
     * 角色定位（多语言）.
     */
    public ?array $roleI18n = null;

    /**
     * 多语言描述.
     */
    public ?array $descriptionI18n = null;

    /**
     * Agent图标.
     * 格式: {"url": "...", "type": "...", "color": "..."}.
     */
    public ?array $icon = null;

    /**
     * 图标类型 1:图标 2:图片.
     */
    public int $iconType = 1;

    /**
     * Prompt 混淆代码.
     */
    public ?string $promptShadow = null;

    /**
     * @phpstan-ignore-next-line property.unusedType
     */
    private ?array $visibilityConfig = null;

    private array $prompt = [];

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function getNameI18n(): ?array
    {
        return $this->nameI18n;
    }

    public function getRoleI18n(): ?array
    {
        return $this->roleI18n;
    }

    public function getDescriptionI18n(): ?array
    {
        return $this->descriptionI18n;
    }

    public function getVisibilityConfig(): ?array
    {
        return $this->visibilityConfig;
    }

    public function getIcon(): ?array
    {
        return $this->icon;
    }

    public function getIconType(): ?int
    {
        return $this->iconType;
    }

    public function getPromptShadow(): ?string
    {
        return $this->promptShadow;
    }

    public function getPrompt(): array
    {
        return $this->prompt;
    }

    public function setPrompt(array $prompt): void
    {
        $this->prompt = $prompt;
    }

    /**
     * 获取验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
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
            'visibilityConfig' => 'nullable|array',
        ];
    }

    /**
     * 获取验证错误消息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'name_i18n.required' => __('crew.name_i18n_required'),
            'name_i18n.array' => __('crew.name_i18n_must_be_array'),
            'name_i18n.en_US.required' => __('crew.name_i18n_en_required'),
            'name_i18n.en_US.string' => __('crew.name_i18n_en_must_be_string'),
            'role_i18n.array' => __('crew.role_i18n_must_be_array'),
            'description_i18n.array' => __('crew.description_i18n_must_be_array'),
            'icon.array' => __('crew.icon_must_be_array'),
            'icon_type.integer' => __('crew.icon_type_must_be_integer'),
            'icon_type.in' => __('crew.icon_type_invalid'),
            'prompt_shadow.string' => __('crew.prompt_shadow_must_be_string'),
        ];
    }
}
