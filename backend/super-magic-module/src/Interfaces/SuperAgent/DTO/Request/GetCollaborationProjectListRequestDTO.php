<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Get project list request DTO
 * Used to receive request parameters for getting project list.
 */
class GetCollaborationProjectListRequestDTO extends AbstractRequestDTO
{
    /**
     * Page number.
     */
    public int $page = 1;

    /**
     * Page size.
     */
    public int $pageSize = 10;

    /**
     * name.
     */
    public string $name = '';

    /**
     * received
     * shared.
     */
    public string $type = '';

    /**
     * join method.
     */
    public ?string $joinMethod = null;

    /**
     * 排序字段：updated_at(项目更新时间), created_at(项目创建时间), last_active_at(用户最后活跃时间).
     */
    public string $sortField = '';

    /**
     * 排序方向：asc(升序), desc(降序).
     */
    public string $sortDirection = 'desc';

    /**
     * 创建者用户IDs数组，用于筛选特定创建者的项目.
     */
    public array $creatorUserIds = [];

    /**
     * Get page number.
     */
    public function getPage(): int
    {
        return $this->page;
    }

    /**
     * Get page size.
     */
    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    /**
     * Set page number with type conversion.
     */
    public function setPage(int|string $value): void
    {
        $this->page = (int) $value;
    }

    /**
     * Set page size with type conversion.
     */
    public function setPageSize(int|string $value): void
    {
        $this->pageSize = (int) $value;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): void
    {
        $this->type = $type;
    }

    public function getSortField(): string
    {
        return $this->sortField;
    }

    public function setSortField(string $sortField): void
    {
        $this->sortField = $sortField;
    }

    public function getSortDirection(): string
    {
        return $this->sortDirection;
    }

    public function setSortDirection(string $sortDirection): void
    {
        $this->sortDirection = $sortDirection;
    }

    public function getCreatorUserIds(): array
    {
        return $this->creatorUserIds;
    }

    public function setCreatorUserIds(array $creatorUserIds): void
    {
        $this->creatorUserIds = $creatorUserIds;
    }

    public function getJoinMethod(): ?string
    {
        return $this->joinMethod;
    }

    public function setJoinMethod(?string $joinMethod): void
    {
        $this->joinMethod = $joinMethod;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'integer|min:1',
            'page_size' => 'integer|min:1|max:100',
            'type' => 'nullable|string|in:received,shared',
            'join_method' => 'nullable|string',
            'sort_field' => 'nullable|string|in:updated_at,created_at,last_active_at',
            'sort_direction' => 'nullable|string|in:asc,desc',
            'creator_user_ids' => 'nullable|array',
            'creator_user_ids.*' => 'string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'page.integer' => 'Page must be an integer',
            'page.min' => 'Page must be greater than 0',
            'page_size.integer' => 'Page size must be an integer',
            'page_size.min' => 'Page size must be greater than 0',
            'page_size.max' => 'Page size cannot exceed 100',
            'type.string' => 'Type must be a string',
            'type.in' => 'Type must be either received or shared',
            'sort_field.string' => 'Sort field must be a string',
            'sort_field.in' => 'Sort field must be one of: updated_at, created_at, last_active_at',
            'sort_direction.string' => 'Sort direction must be a string',
            'sort_direction.in' => 'Sort direction must be either asc or desc',
            'creator_user_ids.array' => 'Creator user IDs must be an array',
            'creator_user_ids.*.string' => 'Each creator user ID must be a string',
        ];
    }
}
