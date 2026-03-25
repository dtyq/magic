<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use JsonSerializable;

/**
 * Response DTO for a published market skill detail page.
 */
class SkillMarketDetailResponseDTO implements JsonSerializable
{
    public function __construct(
        private readonly string $code,
        private readonly string $name,
        private readonly string $description,
        private readonly string $source,
        private readonly array $nameI18n,
        private readonly array $descriptionI18n,
        private readonly array $sourceI18n,
        private readonly string $skillFileUrl,
        private readonly string $versionCode,
        private readonly string $packageName,
        private readonly string $versionCreatedAt,
        private readonly string $logo,
        private readonly string $publisherType,
        private readonly array $publisher,
        private readonly bool $isAdded,
        private readonly bool $isCreator,
        private readonly bool $isFeatured,
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'source' => $this->source,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'source_i18n' => $this->sourceI18n,
            'skill_file_url' => $this->skillFileUrl,
            'version_code' => $this->versionCode,
            'package_name' => $this->packageName,
            'version_created_at' => $this->versionCreatedAt,
            'logo' => $this->logo,
            'publisher_type' => $this->publisherType,
            'publisher' => $this->publisher,
            'is_added' => $this->isAdded,
            'is_creator' => $this->isCreator,
            'is_featured' => $this->isFeatured,
        ];
    }
}
