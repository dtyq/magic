<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Agent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class UpdateAgentMarketRequestAdminDTO extends AbstractRequestDTO
{
    /** @var null|array<int, null|int|string> */
    private ?array $categoryIds = null;

    private ?int $sortOrder = null;

    private ?bool $isFeatured = null;

    private ?bool $isHidden = null;

    private ?array $nameI18n = null;

    private ?array $descriptionI18n = null;

    private ?array $roleI18n = null;

    private ?array $icon = null;

    private ?int $iconType = null;

    private array $provided = [];

    public function setCategoryIds(?array $value): void
    {
        $this->categoryIds = $value;
        $this->provided['category_ids'] = true;
    }

    public function setSortOrder(null|int|string $value): void
    {
        $this->sortOrder = $value === null ? null : (int) $value;
        $this->provided['sort_order'] = true;
    }

    public function setIsFeatured(null|bool|int|string $value): void
    {
        $this->isFeatured = $value === null ? null : filter_var($value, FILTER_VALIDATE_BOOLEAN);
        $this->provided['is_featured'] = true;
    }

    public function setIsHidden(null|bool|int|string $value): void
    {
        $this->isHidden = $value === null ? null : filter_var($value, FILTER_VALIDATE_BOOLEAN);
        $this->provided['is_hidden'] = true;
    }

    public function setNameI18n(?array $value): void
    {
        $this->nameI18n = $value;
        $this->provided['name_i18n'] = true;
    }

    public function setDescriptionI18n(?array $value): void
    {
        $this->descriptionI18n = $value;
        $this->provided['description_i18n'] = true;
    }

    public function setRoleI18n(?array $value): void
    {
        $this->roleI18n = $value;
        $this->provided['role_i18n'] = true;
    }

    public function setIcon(?array $value): void
    {
        $this->icon = $value;
        $this->provided['icon'] = true;
    }

    public function setIconType(null|int|string $value): void
    {
        $this->iconType = $value === null ? null : (int) $value;
        $this->provided['icon_type'] = true;
    }

    /** @return array<string, null|array|bool|int> */
    public function getUpdatePayload(): array
    {
        $values = [
            'category_ids' => $this->getCategoryIds(),
            'sort_order' => $this->sortOrder,
            'is_featured' => $this->isFeatured,
            'is_hidden' => $this->isHidden,
            'name_i18n' => $this->nameI18n,
            'description_i18n' => $this->descriptionI18n,
            'role_i18n' => $this->roleI18n,
            'icon' => $this->icon,
            'icon_type' => $this->iconType,
        ];
        return array_filter($values, fn ($value, string $key) => isset($this->provided[$key]), ARRAY_FILTER_USE_BOTH);
    }

    public function hasUpdates(): bool
    {
        return $this->provided !== [];
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'category_ids' => 'sometimes|nullable|array|max:100',
            'category_ids.*' => 'integer|min:1',
            'sort_order' => 'sometimes|nullable|integer',
            'is_featured' => 'sometimes|boolean',
            'is_hidden' => 'sometimes|boolean',
            'name_i18n' => 'sometimes|array',
            'description_i18n' => 'sometimes|nullable|array',
            'role_i18n' => 'sometimes|nullable|array',
            'icon' => 'sometimes|nullable|array',
            'icon_type' => 'sometimes|integer',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }

    /** @return int[] */
    private function getCategoryIds(): array
    {
        if ($this->categoryIds !== null) {
            return $this->normalizeCategoryIds($this->categoryIds);
        }

        return [];
    }

    /** @param array<int, null|int|string> $categoryIds */
    private function normalizeCategoryIds(array $categoryIds): array
    {
        $normalized = [];
        foreach ($categoryIds as $categoryId) {
            $categoryId = (int) $categoryId;
            if ($categoryId <= 0 || in_array($categoryId, $normalized, true)) {
                continue;
            }
            $normalized[] = $categoryId;
        }

        return $normalized;
    }
}
