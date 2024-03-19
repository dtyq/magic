<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Transfer workspaces request DTO.
 *
 * Used to receive request parameters for transferring workspaces.
 */
class TransferWorkspacesRequestDTO extends AbstractRequestDTO
{
    /**
     * Workspace IDs to transfer.
     */
    public array $workspaceIds = [];

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
     * Whether to retain original workspace location as shortcut.
     * Only effective when share_to_me is true.
     * When enabled:
     * - Original workspace ownership is NOT transferred
     * - A new workspace is created for receiver
     * - Projects are moved to receiver's new workspace
     * - Original owner's member_settings binds projects back to original workspace via shortcut.
     */
    public bool $retainOriginalLocation = false;

    /**
     * Get workspace IDs.
     */
    public function getWorkspaceIds(): array
    {
        return $this->workspaceIds;
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
     * Check if retain original workspace location.
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
            // NOTE: business limit: at most 20 workspaces per transfer
            'workspace_ids' => 'required|array|min:1|max:20',
            'workspace_ids.*' => 'required|string',
            'receiver_id' => 'required|string|max:64',
            'share_to_me' => 'nullable|boolean',
            'share_role' => 'nullable|string|exclude_unless:share_to_me,1|in:manage,editor,viewer',
            // retain_original_location only works when share_to_me is true
            'retain_original_location' => 'nullable|boolean|exclude_unless:share_to_me,1',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'workspace_ids.required' => 'Workspace IDs cannot be empty',
            'workspace_ids.array' => 'Workspace IDs must be an array',
            'workspace_ids.min' => 'At least one workspace must be selected',
            'workspace_ids.max' => 'Cannot transfer more than 50 workspaces at once',
            'workspace_ids.*.required' => 'Each workspace ID cannot be empty',
            'workspace_ids.*.string' => 'Each workspace ID must be a string',
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
