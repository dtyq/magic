<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ProjectFileConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\FileMetadataUtil;
use Hyperf\Contract\StdoutLoggerInterface;
use Throwable;

class ProjectMetadataDomainService
{
    public function __construct(
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected CloudFileRepositoryInterface $cloudFileRepository,
        protected StdoutLoggerInterface $logger
    ) {
    }

    /**
     * Process project.js configuration file and update related entities metadata.
     *
     * @param TaskFileEntity $projectJsFileEntity The project.js file entity
     * @throws Throwable
     */
    public function processProjectConfigFile(TaskFileEntity $projectJsFileEntity): void
    {
        try {
            $this->logger->info('Starting to process project.js metadata', [
                'file_id' => $projectJsFileEntity->getFileId(),
                'file_key' => $projectJsFileEntity->getFileKey(),
            ]);

            // 1. Get file download URL or content
            $fileUrl = $this->getFileDownloadUrl($projectJsFileEntity);
            if (empty($fileUrl)) {
                $this->logger->warning('Unable to get download URL for project.js', [
                    'file_id' => $projectJsFileEntity->getFileId(),
                ]);
                return;
            }

            // 2. Extract metadata using utility
            $metadata = FileMetadataUtil::extractMagicProjectConfig($fileUrl);
            if ($metadata === null) {
                $this->logger->info('No metadata extracted from project.js', [
                    'file_id' => $projectJsFileEntity->getFileId(),
                ]);
                return;
            }

            $metadataJson = json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $this->logger->info('Successfully extracted metadata from project.js', [
                'file_id' => $projectJsFileEntity->getFileId(),
                'metadata' => $metadataJson,
            ]);

            // 3. Update parent directory metadata
            $this->updateParentDirectoryMetadata($projectJsFileEntity, $metadataJson);

            // 4. Handle special slide type
            if (($metadata['type'] ?? '') === ProjectFileConstant::METADATA_TYPE_SLIDE) {
                $this->updateSlideIndexMetadata($projectJsFileEntity, $metadataJson);
            }

            $this->logger->info('Successfully processed project.js metadata', [
                'file_id' => $projectJsFileEntity->getFileId(),
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to process project.js metadata', [
                'file_id' => $projectJsFileEntity->getFileId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * Update parent directory metadata.
     */
    private function updateParentDirectoryMetadata(TaskFileEntity $fileEntity, string $metadataJson): void
    {
        if ($fileEntity->getParentId() === null) {
            $this->logger->info('No parent directory found for project.js', [
                'file_id' => $fileEntity->getFileId(),
            ]);
            return;
        }

        $parentEntity = $this->taskFileRepository->getById($fileEntity->getParentId());
        if ($parentEntity === null) {
            $this->logger->warning('Parent directory entity not found', [
                'file_id' => $fileEntity->getFileId(),
                'parent_id' => $fileEntity->getParentId(),
            ]);
            return;
        }

        if ($parentEntity->getMetadata() === $metadataJson) {
            $this->logger->info('Parent directory metadata is up to date', [
                'file_id' => $fileEntity->getFileId(),
                'parent_id' => $fileEntity->getParentId(),
            ]);
            return;
        }

        $parentEntity->setMetadata($metadataJson);
        $this->taskFileRepository->updateById($parentEntity);

        $this->logger->info('Updated parent directory metadata', [
            'parent_id' => $parentEntity->getFileId(),
            'parent_name' => $parentEntity->getFileName(),
        ]);
    }

    /**
     * Update slide index.html metadata.
     */
    private function updateSlideIndexMetadata(TaskFileEntity $fileEntity, string $metadataJson): void
    {
        // Construct index.html file_key by replacing project.js with index.html
        $siblingFileKey = str_replace(
            ProjectFileConstant::PROJECT_CONFIG_FILENAME,
            ProjectFileConstant::SLIDE_INDEX_FILENAME,
            $fileEntity->getFileKey()
        );

        $siblingEntity = $this->taskFileRepository->getByFileKey($siblingFileKey);
        if ($siblingEntity === null) {
            $this->logger->info('Sibling index.html not found for slide type', [
                'project_js_file_id' => $fileEntity->getFileId(),
                'expected_index_key' => $siblingFileKey,
            ]);
            return;
        }

        if ($siblingEntity->getMetadata() === $metadataJson) {
            $this->logger->info('Sibling index.html metadata is up to date', [
                'index_file_id' => $siblingEntity->getFileId(),
                'index_file_key' => $siblingEntity->getFileKey(),
            ]);
            return;
        }
        $siblingEntity->setMetadata($metadataJson);
        $this->taskFileRepository->updateById($siblingEntity);

        $this->logger->info('Updated sibling index.html metadata', [
            'index_file_id' => $siblingEntity->getFileId(),
            'index_file_key' => $siblingEntity->getFileKey(),
        ]);
    }

    /**
     * Get file download URL (placeholder implementation).
     */
    private function getFileDownloadUrl(TaskFileEntity $fileEntity): ?string
    {
        $organizationCode = $fileEntity->getOrganizationCode();
        $filePath = $fileEntity->getFileKey();
        $fileLink = $this->cloudFileRepository->getLinks($organizationCode, [$filePath], StorageBucketType::SandBox)[$filePath] ?? null;
        return $fileLink?->getUrl();
    }
}
