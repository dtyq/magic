<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Project\DTO\Request;

use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectSortMode;

/**
 * Get participated projects request DTO
 * Used to receive request parameters for getting user participated projects list.
 */
class GetParticipatedProjectsRequestDTO extends GetProjectListRequestDTO
{
    public ?string $sortMode = null;

    public ?string $sortField = null;

    public string $sortDirection = 'desc';

    public string $projectType = 'all';

    /**
     * Whether to show collaboration projects.
     */
    public int $showCollaboration = 1;

    /**
     * Whether to show hidden projects. Default 0 means hidden projects are filtered out.
     */
    public int $showHidden = 0;

    /**
     * Whether recent queries should include special project modes.
     */
    public int $includeSpecial = 0;

    public function setSortDirection(?string $sortDirection): void
    {
        $this->sortDirection = $sortDirection ?? 'desc';
    }

    public function setProjectType(?string $projectType): void
    {
        $this->projectType = $projectType ?? 'all';
    }

    public function getSortField(): ?string
    {
        return $this->sortField;
    }

    public function getSortDirection(): string
    {
        return $this->sortDirection;
    }

    public function getProjectType(): string
    {
        return $this->projectType;
    }

    public function setSortMode(?string $sortMode): void
    {
        $this->sortMode = $sortMode;
    }

    public function getSortMode(): ?ProjectSortMode
    {
        return $this->sortMode === null ? null : ProjectSortMode::from($this->sortMode);
    }

    /**
     * Get show collaboration flag.
     */
    public function getShowCollaboration(): bool
    {
        return (bool) $this->showCollaboration;
    }

    /**
     * Set show collaboration flag.
     */
    public function setShowCollaboration(int|string $showCollaboration): void
    {
        $this->showCollaboration = (int) $showCollaboration;
    }

    /**
     * Get show hidden flag.
     */
    public function getShowHidden(): bool
    {
        return (bool) $this->showHidden;
    }

    /**
     * Set show hidden flag.
     */
    public function setShowHidden(int|string $showHidden): void
    {
        $this->showHidden = (int) $showHidden;
    }

    public function getIncludeSpecial(): bool
    {
        return (bool) $this->includeSpecial;
    }

    public function setIncludeSpecial(int|string $includeSpecial): void
    {
        $this->includeSpecial = (int) $includeSpecial;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        $parentRules = parent::getHyperfValidationRules();

        return array_merge($parentRules, [
            'show_collaboration' => 'nullable|integer|in:0,1',
            'show_hidden' => 'nullable|integer|in:0,1',
            'include_special' => 'nullable|integer|in:0,1',
            'sort_mode' => 'nullable|string|in:workspace,recent',
            'sort_field' => 'nullable|string|in:last_active_at,updated_at,created_at',
            'sort_direction' => 'nullable|string|in:asc,desc',
            'project_type' => 'nullable|string|in:all,general,claw,micro-app,agent,skill',
        ]);
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        $parentMessages = parent::getHyperfValidationMessage();

        return array_merge($parentMessages, [
            'show_collaboration.integer' => 'Show collaboration must be an integer',
            'show_collaboration.in' => 'Show collaboration must be 0 or 1',
            'show_hidden.integer' => 'Show hidden must be an integer',
            'show_hidden.in' => 'Show hidden must be 0 or 1',
            'include_special.integer' => 'Include special must be an integer',
            'include_special.in' => 'Include special must be 0 or 1',
        ]);
    }
}
