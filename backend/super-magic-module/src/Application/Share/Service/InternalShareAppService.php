<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\Service;

use Dtyq\SuperMagic\Domain\FileCollection\Service\FileCollectionDomainService;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareTitleResponseDTO;
use Throwable;

/**
 * Internal share application service.
 */
class InternalShareAppService
{
    public function __construct(
        protected ResourceShareDomainService $shareDomainService,
        protected ProjectDomainService $projectDomainService,
        protected TopicDomainService $topicDomainService,
        protected TaskFileDomainService $taskFileDomainService,
        protected FileCollectionDomainService $fileCollectionDomainService
    ) {
    }

    /**
     * Get share title by resource ID.
     */
    public function getShareTitle(string $resourceId): ShareTitleResponseDTO
    {
        $dto = new ShareTitleResponseDTO();

        // 1. Query share entity by resource_id and is_enabled = 1
        $shareEntity = $this->shareDomainService->getShareByResourceId($resourceId);

        // If share not found or not enabled, return empty data
        if (empty($shareEntity) || ! $shareEntity->getIsEnabled()) {
            return $dto;
        }

        // 2. Get project name
        $projectId = $shareEntity->getProjectId();
        if (! empty($projectId)) {
            try {
                $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $projectId);
                if ($projectEntity !== null) {
                    $dto->projectName = $projectEntity->getProjectName();
                }
            } catch (Throwable $e) {
                // Ignore errors, keep project_name as empty string
            }
        }

        // 3. Get resource type
        $resourceType = $shareEntity->getResourceType();
        $dto->resourceType = $resourceType;

        // 4. Process based on resource type
        switch ($resourceType) {
            case ResourceType::Topic->value:
                // resource_id is topic id
                $this->processTopicShare($dto, (int) $resourceId);
                break;
            case ResourceType::Project->value:
                // resource_id is project id, no additional processing needed
                break;
            case ResourceType::FileCollection->value:
                // resource_id is collection_id
                $this->processFileCollectionShare($dto, (int) $resourceId, $shareEntity->getDefaultOpenFileId());
                break;
        }

        return $dto;
    }

    /**
     * Process topic share.
     */
    private function processTopicShare(ShareTitleResponseDTO $dto, int $topicId): void
    {
        try {
            $topicEntity = $this->topicDomainService->getTopicById($topicId);
            if ($topicEntity !== null) {
                $dto->topicName = $topicEntity->getTopicName();
            }
        } catch (Throwable $e) {
            // Ignore errors, keep topic_name as empty string
        }
    }

    /**
     * Process file collection share.
     */
    private function processFileCollectionShare(
        ShareTitleResponseDTO $dto,
        int $collectionId,
        ?int $defaultOpenFileId
    ): void {
        $fileIds = [];

        if ($defaultOpenFileId !== null && $defaultOpenFileId > 0) {
            // If default_open_file_id is not empty, use it as file_id
            $fileIds = [$defaultOpenFileId];
        } else {
            // If default_open_file_id is empty, query by collection_id
            // Get file collection items (limit 5)
            try {
                $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);
                if (! empty($fileCollectionItems)) {
                    // Limit to 5 items
                    $fileCollectionItems = array_slice($fileCollectionItems, 0, 5);
                    $fileIds = array_map(fn ($item) => (int) $item->getFileId(), $fileCollectionItems);
                }
            } catch (Throwable $e) {
                // Ignore errors, keep file_names as empty array
                return;
            }
        }

        // Query file entities and get file names
        if (! empty($fileIds)) {
            try {
                $fileEntities = $this->taskFileDomainService->getFilesByIds($fileIds, 0);
                $dto->fileNames = array_map(fn ($file) => $file->getFileName(), $fileEntities);
            } catch (Throwable $e) {
                // Ignore errors, keep file_names as empty array
            }
        }
    }
}
