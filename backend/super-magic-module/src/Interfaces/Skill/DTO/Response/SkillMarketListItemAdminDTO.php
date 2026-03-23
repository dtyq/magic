<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Skill 市场列表项 Admin DTO.
 */
class SkillMarketListItemAdminDTO extends AbstractDTO
{
    public function __construct(
        private readonly string $id,
        private readonly OrganizationInfoAdminDTO $organization,
        private readonly string $skillCode,
        private readonly string $skillVersionId,
        private readonly string $packageName,
        private readonly array $nameI18n,
        private readonly array $descriptionI18n,
        private readonly ?string $logo,
        private readonly string $publisherId,
        private readonly string $publisherType,
        private readonly ?int $categoryId,
        private readonly string $publishStatus,
        private readonly int $installCount,
        private readonly ?int $sortOrder,
        private readonly PublisherInfoAdminDTO $publisher,
        private readonly ?string $createdAt,
        private readonly ?string $updatedAt,
    ) {
    }

    public function toArray(): array
    {
        $organization = $this->organization->toArray();

        return [
            'id' => $this->id,
            'organization_code' => $organization['code'],
            'organization' => $organization,
            'skill_code' => $this->skillCode,
            'skill_version_id' => $this->skillVersionId,
            'package_name' => $this->packageName,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'logo' => $this->logo,
            'publisher_id' => $this->publisherId,
            'publisher_type' => $this->publisherType,
            'category_id' => $this->categoryId,
            'publish_status' => $this->publishStatus,
            'install_count' => $this->installCount,
            'sort_order' => $this->sortOrder,
            'publisher' => $this->publisher->toArray(),
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
