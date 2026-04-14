<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

/**
 * Get participated projects request DTO
 * Used to receive request parameters for getting user participated projects list.
 */
class GetParticipatedProjectsRequestDTO extends GetProjectListRequestDTO
{
    /**
     * Whether to show collaboration projects.
     */
    public int $showCollaboration = 1;

    /**
     * Whether to show hidden projects. Default 0 means hidden projects are filtered out.
     */
    public int $showHidden = 0;

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

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        $parentRules = parent::getHyperfValidationRules();

        return array_merge($parentRules, [
            'show_collaboration' => 'nullable|integer|in:0,1',
            'show_hidden' => 'nullable|integer|in:0,1',
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
        ]);
    }
}
