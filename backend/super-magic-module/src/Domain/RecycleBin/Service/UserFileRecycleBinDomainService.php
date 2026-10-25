<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\RecycleBin\Service;

use Dtyq\SuperMagic\Domain\RecycleBin\Enum\RecycleBinResourceType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\DeleteEventSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\RelativeFilePathUtil;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

/** 个人文件沿用回收站的记录接口；项目删除事件继续由原订阅者处理。 */
class UserFileRecycleBinDomainService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly RecycleBinDomainService $recycleBinDomainService,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /** @param list<TaskFileEntity> $files */
    public function recordFiles(array $files, string $deletedBy, DeleteEventSource $source): void
    {
        if ($files === []) {
            return;
        }
        $first = $files[0];
        try {
            $paths = $this->buildRelativePathMap($files, $first->getProjectId());
            foreach ($files as $file) {
                $this->recordFileDeletion($file, $deletedBy, $source, $paths[$file->getFileId()]);
            }
        } catch (Throwable $e) {
            // 沿用项目订阅者的失败边界：保留已删除文件和已写记录，停止本批后续记录，不自动回滚或重试。
            $this->logger->error('写入个人文件回收站失败', [
                'user_id' => $deletedBy,
                'organization_code' => $first->getOrganizationCode(),
                'source' => $source->value,
                'file_count' => count($files),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    private function recordFileDeletion(
        TaskFileEntity $fileEntity,
        string $deletedBy,
        DeleteEventSource $source,
        string $relativeFilePath,
    ): void {
        if ($fileEntity->isProjectFile() || $fileEntity->getSpaceType() !== 'user') {
            throw new InvalidArgumentException('Only personal files use this recycle bin adapter');
        }
        $fileId = (int) $fileEntity->getFileId();
        if ($fileId <= 0) {
            return;
        }

        $existing = $this->recycleBinDomainService->findByResource(RecycleBinResourceType::File, $fileId);
        if ($existing !== null) {
            return;
        }

        $originalParentId = $fileEntity->getParentId();
        $originalParentName = '';
        if ($originalParentId !== null && $originalParentId > 0) {
            $parent = $this->taskFileRepository->getByIdWithTrash($originalParentId);
            $originalParentName = $parent?->getFileName() ?? '';
        }

        $this->recycleBinDomainService->recordDeletion(
            resourceType: RecycleBinResourceType::File,
            resourceId: $fileId,
            resourceName: $fileEntity->getFileName(),
            ownerId: $fileEntity->getUserId(),
            deletedBy: $deletedBy,
            parentId: null,
            extraData: [
                'space_type' => 'user',
                'organization_code' => $fileEntity->getOrganizationCode(),
                'delete_source' => $source->value,
                'is_directory' => $fileEntity->getIsDirectory(),
                'file_key' => $fileEntity->getFileKey(),
                'storage_type' => $fileEntity->getStorageType()->value,
                'source' => $fileEntity->getSource()->value,
                'original_parent_id' => $originalParentId,
                'original_parent_name' => $originalParentName,
                'relative_file_path' => $relativeFilePath,
            ]
        );
    }

    /**
     * @param TaskFileEntity[] $fileEntities
     * @return array<int, string>
     */
    private function buildRelativePathMap(array $fileEntities, int $projectId): array
    {
        if (empty($fileEntities)) {
            return [];
        }

        $parentIds = [];
        foreach ($fileEntities as $fileEntity) {
            $parentId = $fileEntity->getParentId();
            if ($parentId !== null && $parentId > 0) {
                $parentIds[$parentId] = $parentId;
            }
        }

        $filesWithParents = empty($parentIds)
            ? []
            : $this->taskFileRepository->getFilesWithParentsByIds(array_values($parentIds), $projectId);
        $fileMap = RelativeFilePathUtil::indexByFileId($filesWithParents);

        foreach ($fileEntities as $fileEntity) {
            $fileMap[$fileEntity->getFileId()] = $fileEntity;
        }

        return RelativeFilePathUtil::buildPathMapByParentChain($fileEntities, $fileMap);
    }
}
