<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Response;

use JsonSerializable;

/**
 * 技能列表项 DTO.
 */
class SkillListItemDTO implements JsonSerializable
{
    private string $id;

    private string $code;

    private ?string $projectId;

    private string $logo;

    private string $sourceType;

    private int $isEnabled;

    private ?string $pinnedAt;

    private string $updatedAt;

    private string $createdAt;

    private ?string $latestPublishedAt;

    private ?string $latestVersion = null;

    private ?string $packageName = null;

    private string $name;

    private string $description;

    private string $source;

    private ?array $creatorInfo;

    private ?string $publisherType;

    private ?array $publisher = null;

    private ?string $userRole = null;

    private ?array $nameI18n;

    private ?array $descriptionI18n;

    private ?array $sourceI18n;

    public function __construct(
        string $id,
        string $code,
        ?string $projectId,
        string $name,
        string $description,
        string $source,
        string $logo,
        string $sourceType,
        int $isEnabled,
        ?string $pinnedAt,
        string $updatedAt,
        string $createdAt,
        ?string $latestPublishedAt,
        ?string $latestVersion = '',
        ?string $packageName = '',
        ?array $creatorInfo = null,
        ?string $publisherType = null,
        ?array $publisher = null,
        ?string $userRole = null,
        ?array $nameI18n = null,
        ?array $descriptionI18n = null,
        ?array $sourceI18n = null,
    ) {
        $this->id = $id;
        $this->code = $code;
        $this->projectId = $projectId;
        $this->name = $name;
        $this->description = $description;
        $this->source = $source;
        $this->logo = $logo;
        $this->sourceType = $sourceType;
        $this->isEnabled = $isEnabled;
        $this->pinnedAt = $pinnedAt;
        $this->updatedAt = $updatedAt;
        $this->createdAt = $createdAt;
        $this->latestPublishedAt = $latestPublishedAt;
        $this->latestVersion = $latestVersion;
        $this->packageName = $packageName;
        $this->creatorInfo = $creatorInfo;
        $this->publisherType = $publisherType;
        $this->publisher = $publisher;
        $this->userRole = $userRole;
        $this->nameI18n = $nameI18n;
        $this->descriptionI18n = $descriptionI18n;
        $this->sourceI18n = $sourceI18n;
    }

    public function jsonSerialize(): array
    {
        $payload = [
            'id' => (string) $this->id,
            'code' => $this->code,
            'project_id' => $this->projectId,
            'name' => $this->name,
            'description' => $this->description,
            'source' => $this->source,
            'logo' => $this->logo,
            'source_type' => $this->sourceType,
            'is_enabled' => $this->isEnabled,
            'pinned_at' => $this->pinnedAt,
            'latest_published_at' => $this->latestPublishedAt,
            'latest_version' => $this->latestVersion,
            'package_name' => $this->packageName,
            'updated_at' => $this->updatedAt,
            'created_at' => $this->createdAt,
            'creator_info' => $this->creatorInfo,
            'publisher_type' => $this->publisherType,
            'publisher' => $this->publisher,
            'user_role' => $this->userRole,
        ];

        if ($this->nameI18n !== null) {
            $payload['name_i18n'] = $this->nameI18n;
            $payload['description_i18n'] = $this->descriptionI18n ?? [];
            $payload['source_i18n'] = $this->sourceI18n ?? [];
        }

        return $payload;
    }
}
