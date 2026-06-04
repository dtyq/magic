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
class GetProjectListRequestDTO extends AbstractRequestDTO
{
    private const ALLOWED_ORDER_BY = ['id', 'updated_at'];

    private const ALLOWED_SORT = ['asc', 'desc'];

    /**
     * Page number.
     */
    public int $page = 1;

    /**
     * Page size.
     */
    public int $pageSize = 10;

    /**
     * Workspace ID.
     */
    public string $workspaceId = '';

    /**
     * Project name for fuzzy search.
     */
    public string $projectName = '';

    /**
     * Sort field: id, updated_at.
     */
    public string $orderBy = 'id';

    /**
     * Sort direction: asc, desc.
     */
    public string $sort = 'desc';

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

    /**
     * Set workspace ID.
     */
    public function setWorkspaceId(string $value): void
    {
        $this->workspaceId = $value;
    }

    /**
     * Get workspace ID.
     */
    public function getWorkspaceId(): ?int
    {
        return $this->workspaceId ? (int) $this->workspaceId : null;
    }

    public function getProjectName(): string
    {
        return $this->projectName;
    }

    public function setProjectName(string $projectName): void
    {
        $this->projectName = $projectName;
    }

    public function getOrderBy(): string
    {
        return $this->orderBy;
    }

    public function setOrderBy(string $orderBy): void
    {
        $this->orderBy = $this->normalizeOrderBy($orderBy);
    }

    public function getSort(): string
    {
        return $this->sort;
    }

    public function setSort(string $sort): void
    {
        $this->sort = $this->normalizeSort($sort);
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'integer|min:1',
            'page_size' => 'integer|min:1|max:100',
            'workspace_id' => 'nullable|string',
            'project_name' => 'nullable|string|max:255',
            'order_by' => 'nullable|string|in:id,updated_at',
            'sort' => 'nullable|string|in:asc,desc',
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
            'workspace_id.string' => 'Workspace ID must be a string',
            'project_name.string' => 'Project name must be a string',
            'project_name.max' => 'Project name cannot exceed 255 characters',
            'order_by.string' => 'Order by must be a string',
            'order_by.in' => 'Order by must be one of: id, updated_at',
            'sort.string' => 'Sort must be a string',
            'sort.in' => 'Sort must be either asc or desc',
        ];
    }

    private function normalizeOrderBy(string $orderBy): string
    {
        $orderBy = strtolower($orderBy);
        if (! in_array($orderBy, self::ALLOWED_ORDER_BY, true)) {
            return 'id';
        }

        return $orderBy;
    }

    private function normalizeSort(string $sort): string
    {
        $sort = strtolower($sort);
        if (! in_array($sort, self::ALLOWED_SORT, true)) {
            return 'desc';
        }

        return $sort;
    }
}
