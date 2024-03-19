<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TransferOptions;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TransferResult;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceArchiveStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WorkspaceEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceRepositoryInterface;

/**
 * Transfer Domain Service.
 *
 * Responsibilities:
 * 1. Validate resource ownership
 * 2. Update workspace/project ownership (user_id)
 *
 * NOT responsible for:
 * - Member relationship handling (handled by ProjectMemberDomainService)
 * - Audit logging (handled by TransferLogDomainService in AppService)
 */
class TransferDomainService
{
    public function __construct(
        private readonly WorkspaceRepositoryInterface $workspaceRepository,
        private readonly ProjectRepositoryInterface $projectRepository,
    ) {
    }

    /**
     * Transfer project ownership (unified interface).
     *
     * This is the recommended entry point for project transfer.
     * Encapsulates strategy selection based on TransferOptions.
     *
     * @param int $projectId Project ID
     * @param string $fromUserId Original owner user ID
     * @param string $toUserId New owner user ID
     * @param string $organizationCode Organization code
     * @param TransferOptions $options Transfer options containing strategy flags
     * @return TransferResult Transfer result with project info
     */
    public function transferProject(
        int $projectId,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        TransferOptions $options
    ): TransferResult {
        // Strategy selection: determine transfer approach based on options
        if ($options->shouldRetainOriginalLocation() && $options->shouldShareToOriginalOwner()) {
            // Strategy 1: Keep original workspace location for original owner (via shortcut)
            // But move project to receiver's workspace
            return $this->transferProjectWithRetainLocation(
                $projectId,
                $fromUserId,
                $toUserId,
                $organizationCode,
                $options->getFromUserName(),
                $options->getTransferSuffix()
            );
        }

        // Strategy 2: Move project to new workspace with transfer suffix
        return $this->transferProjectWithWorkspace(
            $projectId,
            $fromUserId,
            $toUserId,
            $organizationCode,
            $options->getOriginalWorkspaceName(),
            $options->getFromUserName(),
            $options->getTransferSuffix()
        );
    }

    /**
     * Transfer workspace ownership (unified interface).
     *
     * This is the recommended entry point for workspace transfer.
     * Encapsulates strategy selection based on TransferOptions.
     *
     * @param int $workspaceId Workspace ID to transfer
     * @param string $fromUserId Original owner user ID
     * @param string $toUserId New owner user ID
     * @param string $organizationCode Organization code
     * @param TransferOptions $options Transfer options containing strategy flags
     * @return TransferResult Transfer result with workspace and project info
     */
    public function transferWorkspace(
        int $workspaceId,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        TransferOptions $options
    ): TransferResult {
        // Strategy selection: determine transfer approach based on options
        if ($options->shouldRetainOriginalLocation() && $options->shouldShareToOriginalOwner()) {
            // Strategy 1: Keep original workspace, create new workspace for receiver
            return $this->doTransferWorkspaceWithRetainLocation(
                $workspaceId,
                $fromUserId,
                $toUserId,
                $organizationCode,
                $options->getFromUserName(),
                $options->getTransferSuffix()
            );
        }

        // Strategy 2: Transfer workspace ownership directly
        return $this->doTransferWorkspace(
            $workspaceId,
            $fromUserId,
            $toUserId,
            $organizationCode,
            $options->getFromUserName(),
            $options->getTransferSuffix()
        );
    }

    /**
     * Build transferred workspace name with suffix.
     * Removes existing transfer suffix and adds new one.
     *
     * @param string $originalName Original workspace name
     * @param string $fromUserName Transferrer's display name
     * @param string $transferSuffix i18n suffix like "Transferred from"
     * @param string $defaultWorkspaceName Default name if original is empty
     * @return string Formatted workspace name
     */
    public function buildTransferredWorkspaceName(
        string $originalName,
        string $fromUserName,
        string $transferSuffix = 'Transferred from',
        string $defaultWorkspaceName = 'Untitled Workspace'
    ): string {
        // 1. Handle empty names with defaults
        $safeName = trim($originalName) !== '' ? $originalName : $defaultWorkspaceName;
        $safeUserName = trim($fromUserName) !== '' ? $fromUserName : 'Unknown User';

        // 2. Remove existing transfer suffix in multiple languages
        // This ensures clean naming when workspace is transferred multiple times
        $patterns = [
            '/\s*\[转让自\s+[^\]]+\]\s*$/',                    // Chinese
            '/\s*\[Transferred from\s+[^\]]+\]\s*$/i',        // English
            '/\s*\[Dipindahkan dari\s+[^\]]+\]\s*$/i',        // Malay
            '/\s*\[โอนมาจาก\s+[^\]]+\]\s*$/u',                 // Thai
            '/\s*\[Chuyển giao từ\s+[^\]]+\]\s*$/iu',         // Vietnamese
        ];

        $cleanedName = $safeName;
        foreach ($patterns as $pattern) {
            $cleanedName = preg_replace($pattern, '', $cleanedName);
        }

        $cleanedName = trim($cleanedName);

        // 3. Final check: if name is empty after cleaning, use default
        if ($cleanedName === '') {
            $cleanedName = $defaultWorkspaceName;
        }

        // 4. Build new name with transfer suffix
        return sprintf('%s [%s %s]', $cleanedName, $transferSuffix, $safeUserName);
    }

