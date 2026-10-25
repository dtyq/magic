<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Request;

use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublisherType;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishStatus;
use App\Infrastructure\Core\AbstractRequestDTO;
use App\Infrastructure\Util\VersionUtil;
use Hyperf\Validation\ValidationException;

use function Hyperf\Translation\__;

class ImportOfficialSkillRequestDTO extends AbstractRequestDTO
{
    public string $importToken = '';

    public string $fileKey = '';

    public string $version = '';

    public array $nameI18n = [];

    public array $descriptionI18n = [];

    public array $sourceI18n = [];

    public string $logo = '';

    public array $categoryIds = [];

    public string $publisherType = PublisherType::OFFICIAL->value;

    public string $publishStatus = 'OFFLINE';

    public bool $isHidden = false;

    public bool $isFeatured = false;

    public int $sortOrder = 0;

    public function getImportToken(): string
    {
        return $this->importToken;
    }

    public function getFileKey(): string
    {
        return $this->fileKey;
    }

    public function getVersion(): string
    {
        return $this->version;
    }

    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    public function getDescriptionI18n(): array
    {
        return $this->descriptionI18n;
    }

    public function getSourceI18n(): array
    {
        return $this->sourceI18n;
    }

    public function getLogo(): string
    {
        return $this->logo;
    }

    /** @return array<int, string> */
    public function getCategoryIdList(): array
    {
        $categoryIds = [];
        foreach ($this->categoryIds as $categoryId) {
            $categoryId = (string) $categoryId;
            if ($categoryId !== '' && ! in_array($categoryId, $categoryIds, true)) {
                $categoryIds[] = $categoryId;
            }
        }

        return $categoryIds;
    }

    public function getPublisherType(): string
    {
        return $this->publisherType;
    }

    public function getPublishStatus(): string
    {
        return $this->publishStatus;
    }

    public function isHidden(): bool
    {
        return $this->isHidden;
    }

    public function isFeatured(): bool
    {
        return $this->isFeatured;
    }

    public function getSortOrder(): int
    {
        return $this->sortOrder;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'import_token' => 'nullable|string',
            'file_key' => 'nullable|string',
            'version' => ['required', 'string', 'max:32', VersionUtil::getValidationRule()],
            'name_i18n' => 'required|array',
            'name_i18n.default' => 'required|string',
            'description_i18n' => 'required|array',
            'description_i18n.default' => 'required|string',
            'source_i18n' => 'nullable|array',
            'logo' => 'nullable|string',
            'category_ids' => 'nullable|array|max:100',
            'category_ids.*' => 'required|string|regex:/^\d+$/',
            'publisher_type' => 'sometimes|string|in:' . PublisherType::OFFICIAL->value,
            'publish_status' => 'nullable|string|in:' . implode(',', [PublishStatus::OFFLINE->value, PublishStatus::PUBLISHED->value]),
            'is_hidden' => 'nullable|boolean',
            'is_featured' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'version.required' => __('skill.version_required'),
            'version.regex' => __('skill.invalid_version_format'),
            'name_i18n.default.required' => __('skill.name_i18n_default_required'),
            'description_i18n.default.required' => __('skill.description_i18n_default_required'),
        ];
    }

    protected static function checkParams(array $params): array
    {
        $validated = parent::checkParams($params);
        $hasToken = trim((string) ($params['import_token'] ?? '')) !== '';
        $hasFileKey = trim((string) ($params['file_key'] ?? '')) !== '';
        if ($hasToken === $hasFileKey) {
            throw ValidationException::withMessages([
                $hasToken ? 'file_key' : 'import_token' => $hasToken
                    ? __('skill.official_import_source_conflict')
                    : __('skill.official_import_source_required'),
            ]);
        }
        return $validated;
    }
}
