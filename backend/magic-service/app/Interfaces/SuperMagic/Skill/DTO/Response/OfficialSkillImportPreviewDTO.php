<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Response;

use JsonSerializable;

final readonly class OfficialSkillImportPreviewDTO implements JsonSerializable
{
    public function __construct(
        private string $importToken,
        private string $code,
        private string $packageName,
        private string $packageDescription,
        private bool $isUpdate,
        private array $nameI18n = [],
        private array $descriptionI18n = [],
        private string $logo = '',
        private string $id = '',
        private string $publisherType = 'OFFICIAL',
        private bool $isFeatured = false,
        private bool $isHidden = false,
        private ?int $sortOrder = 0,
        private string $version = '',
        private array $categories = [],
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'import_token' => $this->importToken,
            'package_name' => $this->packageName,
            'code' => $this->code,
            'package_description' => $this->packageDescription,
            'is_update' => $this->isUpdate,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'logo' => $this->logo,
            'id' => $this->id,
            'publisher_type' => $this->publisherType,
            'is_featured' => $this->isFeatured,
            'is_hidden' => $this->isHidden,
            'sort_order' => $this->sortOrder,
            'version' => $this->version,
            'categories' => $this->categories,
        ];
    }
}
