<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 市场员工列表项 DTO.
 */
class AgentMarketListItemDTO extends AbstractDTO
{
    public bool $isAdded;

    public bool $needUpgrade;

    public string $createdAt;

    public string $updatedAt;

    private int $id;

    private string $agentCode;

    private ?string $userCode;

    private array $nameI18n;

    private ?array $roleI18n;

    private ?array $descriptionI18n;

    /**
     * Agent图标对象，包含 type 和 value.
     */
    private ?array $icon = null;

    private int $iconType;

    /**
     * Playbook 列表（feature）.
     *
     * @var array<int, array{name_i18n: array, icon: null|string, theme_color: null|string}>
     */
    private array $playbooks;

    private string $publisherType;

    private ?int $categoryId;

    public function __construct(
        int $id,
        string $agentCode,
        ?string $userCode,
        array $nameI18n,
        ?array $roleI18n,
        ?array $descriptionI18n,
        ?array $icon,
        int $iconType,
        array $playbooks,
        string $publisherType,
        ?int $categoryId,
        bool $isAdded,
        bool $needUpgrade,
        string $createdAt,
        string $updatedAt
    ) {
        $this->id = $id;
        $this->agentCode = $agentCode;
        $this->userCode = $userCode;
        $this->nameI18n = $nameI18n;
        $this->roleI18n = $roleI18n;
        $this->descriptionI18n = $descriptionI18n;
        $this->icon = $icon;
        $this->iconType = $iconType;
        $this->playbooks = $playbooks;
        $this->publisherType = $publisherType;
        $this->categoryId = $categoryId;
        $this->isAdded = $isAdded;
        $this->needUpgrade = $needUpgrade;
        $this->createdAt = $createdAt;
        $this->updatedAt = $updatedAt;
    }

    /**
     * 转换为数组（输出保持下划线命名，以保持API兼容性）.
     */
    public function toArray(): array
    {
        return [
            'id' => (string) $this->id,
            'agent_code' => $this->agentCode,
            'user_code' => $this->userCode,
            'name_i18n' => $this->nameI18n,
            'role_i18n' => $this->roleI18n,
            'description_i18n' => $this->descriptionI18n,
            'icon' => $this->icon,
            'icon_type' => $this->iconType,
            'playbooks' => $this->playbooks,
            'publisher_type' => $this->publisherType,
            'category_id' => (string) $this->categoryId,
            'is_added' => $this->isAdded,
            'need_upgrade' => $this->needUpgrade,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
