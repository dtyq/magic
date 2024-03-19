<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 获取员工详情响应 DTO.
 */
class GetEmployeeDetailResponseDTO extends AbstractDTO
{
    private int $id;

    private string $code;

    private ?string $versionCode = null;

    private ?string $versionId = null;

    private string $name = '';

    private string $description = '';

    private array $nameI18n;

    private ?array $roleI18n;

    private ?array $descriptionI18n;

    /**
     * Agent图标.
     * 格式: {"url": "...", "type": "...", "color": "..."}.
     */
    private array $icon;

    /**
     * 图标类型 1:图标 2:图片.
     */
    private int $iconType;

    private ?array $prompt;

    private bool $enabled;

    private string $sourceType;

    private ?string $pinnedAt;

    private string $createdAt;

    private string $updatedAt;

    private ?int $projectId = null;

    public function __construct(
        int $id,
        string $code,
        ?string $versionCode,
        ?string $versionId,
        ?string $name,
        ?string $description,
        array $nameI18n,
        ?array $roleI18n,
        ?array $descriptionI18n,
        array $icon,
        int $iconType,
        ?array $prompt,
        bool $enabled,
        string $sourceType,
        ?string $pinnedAt,
        ?int $projectId,
        string $createdAt,
        string $updatedAt
    ) {
        $this->id = $id;
        $this->code = $code;
        $this->versionCode = $versionCode;
        $this->versionId = $versionId;
        $this->name = $name;
        $this->description = $description;
        $this->nameI18n = $nameI18n;
        $this->roleI18n = $roleI18n;
        $this->descriptionI18n = $descriptionI18n;
        $this->icon = $icon;
        $this->iconType = $iconType;
        $this->prompt = $prompt;
        $this->enabled = $enabled;
        $this->sourceType = $sourceType;
        $this->pinnedAt = $pinnedAt;
        $this->projectId = $projectId;
        $this->createdAt = $createdAt;
        $this->updatedAt = $updatedAt;
    }

    public function getProjectId(): ?int
    {
        return $this->projectId;
    }

    public function setProjectId(?int $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getName(): string
    {
        return $this->name;
    }

    /**
     * 转换为数组（输出保持下划线命名，以保持API兼容性）.
     */
    public function toArray(): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            'version_code' => $this->versionCode,
            'version_id' => $this->versionId,
            'name' => $this->name,
            'description' => $this->description,
            'name_i18n' => $this->nameI18n,
            'role_i18n' => $this->roleI18n,
            'description_i18n' => $this->descriptionI18n,
            'icon' => $this->icon,
            'icon_type' => $this->iconType,
            'prompt' => $this->prompt,
            'enabled' => $this->enabled,
            'source_type' => $this->sourceType,
            'pinned_at' => $this->pinnedAt,
            'project_id' => $this->projectId ? (string) $this->projectId : null,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
