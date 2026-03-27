<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 获取 Agent 详情响应 DTO.
 */
class GetAgentDetailResponseDTO extends AbstractDTO
{
    private string $id;

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
    private ?array $icon;

    /**
     * 图标类型 1:图标 2:图片.
     */
    private int $iconType;

    private ?array $prompt;

    private bool $enabled;

    private string $sourceType;

    /**
     * 实际语义表示“市场来源的 Agent 是否已从市场下架”.
     */
    private ?bool $isStoreOffline;

    private ?string $pinnedAt;

    /**
     * 绑定的技能列表.
     *
     * @var array<int, array{id: int, skill_id: int, skill_code: string, name_i18n: array, description_i18n: null|array, logo: null|string, sort_order: int}>
     */
    private array $skills;

    /**
     * Playbook 列表（playbooks）.
     *
     * @var array<int, array{id: int, name_i18n: array, description_i18n: null|array, icon: null|string, theme_color: null|string, enabled: bool, sort_order: int}>
     */
    private array $playbooks;

    private array $tools;

    private string $createdAt;

    private string $updatedAt;

    private ?int $projectId = null;

    private ?string $fileKey = null;

    private ?string $fileUrl = null;

    private ?string $latestPublishedAt = null;

    private ?string $publishType = null;

    private array $allowedPublishTargetTypes = [];

    public function __construct(
        string $id,
        string $code,
        ?string $versionCode,
        ?string $versionId,
        ?string $name,
        ?string $description,
        array $nameI18n,
        ?array $roleI18n,
        ?array $descriptionI18n,
        ?array $icon,
        int $iconType,
        ?array $prompt,
        bool $enabled,
        string $sourceType,
        ?bool $isStoreOffline,
        ?string $pinnedAt,
        array $skills,
        array $playbooks,
        array $tools,
        ?int $projectId,
        ?string $fileKey,
        ?string $fileUrl,
        ?string $latestPublishedAt,
        ?string $publishType,
        array $allowedPublishTargetTypes,
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
        $this->isStoreOffline = $isStoreOffline;
        $this->pinnedAt = $pinnedAt;
        $this->skills = $skills;
        $this->playbooks = $playbooks;
        $this->tools = $tools;
        $this->projectId = $projectId;
        $this->fileKey = $fileKey;
        $this->fileUrl = $fileUrl;
        $this->latestPublishedAt = $latestPublishedAt;
        $this->publishType = $publishType;
        $this->allowedPublishTargetTypes = $allowedPublishTargetTypes;
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
    public function toArray(bool $withFileUrl = false): array
    {
        $result = [
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
            'is_store_offline' => $this->isStoreOffline,
            'pinned_at' => $this->pinnedAt,
            'skills' => $this->skills,
            'playbooks' => $this->playbooks,
            'tools' => $this->tools,
            'project_id' => $this->projectId ? (string) $this->projectId : null,
            'file_key' => '',
            'latest_published_at' => $this->latestPublishedAt,
            'publish_type' => $this->publishType,
            'allowed_publish_target_types' => $this->allowedPublishTargetTypes,
        ];

        if ($withFileUrl) {
            $result['file_key'] = $this->fileKey;
            $result['file_url'] = $this->fileUrl;
        }

        $result['created_at'] = $this->createdAt;
        $result['updated_at'] = $this->updatedAt;

        return $result;
    }
}