    /**
     * Find existing workspace or create new one for receiver.
     * Prevents duplicate workspaces with same name.
     *
     * @param string $userId User ID
     * @param string $organizationCode Organization code
     * @param string $workspaceName Workspace name
     * @return WorkspaceEntity Workspace entity (existing or newly created)
     */
    public function findOrCreateWorkspaceForReceiver(
        string $userId,
        string $organizationCode,
        string $workspaceName
    ): WorkspaceEntity {
        // 1. Try to find existing workspace with same name
        $existingWorkspace = $this->workspaceRepository->findByUserAndName(
            $userId,
            $organizationCode,
            $workspaceName
        );

        // 2. Return existing workspace if found
        if ($existingWorkspace !== null) {
            return $existingWorkspace;
        }

        // 3. Create new workspace if not found
        return $this->createReceiverWorkspace($userId, $organizationCode, $workspaceName);
    }

    /**
     * Generate unique batch ID for transfer operation.
     */
    public function generateBatchId(): string
    {
        return 'batch_' . date('Ymd_His') . '_' . substr(md5(uniqid((string) mt_rand(), true)), 0, 8);
    }

    /**
     * Internal: Transfer workspace ownership with all projects.
     * Optimized version using batch updates.
     *
     * IMPORTANT: Uses "find or merge" logic to prevent duplicate workspace names.
     * If receiver already has a workspace with the same name, projects will be
     * merged into the existing workspace and current workspace will be deleted.
     *
     * @param int $workspaceId Workspace ID to transfer
     * @param string $fromUserId Original owner user ID
     * @param string $toUserId New owner user ID
     * @param string $organizationCode Organization code
     * @param string $fromUserName Original owner display name
     * @param string $transferSuffix i18n transfer suffix (e.g., "Transferred from")
     * @return TransferResult Transfer result with workspace and project info
     */
    private function doTransferWorkspace(
        int $workspaceId,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        string $fromUserName,
        string $transferSuffix = 'Transferred from'
    ): TransferResult {
        // 1. Validate workspace
        $workspace = $this->workspaceRepository->findById($workspaceId);
        if (! $workspace) {
            return TransferResult::failed('transfer.workspace_not_found');
        }

        if ($workspace->getUserId() !== $fromUserId) {
            return TransferResult::failed('transfer.no_permission_to_transfer');
        }

        // 2. Get all projects with details BEFORE update (to avoid duplicate query)
        $projectIds = $this->projectRepository->getProjectIdsByWorkspaceId(
            $workspaceId,
            $fromUserId,
            $organizationCode
        );

        if (empty($projectIds)) {
            return TransferResult::failed('transfer.cannot_transfer_empty_workspace');
        }

        // Get project details BEFORE batch update for response
        $projects = $this->projectRepository->findByIds($projectIds);
        $projectResults = [];
        foreach ($projects as $project) {
            $projectResults[] = [
                'id' => $project->getId(),
                'name' => $project->getProjectName(),
                'status' => 'success',
            ];
        }

        // 3. Build new workspace name with transfer suffix
        $newWorkspaceName = $this->buildTransferredWorkspaceName(
            $workspace->getName(),
            $fromUserName,
            $transferSuffix
        );

        // 4. CRITICAL FIX: Check if receiver already has a workspace with the same name
        // This prevents duplicate workspaces when transferring back and forth
        $existingWorkspace = $this->workspaceRepository->findByUserAndName(
            $toUserId,
            $organizationCode,
            $newWorkspaceName
        );

        if ($existingWorkspace !== null) {
            // Receiver already has a workspace with this name
            // Move projects to existing workspace and soft-delete current workspace
            $this->projectRepository->batchUpdateWorkspaceAndOwner(
                $projectIds,
                $existingWorkspace->getId(),
                $toUserId
            );

            // Soft-delete the original workspace (now empty)
            $this->workspaceRepository->deleteWorkspace($workspaceId);

            return TransferResult::successWorkspace(
                $existingWorkspace,
                $projectIds,
                $projectResults,
                0  // filesCount set to 0 for performance
            );
        }

        // 5. No existing workspace with same name, proceed with normal transfer
        $workspace->setUserId($toUserId);
        $workspace->setName($newWorkspaceName);
        $workspace->setUpdatedAt(date('Y-m-d H:i:s'));
        $this->workspaceRepository->save($workspace);

        // 6. OPTIMIZED: Batch update all projects at once
        $this->projectRepository->batchUpdateOwner($projectIds, $toUserId);

        return TransferResult::successWorkspace(
            $workspace,
            $projectIds,
            $projectResults,
            0  // filesCount set to 0 for performance
        );
    }

