<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WorkspaceEntity;

/**
 * Transfer result value object.
 *
 * Immutable object representing the result of a transfer operation.
 * Contains all information needed for subsequent processing.
 */
final class TransferResult
{
    public function __construct(
        public readonly bool $success,
        public readonly ?ProjectEntity $project = null,
        public readonly ?WorkspaceEntity $workspace = null,
        public readonly ?WorkspaceEntity $originalWorkspace = null,
        public readonly array $transferredProjectIds = [],
        public readonly array $projectResults = [],
        public readonly int $filesCount = 0,
        public readonly ?string $errorMessage = null,
        public readonly ?int $originalWorkspaceIdForProject = null,
    ) {
    }

    /**
     * Check if the transfer was successful.
     */
    public function isSuccess(): bool
    {
        return $this->success;
    }

    /**
     * Get the transferred project entity (for single project transfer).
     */
    public function getProject(): ?ProjectEntity
    {
        return $this->project;
    }

    /**
     * Get the transferred workspace entity (for workspace transfer).
     */
    public function getWorkspace(): ?WorkspaceEntity
    {
        return $this->workspace;
    }

    /**
     * Get the original workspace entity (for retain location transfer).
     */
    public function getOriginalWorkspace(): ?WorkspaceEntity
    {
        return $this->originalWorkspace;
    }

    /**
     * Get the list of transferred project IDs.
     */
    public function getTransferredProjectIds(): array
    {
        return $this->transferredProjectIds;
    }

    /**
     * Get the project results (for workspace transfer).
     */
    public function getProjectResults(): array
    {
        return $this->projectResults;
    }

    /**
     * Get the total files count.
     */
    public function getFilesCount(): int
    {
        return $this->filesCount;
    }

    /**
     * Get the error message if failed.
     */
    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    /**
     * Get the original workspace ID for project transfer (retain location).
     */
    public function getOriginalWorkspaceIdForProject(): ?int
    {
        return $this->originalWorkspaceIdForProject;
    }

    /**
     * Convert to API response format.
     */
    public function toApiResponse(int $resourceId): array
    {
        if (! $this->success) {
            return [
                'resource_id' => (string) $resourceId,
                'status' => 'failed',
                'error' => $this->errorMessage ?? 'Unknown error',
            ];
        }

        return [
            'resource_id' => (string) $resourceId,
            'status' => 'success',
            'files_count' => $this->filesCount,
            'projects_count' => count($this->transferredProjectIds),
        ];
    }

    /**
     * Create a failed result.
     */
    public static function failed(string $errorMessage): self
    {
        return new self(
            success: false,
            errorMessage: $errorMessage
        );
    }

    /**
     * Create a successful project transfer result.
     */
    public static function successProject(ProjectEntity $project, int $filesCount): self
    {
        return new self(
            success: true,
            project: $project,
            transferredProjectIds: [$project->getId()],
            filesCount: $filesCount
        );
    }

    /**
     * Create a successful project transfer result with retain location.
     * Used when original owner retains access and original workspace location.
     *
     * @param ProjectEntity $project Transferred project entity
     * @param int $filesCount Number of files transferred
     * @param int $originalWorkspaceId Original workspace ID for binding
     * @return self Transfer result
     */
    public static function successProjectWithRetainLocation(
        ProjectEntity $project,
        int $filesCount,
        int $originalWorkspaceId
    ): self {
        return new self(
            success: true,
            project: $project,
            transferredProjectIds: [$project->getId()],
            filesCount: $filesCount,
            originalWorkspaceIdForProject: $originalWorkspaceId
        );
    }

    /**
     * Create a successful workspace transfer result.
     */
    public static function successWorkspace(
        WorkspaceEntity $workspace,
        array $transferredProjectIds,
        array $projectResults,
        int $filesCount
    ): self {
        return new self(
            success: true,
            workspace: $workspace,
            transferredProjectIds: $transferredProjectIds,
            projectResults: $projectResults,
            filesCount: $filesCount
        );
    }

    /**
     * Create a successful workspace transfer result with retain location.
     * Used when original workspace is retained and projects moved to new workspace.
     */
    public static function successWorkspaceWithRetainLocation(
        WorkspaceEntity $newWorkspace,
        WorkspaceEntity $originalWorkspace,
        array $transferredProjectIds,
        array $projectResults,
        int $filesCount
    ): self {
        return new self(
            success: true,
            workspace: $newWorkspace,
            originalWorkspace: $originalWorkspace,
            transferredProjectIds: $transferredProjectIds,
            projectResults: $projectResults,
            filesCount: $filesCount
        );
    }
}
