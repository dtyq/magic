<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Request;

use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishTargetValue;
use App\Infrastructure\Core\AbstractRequestDTO;
use App\Infrastructure\Util\VersionUtil;
use Hyperf\Validation\Rule;

use function Hyperf\Translation\__;

class PublishSkillRequestDTO extends AbstractRequestDTO
{
    public string $version = '';

    public ?array $versionDescriptionI18n = null;

    public string $publishTargetType = 'PRIVATE';

    public ?array $publishTargetValue = null;

    public bool $exportFileFromProject = true;

    /** @var int[] */
    public array $categoryIds = [];

    public function getVersion(): string
    {
        return $this->version;
    }

    public function setVersion(string $version): void
    {
        $this->version = $version;
    }

    public function getVersionDescriptionI18n(): ?array
    {
        return $this->versionDescriptionI18n;
    }

    public function setVersionDescriptionI18n(?array $versionDescriptionI18n): void
    {
        $this->versionDescriptionI18n = $versionDescriptionI18n;
    }

    public function getPublishTargetType(): string
    {
        return $this->publishTargetType;
    }

    public function setPublishTargetType(string $publishTargetType): void
    {
        $this->publishTargetType = $publishTargetType;
    }

    public function getPublishTargetValue(): ?array
    {
        return $this->publishTargetValue;
    }

    public function setPublishTargetValue(?array $publishTargetValue): void
    {
        $this->publishTargetValue = $publishTargetValue;
    }

    public function getExportFileFromProject(): bool
    {
        return $this->exportFileFromProject;
    }

    public function setExportFileFromProject(bool $exportFileFromProject): void
    {
        $this->exportFileFromProject = $exportFileFromProject;
    }

    /** @return int[] */
    public function getCategoryIds(): array
    {
        return array_values(array_unique(array_map('intval', $this->categoryIds)));
    }

    /** @param array<int, int|string> $categoryIds */
    public function setCategoryIds(array $categoryIds): void
    {
        $this->categoryIds = $categoryIds;
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
            'version' => ['required', 'string', 'max:32', VersionUtil::getValidationRule()],
            'version_description_i18n' => 'required|array',
            'version_description_i18n.zh_CN' => 'nullable|string|max:1000',
            'version_description_i18n.en_US' => 'nullable|string|max:1000',
            'publish_target_type' => ['required', 'string', Rule::in(['PRIVATE', 'MEMBER', 'ORGANIZATION', 'MARKET'])],
            'publish_target_value' => 'nullable|array',
            'publish_target_value.user_ids' => 'nullable|array',
            'publish_target_value.user_ids.*' => 'string|max:64',
            'publish_target_value.department_ids' => 'nullable|array',
            'publish_target_value.department_ids.*' => 'string|max:64',
            'export_file_from_project' => 'nullable|boolean',
            'category_ids' => 'exclude_unless:publish_target_type,MARKET|nullable|array|max:100',
            'category_ids.*' => 'integer|min:1',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'version.required' => __('common.parameter_required', ['label' => 'version']),
            'version.string' => __('validation.string', ['attribute' => 'version']),
            'version.max' => __('validation.max.string', ['attribute' => 'version', 'max' => 32]),
            'version.regex' => __('skill.invalid_version_format'),
            'version_description_i18n.required' => __('common.parameter_required', ['label' => 'version_description_i18n']),
            'version_description_i18n.array' => __('validation.array', ['attribute' => 'version_description_i18n']),
            'version_description_i18n.zh_CN.string' => __('validation.string', ['attribute' => 'version_description_i18n.zh_CN']),
            'version_description_i18n.zh_CN.max' => __('validation.max.string', ['attribute' => 'version_description_i18n.zh_CN', 'max' => 1000]),
            'version_description_i18n.en_US.string' => __('validation.string', ['attribute' => 'version_description_i18n.en_US']),
            'version_description_i18n.en_US.max' => __('validation.max.string', ['attribute' => 'version_description_i18n.en_US', 'max' => 1000]),
            'publish_target_type.required' => __('common.parameter_required', ['label' => 'publish_target_type']),
            'publish_target_type.string' => __('validation.string', ['attribute' => 'publish_target_type']),
            'publish_target_type.in' => __('skill.publish_target_type_invalid'),
            'publish_target_value.array' => __('validation.array', ['attribute' => 'publish_target_value']),
            'publish_target_value.user_ids.array' => __('validation.array', ['attribute' => 'publish_target_value.user_ids']),
            'publish_target_value.user_ids.*.string' => __('validation.string', ['attribute' => 'publish_target_value.user_ids']),
            'publish_target_value.user_ids.*.max' => __('validation.max.string', ['attribute' => 'publish_target_value.user_ids', 'max' => 64]),
            'publish_target_value.department_ids.array' => __('validation.array', ['attribute' => 'publish_target_value.department_ids']),
            'publish_target_value.department_ids.*.string' => __('validation.string', ['attribute' => 'publish_target_value.department_ids']),
            'publish_target_value.department_ids.*.max' => __('validation.max.string', ['attribute' => 'publish_target_value.department_ids', 'max' => 64]),
            'export_file_from_project.boolean' => __('validation.boolean', ['attribute' => 'export_file_from_project']),
        ];
    }
}
