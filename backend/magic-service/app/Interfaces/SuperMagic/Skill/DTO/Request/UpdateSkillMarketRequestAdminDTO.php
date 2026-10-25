<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 部分更新 Skill 市场信息请求 DTO.
 */
class UpdateSkillMarketRequestAdminDTO extends AbstractRequestDTO
{
    /** @var null|int[] */
    protected ?array $categoryIds = null;

    protected ?int $sortOrder = null;

    protected ?bool $isFeatured = null;

    protected ?bool $isHidden = null;

    public function setSortOrder(null|int|string $value): void
    {
        $this->sortOrder = $value === null ? null : (int) $value;
    }

    public function setCategoryIds(?array $value): void
    {
        $this->categoryIds = $value === null ? null : array_values(array_unique(array_map('intval', $value)));
    }

    public function setIsFeatured(null|bool|int|string $value): void
    {
        if ($value === null) {
            $this->isFeatured = null;
            return;
        }

        if (is_bool($value)) {
            $this->isFeatured = $value;
            return;
        }

        $this->isFeatured = filter_var((string) $value, FILTER_VALIDATE_BOOLEAN);
    }

    public function setIsHidden(null|bool|int|string $value): void
    {
        if ($value === null) {
            $this->isHidden = null;
            return;
        }

        if (is_bool($value)) {
            $this->isHidden = $value;
            return;
        }

        $this->isHidden = filter_var((string) $value, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * @return array{
     *     category_ids?: int[],
     *     sort_order?: int,
     *     is_featured?: bool,
     *     is_hidden?: bool
     * }
     */
    public function getUpdatePayload(): array
    {
        $payload = [];
        if ($this->categoryIds !== null) {
            $payload['category_ids'] = $this->categoryIds;
        }
        if ($this->sortOrder !== null) {
            $payload['sort_order'] = $this->sortOrder;
        }
        if ($this->isFeatured !== null) {
            $payload['is_featured'] = $this->isFeatured;
        }
        if ($this->isHidden !== null) {
            $payload['is_hidden'] = $this->isHidden;
        }

        return $payload;
    }

    public function hasUpdates(): bool
    {
        return $this->categoryIds !== null || $this->sortOrder !== null
            || $this->isFeatured !== null
            || $this->isHidden !== null;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'category_ids' => 'sometimes|array|max:100',
            'category_ids.*' => 'integer|min:1',
            'sort_order' => 'sometimes|nullable|integer',
            'is_featured' => 'sometimes|boolean',
            'is_hidden' => 'sometimes|boolean',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'sort_order.integer' => __('validation.integer', ['attribute' => 'sort_order']),
            'is_featured.boolean' => __('validation.boolean', ['attribute' => 'is_featured']),
            'is_hidden.boolean' => __('validation.boolean', ['attribute' => 'is_hidden']),
        ];
    }
}
