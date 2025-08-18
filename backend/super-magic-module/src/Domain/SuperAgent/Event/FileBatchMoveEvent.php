<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

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
     * @param int|null $preFileId Previous file ID for positioning (nullable)
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
    ) {}

    /**
     * Get batch key.
     * 
     * @return string
     */
    public function getBatchKey(): string
    {
        return $this->batchKey;
    }

    /**
     * Get user ID.
     * 
     * @return string
     */
    public function getUserId(): string
    {
        return $this->userId;
    }

    /**
     * Get organization code.
     * 
     * @return string
     */
    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    /**
     * Get file IDs.
     * 
     * @return array
     */
    public function getFileIds(): array
    {
        return $this->fileIds;
    }

    /**
     * Get project ID.
     * 
     * @return int
     */
    public function getProjectId(): int
    {
        return $this->projectId;
    }

    /**
     * Get previous file ID.
     * 
     * @return int|null
     */
    public function getPreFileId(): ?int
    {
        return $this->preFileId;
    }

    /**
     * Get target parent directory ID.
     * 
     * @return int
     */
    public function getTargetParentId(): int
    {
        return $this->targetParentId;
    }

    /**
     * Create event from array data.
     * 
     * @param array $data Event data
     * @return static
     * @throws \InvalidArgumentException When required data is missing
     */
    public static function fromArray(array $data): static
    {
        return new static(
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
     * 
     * @return array
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
            'target_parent_id' => $this->targetParentId
        ];
    }

    /**
     * Create from domain objects.
     * 
     * @param string $batchKey Batch key
     * @param mixed $dataIsolation Data isolation object
     * @param array $fileIds Array of file IDs
     * @param int $projectId Project ID
     * @param int|null $preFileId Previous file ID
     * @param int $targetParentId Target parent ID
     * @return static
     */
    public static function fromDomainObjects(
        string $batchKey,
        $dataIsolation,
        array $fileIds,
        int $projectId,
        ?int $preFileId,
        int $targetParentId
    ): static {
        return new static(
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
     * 
     * @param string $batchKey Batch key
     * @param mixed $dataIsolation Data isolation object
     * @param mixed $requestDTO Request DTO
     * @return static
     */
    public static function fromDTO(
        string $batchKey,
        $dataIsolation,
        $requestDTO
    ): static {
        return new static(
            $batchKey,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            array_map('intval', $requestDTO->getFileIds()),
            (int) $requestDTO->getProjectId(),
            !empty($requestDTO->getPreFileId()) ? (int) $requestDTO->getPreFileId() : null,
            (int) $requestDTO->getTargetParentId()
        );
    }
}
