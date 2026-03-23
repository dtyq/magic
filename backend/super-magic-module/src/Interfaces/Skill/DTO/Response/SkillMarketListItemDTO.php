<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use JsonSerializable;

/**
 * 市场技能列表项 DTO.
 *
 * JSON 输出说明：
 * - `code`：技能唯一编码，请新接入方优先使用。
 * - `skill_code`、`user_skill_code`：与 `code` 相同，仅为兼容旧版客户端保留，后续可能移除，请勿在新逻辑中依赖。
 */
class SkillMarketListItemDTO implements JsonSerializable
{
    private int $id;

    /**
     * 技能编码（与 JSON `code` 一致；`skill_code` / `user_skill_code` 为兼容字段，已废弃语义）.
     */
    private string $code;

    /** @deprecated 仅序列化为 `skill_code`，请改用 `code` */
    private string $skillCode;

    /** @deprecated 仅序列化为 `user_skill_code`，请改用 `code` */
    private string $userSkillCode;

    private array $nameI18n;

    private array $descriptionI18n;

    private string $logo;

    private string $publisherType;

    private array $publisher;

    private string $publishStatus;

    private bool $isAdded;

    private bool $needUpgrade;

    private bool $isCreator;

    private string $createdAt;

    private string $updatedAt;

    private string $name;

    private string $description;

    private string $fileKey;

    private ?string $fileUrl;

    private string $packageName;

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
        bool $isCreator,
        string $createdAt,
        string $updatedAt,
        string $fileKey = '',
        ?string $fileUrl = null,
        string $packageName = '',
    ) {
        $this->id = $id;
        $this->code = $skillCode;
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
        $this->isCreator = $isCreator;
        $this->createdAt = $createdAt;
        $this->updatedAt = $updatedAt;
        $this->fileKey = $fileKey;
        $this->fileUrl = $fileUrl;
        $this->packageName = $packageName;
    }

    public function jsonSerialize(): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            // Deprecated: same as `code`, kept for backward compatibility only.
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
            'is_creator' => $this->isCreator,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'file_key' => $this->fileKey,
            'file_url' => $this->fileUrl,
            'package_name' => $this->packageName,
        ];
    }
}
