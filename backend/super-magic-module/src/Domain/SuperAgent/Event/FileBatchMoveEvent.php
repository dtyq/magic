<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use InvalidArgumentException;

/**
 * File batch move event.
 *
 * Used for asynchronous batch file move operations when dealing with multiple files.
 */
class FileBatchMoveEvent
{
    /**
     * Constructor.
     *
     * @param string $batchKey Batch operation key for tracking
     * @param string $userId User ID
     * @param string $organizationCode Organization code
     * @param array $fileIds Array of file IDs to move
     * @param int $projectId Project ID
     * @param null|int $preFileId Previous file ID for positioning (nullable)
     * @param int $targetParentId Target parent directory ID
     */
    public function __construct(
        private readonly string $batchKey,
        private readonly string $userId,
        private readonly string $organizationCode,
        private readonly array $fileIds,
        private readonly int $projectId,
        private readonly ?int $preFileId,
        private readonly int $targetParentId
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
     * Get project ID.
     */
    public function getProjectId(): int
    {
        return $this->projectId;
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
            $data['project_id'] ?? 0,
            $data['pre_file_id'] ?? null,
            $data['target_parent_id'] ?? 0
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
            'project_id' => $this->projectId,
            'pre_file_id' => $this->preFileId,
            'target_parent_id' => $this->targetParentId,
        ];
    }

    /**
     * Create from domain objects.
     *
     * @param string $batchKey Batch key
     * @param mixed $dataIsolation Data isolation object
     * @param array $fileIds Array of file IDs
     * @param int $projectId Project ID
     * @param null|int $preFileId Previous file ID
     * @param int $targetParentId Target parent ID
     */
    public static function fromDomainObjects(
        string $batchKey,
        $dataIsolation,
        array $fileIds,
        int $projectId,
        ?int $preFileId,
        int $targetParentId
    ): self {
        return new self(
            $batchKey,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            $fileIds,
            $projectId,
            $preFileId,
            $targetParentId
        );
    }

    /**
     * Create from DTO and domain objects.
     */
    public static function fromDTO(
        string $batchKey,
        string $userId,
        string $organizationCode,
        array $fileIds,
        int $projectId,
        ?int $preFileId,
        int $targetParentId
    ): self {
        return new self(
            $batchKey,
            $userId,
            $organizationCode,
            array_map('intval', $fileIds),
            $projectId,
            $preFileId ?? null,
            $targetParentId
        );
    }
}
