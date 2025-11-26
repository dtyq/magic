<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use InvalidArgumentException;

/**
 * File batch copy event.
 *
 * Used for asynchronous batch file copy operations when dealing with multiple files.
 */
class FileBatchCopyEvent
{
    /**
     * Constructor.
     *
     * @param string $batchKey Batch operation key for tracking
     * @param string $userId User ID
     * @param string $organizationCode Organization code
     * @param array $fileIds Array of file IDs to copy
     * @param int $targetProjectId Target project ID
     * @param int $sourceProjectId Source project ID
     * @param null|int $preFileId Previous file ID for positioning (nullable)
     * @param int $targetParentId Target parent directory ID
     * @param array $keepBothFileIds Array of source file IDs that should not overwrite when conflict occurs
     */
    public function __construct(
        private readonly string $batchKey,
        private readonly string $userId,
        private readonly string $organizationCode,
        private readonly array $fileIds,
        private readonly int $targetProjectId,
        private readonly int $sourceProjectId,
        private readonly ?int $preFileId,
        private readonly int $targetParentId,
        private readonly array $keepBothFileIds = []
    ) {
    }

    /**
     * Get batch key.
     */
    public function getBatchKey(): string
    {
        return $this->batchKey;
    }

    /**
     * Get user ID.
     */
    public function getUserId(): string
    {
        return $this->userId;
    }

    /**
     * Get organization code.
     */
    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    /**
     * Get file IDs.
     */
    public function getFileIds(): array
    {
        return $this->fileIds;
    }

    /**
     * Get target project ID.
     */
    public function getTargetProjectId(): int
    {
        return $this->targetProjectId;
    }

    /**
     * Get source project ID.
     */
    public function getSourceProjectId(): int
    {
        return $this->sourceProjectId;
    }

    /**
     * Get project ID (for backward compatibility).
     *
     * @deprecated Use getTargetProjectId() instead
     */
    public function getProjectId(): int
    {
        return $this->targetProjectId;
    }

    /**
     * Get previous file ID.
     */
    public function getPreFileId(): ?int
    {
        return $this->preFileId;
    }

    /**
     * Get target parent directory ID.
     */
    public function getTargetParentId(): int
    {
        return $this->targetParentId;
    }

    /**
     * Get keep both file IDs.
     */
    public function getKeepBothFileIds(): array
    {
        return $this->keepBothFileIds;
    }

    /**
     * Create event from array data.
     *
     * @param array $data Event data
     * @throws InvalidArgumentException When required data is missing
     */
    public static function fromArray(array $data): self
    {
        return new self(
            $data['batch_key'] ?? '',
            $data['user_id'] ?? '',
            $data['organization_code'] ?? '',
            $data['file_ids'] ?? [],
            $data['target_project_id'] ?? $data['project_id'] ?? 0,  // Support backward compatibility
            $data['source_project_id'] ?? $data['project_id'] ?? 0,  // Support backward compatibility
            $data['pre_file_id'] ?? null,
            $data['target_parent_id'] ?? 0,
            $data['keep_both_file_ids'] ?? []
        );
    }

    /**
     * Convert event to array.
     */
    public function toArray(): array
    {
        return [
            'batch_key' => $this->batchKey,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'file_ids' => $this->fileIds,
            'target_project_id' => $this->targetProjectId,
            'source_project_id' => $this->sourceProjectId,
            'pre_file_id' => $this->preFileId,
            'target_parent_id' => $this->targetParentId,
            'keep_both_file_ids' => $this->keepBothFileIds,
        ];
    }

    /**
     * Create from domain objects.
     *
     * @param string $batchKey Batch key
     * @param mixed $dataIsolation Data isolation object
     * @param array $fileIds Array of file IDs
     * @param int $targetProjectId Target project ID
     * @param int $sourceProjectId Source project ID
     * @param null|int $preFileId Previous file ID
     * @param int $targetParentId Target parent ID
     * @param array $keepBothFileIds Array of source file IDs that should not overwrite when conflict occurs
     */
    public static function fromDomainObjects(
        string $batchKey,
        $dataIsolation,
        array $fileIds,
        int $targetProjectId,
        int $sourceProjectId,
        ?int $preFileId,
        int $targetParentId,
        array $keepBothFileIds = []
    ): self {
        return new self(
            $batchKey,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            $fileIds,
            $targetProjectId,
            $sourceProjectId,
            $preFileId,
            $targetParentId,
            $keepBothFileIds
        );
    }

    /**
     * Create from DTO and domain objects.
     *
     * @param string $batchKey Batch key
     * @param string $userId User ID
     * @param string $organizationCode Organization code
     * @param array $fileIds Array of file IDs
     * @param int $targetProjectId Target project ID
     * @param int $sourceProjectId Source project ID
     * @param null|int $preFileId Previous file ID
     * @param int $targetParentId Target parent ID
     * @param array $keepBothFileIds Array of source file IDs that should not overwrite when conflict occurs
     */
    public static function fromDTO(
        string $batchKey,
        string $userId,
        string $organizationCode,
        array $fileIds,
        int $targetProjectId,
        int $sourceProjectId,
        ?int $preFileId,
        int $targetParentId,
        array $keepBothFileIds = []
    ): self {
        return new self(
            $batchKey,
            $userId,
            $organizationCode,
            array_map('intval', $fileIds),
            $targetProjectId,
            $sourceProjectId,
            $preFileId ?? null,
            $targetParentId,
            $keepBothFileIds
        );
    }
}
