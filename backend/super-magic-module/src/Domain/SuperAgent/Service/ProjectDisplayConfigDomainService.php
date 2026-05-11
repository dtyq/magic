<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ProjectFileConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\FileMetadataUtil;
use Throwable;

class ProjectDisplayConfigDomainService
{
    use HasLogger;

    public function __construct(
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected CloudFileRepositoryInterface $cloudFileRepository,
    ) {
    }

    /**
     * Process project.js configuration file and update related entities display config.
     *
     * @param TaskFileEntity $projectJsFileEntity The project.js file entity
     * @return null|array Returns extracted metadata array, or null if processing failed
     * @throws Throwable
     */
    public function processProjectConfigFile(TaskFileEntity $projectJsFileEntity): ?array
    {
        try {
            $this->logger->info('Starting to process project.js display config', [
                'file_id' => $projectJsFileEntity->getFileId(),
                'file_key' => $projectJsFileEntity->getFileKey(),
            ]);

            // 1. Get file download URL or content
            $fileUrl = $this->getFileDownloadUrl($projectJsFileEntity);
            if (empty($fileUrl)) {
                $this->logger->warning('Unable to get download URL for project.js', [
                    'file_id' => $projectJsFileEntity->getFileId(),
                ]);
                return null;
            }

            // 2. Extract display config using utility
            $displayConfig = FileMetadataUtil::extractMagicProjectConfig($fileUrl);
            if ($displayConfig === null) {
                $this->logger->info('No display config extracted from project.js', [
                    'file_id' => $projectJsFileEntity->getFileId(),
                ]);
                return null;
            }

            $displayConfigJson = json_encode($displayConfig, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $this->logger->info('Successfully extracted display config from project.js', [
                'file_id' => $projectJsFileEntity->getFileId(),
                'display_config' => $displayConfigJson,
            ]);

            // 3. Update parent directory display config
            $this->updateParentDirectoryDisplayConfig($projectJsFileEntity, $displayConfigJson);

            // 4. Handle special slide type
            $this->updateSlideIndexDisplayConfig($projectJsFileEntity, $displayConfigJson);

            $this->logger->info('Successfully processed project.js display config', [
                'file_id' => $projectJsFileEntity->getFileId(),
            ]);

            return $displayConfig;
        } catch (Throwable $e) {
            $this->logger->error('Failed to process project.js display config', [
                'file_id' => $projectJsFileEntity->getFileId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * Clear display_config for the old parent directory and its sibling index.html.
     *
     * Called when magic.project.js is moved out of a directory so the stale
     * display_config is removed from both the parent directory and the
     * co-located index.html file.
     *
     * @param int $oldParentId File ID of the directory magic.project.js left
     * @param int $projectId Project ID (required by repository query)
     */
    public function clearDisplayConfigForOldDirectory(int $oldParentId, int $projectId): void
    {
        // 1. Clear parent directory display_config
        $parentEntity = $this->taskFileRepository->getById($oldParentId);
        if ($parentEntity !== null && $parentEntity->getDisplayConfig() !== null) {
            $parentEntity->setDisplayConfig(null);
            $this->taskFileRepository->updateById($parentEntity);
            $this->logger->info('Cleared display_config for old parent directory', [
                'parent_id' => $oldParentId,
                'project_id' => $projectId,
            ]);
        }

        // 2. Find sibling index.html by name and clear its display_config
        // Use name-based lookup because the file_key path has changed after the move
        $siblings = $this->taskFileRepository->getChildrenByParentAndProject(
            $projectId,
            $oldParentId,
            500
        );
        foreach ($siblings as $sibling) {
            if ($sibling->getFileName() === ProjectFileConstant::SLIDE_INDEX_FILENAME
                && $sibling->getDisplayConfig() !== null
            ) {
                $sibling->setDisplayConfig(null);
                $this->taskFileRepository->updateById($sibling);
                $this->logger->info('Cleared display_config for old sibling index.html', [
                    'sibling_file_id' => $sibling->getFileId(),
                    'parent_id' => $oldParentId,
                ]);
                break;
            }
        }
    }

    /**
     * Update parent directory display config.
     */
    private function updateParentDirectoryDisplayConfig(TaskFileEntity $fileEntity, string $displayConfigJson): void
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

        if ($parentEntity->getDisplayConfig() === $displayConfigJson) {
            $this->logger->info('Parent directory display config is up to date', [
                'file_id' => $fileEntity->getFileId(),
                'parent_id' => $fileEntity->getParentId(),
            ]);
            return;
        }

        $parentEntity->setDisplayConfig($displayConfigJson);
        $this->taskFileRepository->updateById($parentEntity);

        $this->logger->info('Updated parent directory display config', [
            'parent_id' => $parentEntity->getFileId(),
            'parent_name' => $parentEntity->getFileName(),
        ]);
    }

    /**
     * Update slide index.html display config.
     */
    private function updateSlideIndexDisplayConfig(TaskFileEntity $fileEntity, string $displayConfigJson): void
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

        if ($siblingEntity->getDisplayConfig() === $displayConfigJson) {
            $this->logger->info('Sibling index.html display config is up to date', [
                'index_file_id' => $siblingEntity->getFileId(),
                'index_file_key' => $siblingEntity->getFileKey(),
            ]);
            return;
        }
        $siblingEntity->setDisplayConfig($displayConfigJson);
        $this->taskFileRepository->updateById($siblingEntity);

        $this->logger->info('Updated sibling index.html display config', [
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
