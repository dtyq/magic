<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Playbook 列表项 DTO.
 */
class PlaybookListItemDTO extends AbstractDTO
{
    public int $id;

    public int $agentId;

    public string $agentCode;

    public array $nameI18n;

    public ?array $descriptionI18n = null;

    public ?string $icon = null;

    public ?string $themeColor = null;

    public bool $enabled;

    public int $sortOrder;

    public ?array $config = null;

    public string $createdAt;

    public string $updatedAt;

    public function __construct(
        int $id,
        int $agentId,
        string $agentCode,
        array $nameI18n,
        ?array $descriptionI18n,
        ?string $icon,
        ?string $themeColor,
        bool $enabled,
        int $sortOrder,
        ?array $config,
        string $createdAt,
        string $updatedAt
    ) {
        $this->id = $id;
        $this->agentId = $agentId;
        $this->agentCode = $agentCode;
        $this->nameI18n = $nameI18n;
        $this->descriptionI18n = $descriptionI18n;
        $this->icon = $icon;
        $this->themeColor = $themeColor;
        $this->enabled = $enabled;
        $this->sortOrder = $sortOrder;
        $this->config = $config;
        $this->createdAt = $createdAt;
        $this->updatedAt = $updatedAt;
    }

    public function toArray(): array
    {
        return [
            'id' => (string) $this->id,
            'agent_id' => (string) $this->agentId,
            'agent_code' => $this->agentCode,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'icon' => $this->icon,
            'theme_color' => $this->themeColor,
            'enabled' => $this->enabled,
            'sort_order' => $this->sortOrder,
            'config' => $this->config,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
