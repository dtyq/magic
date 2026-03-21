<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use App\Interfaces\Kernel\DTO\OperatorDTO;
use JsonSerializable;

/**
 * 技能列表项 DTO.
 */
class SkillListItemDTO implements JsonSerializable
{
    private string $id;

    private string $code;

    private array $nameI18n;

    private array $descriptionI18n;

    private string $logo;

    private string $sourceType;

    private int $isEnabled;

    private ?string $pinnedAt;

    private string $updatedAt;

    private string $createdAt;

    private ?string $latestPublishedAt;

    private string $latestVersion;

    private string $name;

    private string $description;

    private ?OperatorDTO $creatorInfo;

    public function __construct(
        string $id,
        string $code,
        string $name,
        string $description,
        array $nameI18n,
        array $descriptionI18n,
        string $logo,
        string $sourceType,
        int $isEnabled,
        ?string $pinnedAt,
        string $updatedAt,
        string $createdAt,
        ?string $latestPublishedAt,
        string $latestVersion = '',
        ?OperatorDTO $creatorInfo = null
    ) {
        $this->id = $id;
        $this->code = $code;
        $this->name = $name;
        $this->description = $description;
        $this->nameI18n = $nameI18n;
        $this->descriptionI18n = $descriptionI18n;
        $this->logo = $logo;
        $this->sourceType = $sourceType;
        $this->isEnabled = $isEnabled;
        $this->pinnedAt = $pinnedAt;
        $this->updatedAt = $updatedAt;
        $this->createdAt = $createdAt;
        $this->latestPublishedAt = $latestPublishedAt;
        $this->latestVersion = $latestVersion;
        $this->creatorInfo = $creatorInfo;
    }

    public function jsonSerialize(): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'logo' => $this->logo,
            'source_type' => $this->sourceType,
            'is_enabled' => $this->isEnabled,
            'pinned_at' => $this->pinnedAt,
            'latest_published_at' => $this->latestPublishedAt,
            'latest_version' => $this->latestVersion,
            'updated_at' => $this->updatedAt,
            'created_at' => $this->createdAt,
            'creator_info' => $this->creatorInfo,
        ];
    }
}