    /**
     * Internal: Transfer workspace projects while retaining original workspace for original owner.
     * Creates a new workspace for receiver and moves all projects there.
     * Original workspace ownership remains with original owner.
     * Optimized version using batch updates.
     *
     * @param int $originalWorkspaceId Original workspace ID
     * @param string $fromUserId Original owner user ID
     * @param string $toUserId New owner user ID
     * @param string $organizationCode Organization code
     * @param string $fromUserName Original owner display name
     * @param string $transferSuffix i18n transfer suffix (e.g., "Transferred from")
     * @return TransferResult Transfer result with new workspace and project info
     */
    private function doTransferWorkspaceWithRetainLocation(
        int $originalWorkspaceId,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        string $fromUserName,
        string $transferSuffix = 'Transferred from'
    ): TransferResult {
        // 1. Validate original workspace
        $originalWorkspace = $this->workspaceRepository->findById($originalWorkspaceId);
        if (! $originalWorkspace) {
            return TransferResult::failed('transfer.workspace_not_found');
        }

        if ($originalWorkspace->getUserId() !== $fromUserId) {
            return TransferResult::failed('transfer.no_permission_to_transfer');
        }

        // 2. Get all projects with details BEFORE update (to avoid duplicate query)
        $projectIds = $this->projectRepository->getProjectIdsByWorkspaceId(
            $originalWorkspaceId,
            $fromUserId,
            $organizationCode
        );

        if (empty($projectIds)) {
            return TransferResult::failed('transfer.cannot_transfer_empty_workspace');
        }

        // Get project details BEFORE batch update for response
        $projects = $this->projectRepository->findByIds($projectIds);
        $projectResults = [];
        foreach ($projects as $project) {
            $projectResults[] = [
                'id' => $project->getId(),
                'name' => $project->getProjectName(),
                'status' => 'success',
                'original_workspace_id' => $originalWorkspaceId,
            ];
        }

        // 3. Find or create workspace for receiver with formatted name
        $newWorkspaceName = $this->buildTransferredWorkspaceName(
            $originalWorkspace->getName(),
            $fromUserName,
            $transferSuffix
        );

        $newWorkspace = $this->findOrCreateWorkspaceForReceiver(
            $toUserId,
            $organizationCode,
            $newWorkspaceName
        );

        // 4. OPTIMIZED: Batch update all projects (workspace_id + user_id)
        $this->projectRepository->batchUpdateWorkspaceAndOwner(
            $projectIds,
            $newWorkspace->getId(),
            $toUserId
        );

        return TransferResult::successWorkspaceWithRetainLocation(
            $newWorkspace,
            $originalWorkspace,
            $projectIds,
            $projectResults,
            0  // filesCount set to 0 for performance
        );
    }

