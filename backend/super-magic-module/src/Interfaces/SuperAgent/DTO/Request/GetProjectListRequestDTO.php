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
     * name.
     */
    public string $name = '';

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

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
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
        ];
    }
}
