<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Transfer projects request DTO.
 *
 * Used to receive request parameters for transferring projects.
 */
class TransferProjectsRequestDTO extends AbstractRequestDTO
{
    /**
     * Project IDs to transfer.
     */
    public array $projectIds = [];

    /**
     * Receiver user ID.
     */
    public string $receiverId = '';

    /**
     * Whether to share to original owner after transfer.
     */
    public bool $shareToMe = false;

    /**
     * Share role for original owner (manage/editor/viewer).
     */
    public string $shareRole = '';

    /**
     * Whether to retain original workspace location for original owner.
     * Only effective when share_to_me is true.
     */
    public bool $retainOriginalLocation = false;

    /**
     * Get project IDs.
     */
    public function getProjectIds(): array
    {
        return $this->projectIds;
    }

    /**
     * Get receiver user ID.
     */
    public function getReceiverId(): string
    {
        return $this->receiverId;
    }

    /**
     * Check if share to original owner.
     */
    public function isShareToMe(): bool
    {
        return $this->shareToMe;
    }

    /**
     * Get share role.
     */
    public function getShareRole(): string
    {
        return $this->shareRole;
    }

    /**
     * Get retain original location flag.
     */
    public function getRetainOriginalLocation(): bool
    {
        return $this->retainOriginalLocation;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_ids' => 'required|array|min:1|max:100',
            'project_ids.*' => 'required|string',
            'receiver_id' => 'required|string|max:64',
            'share_to_me' => 'nullable|boolean',
            'share_role' => 'nullable|string|exclude_unless:share_to_me,1|in:manage,editor,viewer',
            'retain_original_location' => 'nullable|boolean|exclude_unless:share_to_me,1',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_ids.required' => 'Project IDs cannot be empty',
            'project_ids.array' => 'Project IDs must be an array',
            'project_ids.min' => 'At least one project must be selected',
            'project_ids.max' => 'Cannot transfer more than 100 projects at once',
            'project_ids.*.required' => 'Each project ID cannot be empty',
            'project_ids.*.string' => 'Each project ID must be a string',
            'receiver_id.required' => 'Receiver ID cannot be empty',
            'receiver_id.string' => 'Receiver ID must be a string',
            'receiver_id.max' => 'Receiver ID cannot exceed 64 characters',
            'share_to_me.boolean' => 'Share to me must be a boolean value',
            'share_role.string' => 'Share role must be a string',
            'share_role.in' => 'Share role must be one of: manage, editor, viewer',
            'retain_original_location.boolean' => 'Retain original location must be a boolean value',
        ];
    }
}
