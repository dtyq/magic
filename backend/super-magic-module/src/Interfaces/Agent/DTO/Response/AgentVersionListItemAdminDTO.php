<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\OrganizationInfoAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\PublisherInfoAdminDTO;

/**
 * 管理后台：Agent 版本列表项 DTO.
 */
class AgentVersionListItemAdminDTO extends AbstractDTO
{
    public function __construct(
        private readonly string $id,
        private readonly OrganizationInfoAdminDTO $organization,
        private readonly string $code,
        private readonly array $nameI18n,
        private readonly ?array $roleI18n,
        private readonly ?array $descriptionI18n,
        private readonly string $version,
        private readonly string $publishStatus,
        private readonly string $reviewStatus,
        private readonly string $publishTargetType,
        private readonly int $type,
        private readonly bool $isCurrentVersion,
        private readonly PublisherInfoAdminDTO $publisher,
        private readonly string $createdAt,
        private readonly ?string $publishedAt,
    ) {
    }

    public function toArray(): array
    {
        $organization = $this->organization->toArray();

        return [
            'id' => $this->id,
            'organization_code' => $organization['code'],
            'organization' => $organization,
            'code' => $this->code,
            'name_i18n' => $this->nameI18n,
            'role_i18n' => $this->roleI18n,
            'description_i18n' => $this->descriptionI18n,
            'version' => $this->version,
            'publish_status' => $this->publishStatus,
            'review_status' => $this->reviewStatus,
            'publish_target_type' => $this->publishTargetType,
            'type' => $this->type,
            'is_current_version' => $this->isCurrentVersion,
            'publisher' => $this->publisher->toArray(),
            'created_at' => $this->createdAt,
            'published_at' => $this->publishedAt,
        ];
    }
}
