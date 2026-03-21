<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 员工列表项 DTO.
 */
class AgentListItemDTO extends AbstractDTO
{
    private int $id;

    private string $code;

    private array $nameI18n;

    private ?array $roleI18n;

    private ?array $descriptionI18n;

    /**
     * Agent图标对象，包含 type 和 value.
     */
    private ?array $icon;

    private int $iconType;

    /**
     * Playbook 列表（feature）.
     *
     * @var array<int, array{name_i18n: array, icon: null|string, theme_color: null|string}>
     */
    private array $playbooks;

    private string $sourceType;

    private bool $enabled;

    /**
     * 历史字段名沿用 `store`，实际语义表示“市场来源的 Agent 是否已从市场下架”.
     */
    private ?bool $isStoreOffline;

    private ?string $latestVersionCode;

    private bool $allowDelete;

    private ?string $pinnedAt;

    private ?string $latestPublishedAt;

    private string $updatedAt;

    private string $createdAt;

    public function __construct(
        int $id,
        string $code,
        array $nameI18n,
        ?array $roleI18n,
        ?array $descriptionI18n,
        ?array $icon,
        int $iconType,
        array $playbooks,
        string $sourceType,
        bool $enabled,
        ?bool $isStoreOffline,
        ?string $latestVersionCode,
        bool $allowDelete,
        ?string $pinnedAt,
        ?string $latestPublishedAt,
        string $updatedAt,
        string $createdAt
    ) {
        $this->id = $id;
        $this->code = $code;
        $this->nameI18n = $nameI18n;
        $this->roleI18n = $roleI18n;
        $this->descriptionI18n = $descriptionI18n;
        $this->icon = $icon;
        $this->iconType = $iconType;
        $this->playbooks = $playbooks;
        $this->sourceType = $sourceType;
        $this->enabled = $enabled;
        $this->isStoreOffline = $isStoreOffline;
        $this->latestVersionCode = $latestVersionCode;
        $this->allowDelete = $allowDelete;
        $this->pinnedAt = $pinnedAt;
        $this->latestPublishedAt = $latestPublishedAt;
        $this->updatedAt = $updatedAt;
        $this->createdAt = $createdAt;
    }

    /**
     * 转换为数组（输出保持下划线命名，以保持API兼容性）.
     */
    public function toArray(): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            'name_i18n' => $this->nameI18n,
            'role_i18n' => $this->roleI18n,
            'description_i18n' => $this->descriptionI18n,
            'icon' => $this->icon,
            'icon_type' => $this->iconType,
            'playbooks' => $this->playbooks,
            'source_type' => $this->sourceType,
            'enabled' => $this->enabled,
            'is_store_offline' => $this->isStoreOffline,
            'latest_version_code' => $this->latestVersionCode,
            'allow_delete' => $this->allowDelete,
            'pinned_at' => $this->pinnedAt,
            'latest_published_at' => $this->latestPublishedAt,
            'updated_at' => $this->updatedAt,
            'created_at' => $this->createdAt,
        ];
    }
}
