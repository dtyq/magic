<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishTargetValue;
use Hyperf\Validation\Rule;

use function Hyperf\Translation\__;

class PublishAgentRequestDTO extends AbstractRequestDTO
{
    public string $version = '';

    public ?array $versionDescriptionI18n = null;

    public string $publishTargetType = 'PRIVATE';

    public ?array $publishTargetValue = null;

    public function getVersion(): string
    {
        return $this->version;
    }

    public function getVersionDescriptionI18n(): ?array
    {
        return $this->versionDescriptionI18n;
    }

    public function getPublishTargetType(): string
    {
        return $this->publishTargetType;
    }

    public function getPublishTargetValue(): ?array
    {
        return $this->publishTargetValue;
    }

    public function toPublishTargetValue(): ?PublishTargetValue
    {
        return PublishTargetValue::fromArray($this->publishTargetValue);
    }

    /**
     * @return array<string>
     */
    public function getPublishTargetUserIds(): array
    {
        return $this->toPublishTargetValue()?->getUserIds() ?? [];
    }

    /**
     * @return array<string>
     */
    public function getPublishTargetDepartmentIds(): array
    {
        return $this->toPublishTargetValue()?->getDepartmentIds() ?? [];
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'version' => 'required|string|max:32',
            'version_description_i18n' => 'required|array',
            'version_description_i18n.zh_CN' => 'nullable|string|max:1000',
            'version_description_i18n.en_US' => 'nullable|string|max:1000',
            'publish_target_type' => ['required', 'string', Rule::in(['PRIVATE', 'MEMBER', 'ORGANIZATION', 'MARKET'])],
            'publish_target_value' => 'nullable|array',
            'publish_target_value.user_ids' => 'nullable|array',
            'publish_target_value.user_ids.*' => 'string|max:64',
            'publish_target_value.department_ids' => 'nullable|array',
            'publish_target_value.department_ids.*' => 'string|max:64',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'version.required' => __('common.parameter_required', ['label' => 'version']),
            'version.string' => __('validation.string', ['attribute' => 'version']),
            'version.max' => __('validation.max.string', ['attribute' => 'version', 'max' => 32]),
            'version_description_i18n.required' => __('common.parameter_required', ['label' => 'version_description_i18n']),
            'version_description_i18n.array' => __('validation.array', ['attribute' => 'version_description_i18n']),
            'version_description_i18n.zh_CN.string' => __('validation.string', ['attribute' => 'version_description_i18n.zh_CN']),
            'version_description_i18n.zh_CN.max' => __('validation.max.string', ['attribute' => 'version_description_i18n.zh_CN', 'max' => 1000]),
            'version_description_i18n.en_US.string' => __('validation.string', ['attribute' => 'version_description_i18n.en_US']),
            'version_description_i18n.en_US.max' => __('validation.max.string', ['attribute' => 'version_description_i18n.en_US', 'max' => 1000]),
            'publish_target_type.required' => __('common.parameter_required', ['label' => 'publish_target_type']),
            'publish_target_type.string' => __('validation.string', ['attribute' => 'publish_target_type']),
            'publish_target_type.in' => __('super_magic.agent.publish_target_type_invalid'),
            'publish_target_value.array' => __('validation.array', ['attribute' => 'publish_target_value']),
            'publish_target_value.user_ids.array' => __('validation.array', ['attribute' => 'publish_target_value.user_ids']),
            'publish_target_value.user_ids.*.string' => __('validation.string', ['attribute' => 'publish_target_value.user_ids']),
            'publish_target_value.user_ids.*.max' => __('validation.max.string', ['attribute' => 'publish_target_value.user_ids', 'max' => 64]),
            'publish_target_value.department_ids.array' => __('validation.array', ['attribute' => 'publish_target_value.department_ids']),
            'publish_target_value.department_ids.*.string' => __('validation.string', ['attribute' => 'publish_target_value.department_ids']),
            'publish_target_value.department_ids.*.max' => __('validation.max.string', ['attribute' => 'publish_target_value.department_ids', 'max' => 64]),
        ];
    }
}
