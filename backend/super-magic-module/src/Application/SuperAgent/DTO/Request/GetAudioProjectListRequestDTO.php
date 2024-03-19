<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Get Audio Project List Request DTO.
 */
class GetAudioProjectListRequestDTO extends AbstractRequestDTO
{
    /**
     * Page number.
     */
    public int $page = 1;

    /**
     * Page size.
     */
    public int $pageSize = 20;

    /**
     * Workspace ID (optional).
     */
    public string $workspaceId = '';

    /**
     * Keyword for search (optional).
     */
    public string $keyword = '';

    /**
     * Filter by source: app | device (optional).
     */
    public string $source = '';

    /**
     * Filter by device ID (optional).
     */
    public string $deviceId = '';

    /**
     * Filter by current phase: waiting, merging, summarizing (optional, supports array).
     */
    public array $currentPhase = [];

    /**
     * Filter by project IDs (optional, supports array).
     */
    public array $projectIds = [];

    /**
     * Filter by created date start (Unix timestamp) (optional).
     */
    public int $createdAtStart = 0;

    /**
     * Filter by created date end (Unix timestamp) (optional).
     */
    public int $createdAtEnd = 0;

    /**
     * Filter by hidden status: 0 = non-hidden, 1 = hidden, null = all (optional).
     */
    public ?int $isHidden = 0;

    /**
     * Sort by field: created_at | updated_at (optional).
     */
    public string $sortBy = 'updated_at';

    /**
     * Sort order: asc | desc (optional).
     */
    public string $sortOrder = 'desc';

    /**
     * Get page number.
     */
    public function getPage(): int
    {
        return $this->page;
    }

    /**
     * Set page number with type conversion.
     */
    public function setPage(int|string $value): void
    {
        $this->page = (int) $value;
    }

    /**
     * Get page size.
     */
    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    /**
     * Set page size with type conversion.
     */
    public function setPageSize(int|string $value): void
    {
        $this->pageSize = (int) $value;
    }