    /**
     * Internal: Transfer project while retaining original workspace for original owner.
     * Moves project to receiver's workspace, but original owner can access via shortcut binding.
     * Used when share_to_me=true and retain_original_location=true.
     *
     * CRITICAL: Project's workspace_id MUST be updated to receiver's workspace.
     * Original owner accesses project through member_settings bind_workspace_id (shortcut).
     *
     * @param int $projectId Project ID
     * @param string $fromUserId Original owner user ID
     * @param string $toUserId New owner user ID
     * @param string $organizationCode Organization code
     * @param string $fromUserName Original owner display name for naming
     * @param string $transferSuffix i18n transfer suffix
     * @return TransferResult Transfer result with original workspace info
     */
    private function transferProjectWithRetainLocation(
        int $projectId,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        string $fromUserName,
        string $transferSuffix
    ): TransferResult {
        // 1. Get project and verify ownership
        $project = $this->projectRepository->findById($projectId);
        if (! $project) {
            return TransferResult::failed('transfer.project_not_found');
        }

        if ($project->getUserId() !== $fromUserId) {
            return TransferResult::failed('transfer.no_permission_to_transfer');
        }

        // Store original workspace ID before transfer (for original owner's binding)
        $originalWorkspaceId = $project->getWorkspaceId();

        // Get original workspace details for naming
        $originalWorkspace = $this->workspaceRepository->findById($originalWorkspaceId);
        if (! $originalWorkspace) {
            return TransferResult::failed('transfer.workspace_not_found');
        }

        // 2. CRITICAL FIX: Project must be moved to receiver's workspace
        // This prevents "project belongs to receiver but still in original owner's workspace" issue
        // Original owner will access project via member_settings.bind_workspace_id (shortcut)

        // Build workspace name with transfer suffix for receiver
        $receiverWorkspaceName = $this->buildTransferredWorkspaceName(
            $originalWorkspace->getName(),
            $fromUserName,
            $transferSuffix
        );

        $receiverWorkspace = $this->findOrCreateWorkspaceForReceiver(
            $toUserId,
            $organizationCode,
            $receiverWorkspaceName
        );

        // 3. Update project ownership AND workspace_id
        $project->setUserId($toUserId);
        $project->setWorkspaceId($receiverWorkspace->getId());
        $project->setUpdatedAt(date('Y-m-d H:i:s'));
        $this->projectRepository->save($project);

        // 4. File ownership transfer is disabled for performance
        $filesCount = 0;

        return TransferResult::successProjectWithRetainLocation($project, $filesCount, $originalWorkspaceId);
    }

    /**
     * Internal: Transfer project by moving it to a new workspace for receiver.
     * Creates or finds a workspace with transfer suffix for receiver.
     * Used when share_to_me=false or retain_original_location=false.
     *
     * @param int $projectId Project ID
     * @param string $fromUserId Original owner user ID
     * @param string $toUserId New owner user ID
     * @param string $organizationCode Organization code
     * @param string $originalWorkspaceName Original workspace name
     * @param string $fromUserName Original owner display name
     * @param string $transferSuffix i18n transfer suffix
     * @return TransferResult Transfer result with new workspace info
     */
    private function transferProjectWithWorkspace(
        int $projectId,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        string $originalWorkspaceName,
        string $fromUserName,
        string $transferSuffix = 'Transferred from'
    ): TransferResult {
        // 1. Get project and verify ownership
        $project = $this->projectRepository->findById($projectId);
        if (! $project) {
            return TransferResult::failed('transfer.project_not_found');
        }

        if ($project->getUserId() !== $fromUserId) {
            return TransferResult::failed('transfer.no_permission_to_transfer');
        }

        // 2. Find or create workspace for receiver with transfer suffix
        $newWorkspaceName = $this->buildTransferredWorkspaceName(
            $originalWorkspaceName,
            $fromUserName,
            $transferSuffix
        );

        $targetWorkspace = $this->findOrCreateWorkspaceForReceiver(
            $toUserId,
            $organizationCode,
            $newWorkspaceName
        );

        // 3. Update project ownership and workspace
        $project->setUserId($toUserId);
        $project->setWorkspaceId($targetWorkspace->getId());
        $project->setUpdatedAt(date('Y-m-d H:i:s'));
        $this->projectRepository->save($project);

        // 4. File ownership transfer is disabled for performance
        $filesCount = 0;

        return TransferResult::successProject($project, $filesCount);
    }

    /**
     * Create workspace for receiver.
     *
     * @param string $userId User ID
     * @param string $organizationCode Organization code
     * @param string $workspaceName Workspace name
     * @return WorkspaceEntity Created workspace entity
     */
    private function createReceiverWorkspace(
        string $userId,
        string $organizationCode,
        string $workspaceName
    ): WorkspaceEntity {
        $now = date('Y-m-d H:i:s');
        $workspace = new WorkspaceEntity();
        $workspace->setUserId($userId);
        $workspace->setUserOrganizationCode($organizationCode);
        $workspace->setChatConversationId('');
        $workspace->setName($workspaceName);
        $workspace->setArchiveStatus(WorkspaceArchiveStatus::NotArchived);
        $workspace->setWorkspaceStatus(WorkspaceStatus::Normal);
        $workspace->setCreatedUid($userId);
        $workspace->setUpdatedUid($userId);
        $workspace->setCreatedAt($now);
        $workspace->setUpdatedAt($now);

        return $this->workspaceRepository->save($workspace);
    }
}
