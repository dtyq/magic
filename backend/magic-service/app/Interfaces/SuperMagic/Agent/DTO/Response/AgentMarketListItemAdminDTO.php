<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\OrganizationInfoAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\PublisherInfoAdminDTO;

/**
 * 管理后台：Agent 市场列表项 DTO.
 */
class AgentMarketListItemAdminDTO extends AbstractDTO
{
    public function __construct(
        private readonly string $id,
        private readonly OrganizationInfoAdminDTO $organization,
        private readonly string $agentCode,
        private readonly string $agentVersionId,
        private readonly array $nameI18n,
        private readonly array $roleI18n,
        private readonly array $descriptionI18n,
        private readonly ?array $icon,
        private readonly int $iconType,
        private readonly string $publisherId,
        private readonly string $publisherType,
        private readonly array $categoryIds,
        private readonly array $categories,
        private readonly string $publishStatus,
        private readonly int $installCount,
        private readonly ?int $sortOrder,
        private readonly bool $isFeatured,
        private readonly bool $isHidden,
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
            'agent_code' => $this->agentCode,
            'agent_version_id' => $this->agentVersionId,
            'name_i18n' => $this->nameI18n,
            'role_i18n' => $this->roleI18n,
            'description_i18n' => $this->descriptionI18n,
            'icon' => $this->icon,
            'icon_type' => $this->iconType,
            'publisher_id' => $this->publisherId,
            'publisher_type' => $this->publisherType,
            'category_ids' => array_map(static fn (int $categoryId): string => (string) $categoryId, $this->categoryIds),
            'categories' => $this->categories,
            'publish_status' => $this->publishStatus,
            'install_count' => $this->installCount,
            'sort_order' => $this->sortOrder,
            'is_featured' => $this->isFeatured,
            'is_hidden' => $this->isHidden,
            'publisher' => $this->publisher->toArray(),
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
