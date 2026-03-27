<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * Request DTO for updating skill basic information.
 */
class UpdateSkillInfoRequestDTO extends AbstractRequestDTO
{
    /**
     * Name in i18n format.
     */
    public ?array $nameI18n = null;

    /**
     * Description in i18n format.
     */
    public ?array $descriptionI18n = null;

    /**
     * Source information in i18n format.
     */
    public ?array $sourceI18n = null;

    /**
     * Logo URL.
     */
    public ?string $logo = null;

    /**
     * Get the name in i18n format.
     */
    public function getNameI18n(): ?array
    {
        return $this->nameI18n;
    }

    /**
     * Get the description in i18n format.
     */
    public function getDescriptionI18n(): ?array
    {
        return $this->descriptionI18n;
    }

    /**
     * Get the source information in i18n format.
     */
    public function getSourceI18n(): ?array
    {
        return $this->sourceI18n;
    }

    /**
     * Get the logo URL.
     */
    public function getLogo(): ?string
    {
        return $this->logo;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'name_i18n' => 'nullable|array',
            'name_i18n.default' => 'required_with:name_i18n|string',
            'description_i18n' => 'nullable|array',
            'source_i18n' => 'nullable|array',
            'logo' => 'nullable|string',
        ];
    }

    /**
     * Get validation error messages.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'name_i18n.array' => __('skill.name_i18n_must_be_array'),
            'name_i18n.default.required_with' => __('skill.name_i18n_en_required'),
            'name_i18n.default.string' => __('skill.name_i18n_en_must_be_string'),
            'description_i18n.array' => __('skill.description_i18n_must_be_array'),
            'source_i18n.array' => __('validation.array', ['attribute' => 'source_i18n']),
            'logo.string' => __('skill.logo_must_be_string'),
        ];
    }
}
