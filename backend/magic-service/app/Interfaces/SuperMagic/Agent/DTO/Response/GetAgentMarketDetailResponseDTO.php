<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Response DTO for a published market agent detail page.
 */
class GetAgentMarketDetailResponseDTO extends AbstractDTO
{
    private string $id;

    private string $agentCode;

    private string $name;

    /**
     * Localized role labels for the current language.
     *
     * @var array<int, string>
     */
    private array $role;

    private string $description;

    private array $nameI18n;

    private ?array $roleI18n;

    private ?array $descriptionI18n;

    private ?array $icon;

    private int $iconType;

    /** @var string[] */
    private array $categoryIds;

    private string $versionCode;

    private string $createdAt;

    private ?string $publishedAt;

    /**
     * @param array<int, string> $role
     */
    public function __construct(
        string $id,
        string $agentCode,
        string $name,
        array $role,
        string $description,
        array $nameI18n,
        ?array $roleI18n,
        ?array $descriptionI18n,
        ?array $icon,
        int $iconType,
        array $categoryIds,
        string $versionCode,
        string $createdAt,
        ?string $publishedAt
    ) {
        $this->id = $id;
        $this->agentCode = $agentCode;
        $this->name = $name;
        $this->role = $role;
        $this->description = $description;
        $this->nameI18n = $nameI18n;
        $this->roleI18n = $roleI18n;
        $this->descriptionI18n = $descriptionI18n;
        $this->icon = $icon;
        $this->iconType = $iconType;
        $this->categoryIds = array_map(static fn (int $categoryId): string => (string) $categoryId, $categoryIds);
        $this->versionCode = $versionCode;
        $this->createdAt = $createdAt;
        $this->publishedAt = $publishedAt;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'agent_code' => $this->agentCode,
            'name' => $this->name,
            'role' => $this->role,
            'description' => $this->description,
            'name_i18n' => $this->nameI18n,
            'role_i18n' => $this->roleI18n,
            'description_i18n' => $this->descriptionI18n,
            'icon' => $this->icon,
            'icon_type' => $this->iconType,
            'category_ids' => $this->categoryIds,
            'version_code' => $this->versionCode,
            'created_at' => $this->createdAt,
            'published_at' => $this->publishedAt,
        ];
    }
}