    /**
     * Get workspace ID.
     */
    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }

    /**
     * Set workspace ID.
     */
    public function setWorkspaceId(string $value): void
    {
        $this->workspaceId = $value;
    }

    /**
     * Get keyword.
     */
    public function getKeyword(): string
    {
        return $this->keyword;
    }

    /**
     * Set keyword.
     */
    public function setKeyword(string $value): void
    {
        $this->keyword = $value;
    }

    /**
     * Get source.
     */
    public function getSource(): string
    {
        return $this->source;
    }

    /**
     * Set source.
     */
    public function setSource(string $value): void
    {
        $this->source = $value;
    }

    /**
     * Get device ID.
     */
    public function getDeviceId(): string
    {
        return $this->deviceId;
    }

    /**
     * Set device ID.
     */
    public function setDeviceId(string $value): void
    {
        $this->deviceId = $value;
    }

    /**
     * Get current phase.
     */
    public function getCurrentPhase(): array
    {
        return $this->currentPhase;
    }

    /**
     * Set current phase.
     */
    public function setCurrentPhase(array|string $value): void
    {
        // Support both array and string (convert string to array)
        if (is_string($value)) {
            $this->currentPhase = ! empty($value) ? [$value] : [];
        } else {
            $this->currentPhase = $value;
        }
    }

    /**
     * Get project IDs.
     */
    public function getProjectIds(): array
    {
        return $this->projectIds;
    }

    /**
     * Set project IDs with type conversion.
     */
    public function setProjectIds(array $value): void
    {
        // Convert all string elements to integers
        $this->projectIds = array_map(fn ($id) => (int) $id, $value);
    }

    /**
     * Get created at start.
     */
    public function getCreatedAtStart(): int
    {
        return $this->createdAtStart;
    }

    /**
     * Set created at start.
     */
    public function setCreatedAtStart(int|string $value): void
    {
        $this->createdAtStart = (int) $value;
    }

    /**
     * Get created at start formatted for database query (Y-m-d H:i:s).
     */
    public function getCreatedAtStartFormatted(): string
    {
        return $this->createdAtStart > 0
            ? date('Y-m-d H:i:s', $this->createdAtStart)
            : '';
    }

    /**
     * Get created at end.
     */
    public function getCreatedAtEnd(): int
    {
        return $this->createdAtEnd;
    }

    /**
     * Set created at end.
     */
    public function setCreatedAtEnd(int|string $value): void
    {
        $this->createdAtEnd = (int) $value;
    }

    /**
     * Get created at end formatted for database query (Y-m-d H:i:s).
     */
    public function getCreatedAtEndFormatted(): string
    {
        return $this->createdAtEnd > 0
            ? date('Y-m-d H:i:s', $this->createdAtEnd)
            : '';
    }

    /**
     * Get is hidden status.
     */
    public function getIsHidden(): ?int
    {
        return $this->isHidden;
    }

    /**
     * Set is hidden status with type conversion.
     */
    public function setIsHidden(null|int|string $value): void
    {
        if ($value === null || $value === '') {
            $this->isHidden = null;
        } else {
            $this->isHidden = (int) $value;
        }
    }

    /**
     * Get sort by field.
     */
    public function getSortBy(): string
    {
        return $this->sortBy;
    }

    /**
     * Set sort by field.
     */
    public function setSortBy(string $value): void
    {
        $this->sortBy = $value;
    }

    /**
     * Get sort order.
     */
    public function getSortOrder(): string
    {
        return $this->sortOrder;
    }

    /**
     * Set sort order.
     */
    public function setSortOrder(string $value): void
    {
        $this->sortOrder = $value;
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
            'keyword' => 'nullable|string|max:255',
            'source' => 'nullable|string|in:app,device',
            'device_id' => 'nullable|string|max:100',
            'current_phase' => 'nullable|array',
            'current_phase.*' => 'string|in:waiting,merging,summarizing',
            'project_ids' => 'nullable|array',
            'project_ids.*' => 'integer|min:1',
            'created_at_start' => 'nullable|integer|min:0',
            'created_at_end' => 'nullable|integer|min:0',
            'is_hidden' => 'nullable|integer|in:0,1',
            'sort_by' => 'nullable|string|in:created_at,updated_at',
            'sort_order' => 'nullable|string|in:asc,desc',
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
            'keyword.string' => 'Keyword must be a string',
            'keyword.max' => 'Keyword cannot exceed 255 characters',
            'source.string' => 'Source must be a string',
            'source.in' => 'Source must be either app or device',
            'device_id.string' => 'Device ID must be a string',
            'device_id.max' => 'Device ID cannot exceed 100 characters',
            'current_phase.array' => 'Current phase must be an array',
            'current_phase.*.string' => 'Current phase must be a string',
            'current_phase.*.in' => 'Current phase must be either waiting, merging or summarizing',
            'project_ids.array' => 'Project IDs must be an array',
            'project_ids.*.integer' => 'Each project ID must be an integer',
            'project_ids.*.min' => 'Each project ID must be greater than 0',
            'phase_status.string' => 'Phase status must be a string',
            'phase_status.in' => 'Phase status must be in_progress, completed, or failed',
            'created_at_start.integer' => 'Created at start must be an integer timestamp',
            'created_at_start.min' => 'Created at start must be a valid timestamp',
            'created_at_end.integer' => 'Created at end must be an integer timestamp',
            'created_at_end.min' => 'Created at end must be a valid timestamp',
            'is_hidden.integer' => 'Is hidden must be an integer',
            'is_hidden.in' => 'Is hidden must be either 0 (non-hidden) or 1 (hidden)',
            'sort_by.string' => 'Sort by must be a string',
            'sort_by.in' => 'Sort by must be either created_at or updated_at',
            'sort_order.string' => 'Sort order must be a string',
            'sort_order.in' => 'Sort order must be either asc or desc',
        ];
    }
}
