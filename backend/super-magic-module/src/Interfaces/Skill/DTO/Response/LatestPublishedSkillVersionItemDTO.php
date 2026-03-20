<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use JsonSerializable;

class LatestPublishedSkillVersionItemDTO implements JsonSerializable
{
    public function __construct(
        private readonly string $id,
        private readonly string $code,
        private readonly string $version,
        private readonly string $name,
        private readonly string $description,
        private readonly array $nameI18n,
        private readonly ?array $descriptionI18n,
        private readonly string $logo,
        private readonly ?string $fileKey,
        private readonly ?string $fileUrl,
        private readonly string $sourceType,
        private readonly string $publishStatus,
        private readonly ?string $reviewStatus,
        private readonly string $publishTargetType,
        private readonly ?string $publishedAt,
        private readonly ?int $projectId,
        private readonly ?string $createdAt,
        private readonly ?string $updatedAt,
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'version' => $this->version,
            'name' => $this->name,
            'description' => $this->description,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'logo' => $this->logo,
            'file_key' => $this->fileKey,
            'file_url' => $this->fileUrl,
            'source_type' => $this->sourceType,
            'publish_status' => $this->publishStatus,
            'review_status' => $this->reviewStatus,
            'publish_target_type' => $this->publishTargetType,
            'published_at' => $this->publishedAt,
            'project_id' => $this->projectId === null ? null : (string) $this->projectId,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
