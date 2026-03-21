<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Skill 版本列表项 Admin DTO - 用于管理后台版本列表查询.
 */
class SkillVersionListItemAdminDTO extends AbstractDTO
{
    public function __construct(
        private readonly string $id,
        private readonly string $code,
        private readonly string $packageName,
        private readonly array $nameI18n,
        private readonly array $descriptionI18n,
        private readonly string $version,
        private readonly string $publishStatus,
        private readonly string $reviewStatus,
        private readonly string $publishTargetType,
        private readonly string $sourceType,
        private readonly PublisherInfoAdminDTO $publisher,
        private readonly string $createdAt,
        private readonly ?string $publishedAt,
    ) {
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'package_name' => $this->packageName,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'version' => $this->version,
            'publish_status' => $this->publishStatus,
            'review_status' => $this->reviewStatus,
            'publish_target_type' => $this->publishTargetType,
            'source_type' => $this->sourceType,
            'publisher' => $this->publisher->toArray(),
            'created_at' => $this->createdAt,
            'published_at' => $this->publishedAt,
        ];
    }
}
