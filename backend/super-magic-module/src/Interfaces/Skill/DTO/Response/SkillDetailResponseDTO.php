<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use JsonSerializable;

/**
 * 技能详情响应 DTO.
 */
class SkillDetailResponseDTO implements JsonSerializable
{
    private int $id;

    private string $code;

    private ?int $versionId;

    private ?string $versionCode;

    private string $sourceType;

    private int $isEnabled;

    private ?string $pinnedAt;

    private array $nameI18n;

    private array $descriptionI18n;

    private string $logo;

    private string $packageName;

    private ?string $packageDescription;

    private string $fileKey;

    private ?string $fileUrl = null;

    private ?int $sourceId;

    private ?array $sourceMeta;

    private ?int $projectId;

    private string $createdAt;

    private string $updatedAt;

    public function __construct(
        int $id,
        string $code,
        ?int $versionId,
        ?string $versionCode,
        string $sourceType,
        int $isEnabled,
        ?string $pinnedAt,
        array $nameI18n,
        array $descriptionI18n,
        string $logo,
        string $packageName,
        ?string $packageDescription,
        string $fileKey,
        string $fileUrl,
        ?int $sourceId,
        ?array $sourceMeta,
        ?int $projectId,
        string $createdAt,
        string $updatedAt
    ) {
        $this->id = $id;
        $this->code = $code;
        $this->versionId = $versionId;
        $this->versionCode = $versionCode;
        $this->sourceType = $sourceType;
        $this->isEnabled = $isEnabled;
        $this->pinnedAt = $pinnedAt;
        $this->nameI18n = $nameI18n;
        $this->descriptionI18n = $descriptionI18n;
        $this->logo = $logo;
        $this->packageName = $packageName;
        $this->packageDescription = $packageDescription;
        $this->fileKey = $fileKey;
        $this->fileUrl = $fileUrl;
        $this->sourceId = $sourceId;
        $this->sourceMeta = $sourceMeta;
        $this->projectId = $projectId;
        $this->createdAt = $createdAt;
        $this->updatedAt = $updatedAt;
    }

    public function getProjectId(): ?int
    {
        return $this->projectId;
    }

    public function getPackageName(): string
    {
        return $this->packageName;
    }

    public function setProjectId(?int $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function jsonSerialize(): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            'version_id' => $this->versionId,
            'version_code' => $this->versionCode,
            'source_type' => $this->sourceType,
            'is_enabled' => $this->isEnabled,
            'pinned_at' => $this->pinnedAt,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'logo' => $this->logo,
            'package_name' => $this->packageName,
            'package_description' => $this->packageDescription,
            'file_key' => $this->fileKey,
            'file_url' => $this->fileUrl,
            'source_id' => $this->sourceId,
            'source_meta' => $this->sourceMeta,
            'project_id' => $this->projectId === null ? null : (string) $this->projectId,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
