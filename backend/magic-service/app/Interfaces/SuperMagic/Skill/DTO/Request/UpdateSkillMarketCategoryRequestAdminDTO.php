<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class UpdateSkillMarketCategoryRequestAdminDTO extends AbstractRequestDTO
{
    /** @var null|int[] */
    private ?array $categoryIds = null;

    public function setCategoryIds(?array $categoryIds): void
    {
        $this->categoryIds = $categoryIds === null ? null : array_values(array_unique(array_map('intval', $categoryIds)));
    }

    public function hasCategoryInput(): bool
    {
        return $this->categoryIds !== null;
    }

    /** @return int[] */
    public function getCategoryIds(): array
    {
        return $this->categoryIds ?? [];
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'category_ids' => 'present|array|max:100',
            'category_ids.*' => 'integer|min:1',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
