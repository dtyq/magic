<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use JsonSerializable;

/**
 * 市场技能列表项 DTO.
 */
class SkillMarketListItemDTO implements JsonSerializable
{
    private int $id;

    private string $skillCode;

    private string $userSkillCode;

    private array $nameI18n;

    private array $descriptionI18n;

    private string $logo;

    private string $publisherType;

    private array $publisher;

    private string $publishStatus;

    private bool $isAdded;

    private bool $needUpgrade;

    private string $createdAt;

    private string $updatedAt;

    private string $name;

    private string $description;

    public function __construct(
        int $id,
        string $skillCode,
        string $userSkillCode,
        string $name,
        string $description,
        array $nameI18n,
        array $descriptionI18n,
        string $logo,
        string $publisherType,
        array $publisher,
        string $publishStatus,
        bool $isAdded,
        bool $needUpgrade,
        string $createdAt,
        string $updatedAt
    ) {
        $this->id = $id;
        $this->skillCode = $skillCode;
        $this->userSkillCode = $userSkillCode;
        $this->name = $name;
        $this->description = $description;
        $this->nameI18n = $nameI18n;
        $this->descriptionI18n = $descriptionI18n;
        $this->logo = $logo;
        $this->publisherType = $publisherType;
        $this->publisher = $publisher;
        $this->publishStatus = $publishStatus;
        $this->isAdded = $isAdded;
        $this->needUpgrade = $needUpgrade;
        $this->createdAt = $createdAt;
        $this->updatedAt = $updatedAt;
    }

    public function jsonSerialize(): array
    {
        return [
            'id' => (string) $this->id,
            'skill_code' => $this->skillCode,
            'user_skill_code' => $this->userSkillCode,
            'name' => $this->name,
            'description' => $this->description,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'logo' => $this->logo,
            'publisher_type' => $this->publisherType,
            'publisher' => $this->publisher,
            'publish_status' => $this->publishStatus,
            'is_added' => $this->isAdded,
            'need_upgrade' => $this->needUpgrade,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
