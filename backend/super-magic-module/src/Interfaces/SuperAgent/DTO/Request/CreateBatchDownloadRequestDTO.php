<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

class CreateBatchDownloadRequestDTO
{
    /**
     * @var array File ID array
     */
    private array $fileIds = [];

    /**
     * @var string Project ID
     */
    private string $projectId = '';

    /**
     * Get file ID array.
     */
    public function getFileIds(): array
    {
        return $this->fileIds;
    }

    /**
     * Set file ID array.
     */
    public function setFileIds(array $fileIds): self
    {
        $this->fileIds = $fileIds;
        return $this;
    }

    /**
     * Get project ID.
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }

    /**
     * Set project ID.
     */
    public function setProjectId(string $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    /**
     * Create DTO from request data.
     *
     * @param array $requestData Request data
     */
    public static function fromRequest(array $requestData): self
    {
        $dto = new self();
        $fileIds = $requestData['file_ids'] ?? [];
        $projectId = $requestData['project_id'] ?? '';

        // Validation for project_id
        if (! is_string($projectId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED);
        }

        // Validation for file_ids
        if (! is_array($fileIds)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_FILE_IDS_INVALID);
        }

        // Either file_ids or topic_id must be provided
        if (empty($fileIds) && empty($projectId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_FILE_IDS_OR_TOPIC_ID_REQUIRED);
        }

        // If file_ids is provided, validate it
        if (! empty($fileIds)) {
            if (count($fileIds) > 1000) {
                ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_TOO_MANY_FILES);
            }

            foreach ($fileIds as $fileId) {
                if (empty($fileId) || ! is_string($fileId)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::BATCH_FILE_IDS_INVALID);
                }
            }
        }

        $dto->setFileIds($fileIds);
        $dto->setProjectId($projectId);
        return $dto;
    }
}
