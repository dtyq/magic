<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileVersionEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileVersionRepositoryInterface;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

class TaskFileVersionDomainService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        protected TaskFileVersionRepositoryInterface $taskFileVersionRepository,
        protected CloudFileRepositoryInterface $cloudFileRepository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 创建文件版本.
     */
    public function createFileVersion(TaskFileEntity $fileEntity, int $editType = 1): ?TaskFileVersionEntity
    {
        // 仅对非目录文件创建版本
        if ($fileEntity->getIsDirectory()) {
            $this->logger->info('Skipping version creation for directory file', [
                'file_id' => $fileEntity->getFileId(),
                'file_name' => $fileEntity->getFileName(),
            ]);
            return null;
        }

        // 1. 获取下一个版本号
        $nextVersion = $this->getNextVersionNumber($fileEntity->getFileId());

        // 2. 生成版本文件路径
        $versionFileKey = $this->generateVersionFileKey($fileEntity->getFileKey(), $nextVersion);

        // 3. 复制OSS文件到版本路径
        $this->logger->info('Copying file to version path', [
            'organization_code' => $fileEntity->getOrganizationCode(),
            'source_key' => $fileEntity->getFileKey(),
            'destination_key' => $versionFileKey,
        ]);

        $this->copyFile(
            $fileEntity->getOrganizationCode(),
            $fileEntity->getFileKey(),
            $versionFileKey
        );

        $this->logger->info('File copied to version path successfully', [
            'organization_code' => $fileEntity->getOrganizationCode(),
            'source_key' => $fileEntity->getFileKey(),
            'destination_key' => $versionFileKey,
        ]);

        // 4. 创建版本记录
        $versionEntity = new TaskFileVersionEntity();
        $versionEntity->setId(IdGenerator::getSnowId());
        $versionEntity->setFileId($fileEntity->getFileId());
        $versionEntity->setOrganizationCode($fileEntity->getOrganizationCode());
        $versionEntity->setFileKey($versionFileKey);
        $versionEntity->setVersion($nextVersion);
        $versionEntity->setEditType($editType);

        $savedEntity = $this->taskFileVersionRepository->insert($versionEntity);

        // 5. 清理旧版本
        $maxVersions = (int) config('super-magic.file_version.max_versions', 10);
        $this->cleanupOldVersions($fileEntity->getFileId(), $maxVersions);

        $this->logger->info('File version created successfully', [
            'file_id' => $fileEntity->getFileId(),
            'version' => $nextVersion,
            'version_file_key' => $versionFileKey,
            'edit_type' => $editType,
        ]);

        return $savedEntity;
    }

    /**
     * 获取文件的历史版本列表.
     */
    public function getFileVersions(int $fileId): array
    {
        return $this->taskFileVersionRepository->getByFileId($fileId);
    }

    /**
     * 分页获取文件的历史版本列表.
     *
     * @param int $fileId 文件ID
     * @param int $page 页码（从1开始）
     * @param int $pageSize 每页数量
     * @return array 包含 list（TaskFileVersionEntity数组）和 total（总数）的数组
     */
    public function getFileVersionsWithPage(int $fileId, int $page, int $pageSize): array
    {
        $this->logger->info('Getting file versions with pagination', [
            'file_id' => $fileId,
            'page' => $page,
            'page_size' => $pageSize,
        ]);

        // 调用仓库层的分页查询方法
        $result = $this->taskFileVersionRepository->getByFileIdWithPage($fileId, $page, $pageSize);

        $this->logger->info('File versions retrieved successfully', [
            'file_id' => $fileId,
            'total' => $result['total'],
            'current_page_count' => count($result['list']),
        ]);

        return $result;
    }

    /**
     * 批量清理多个文件的版本（用于定时任务等场景）.
     */
    public function batchCleanupFileVersions(array $fileIds, int $maxVersions): array
    {
        $stats = [
            'total_files' => count($fileIds),
            'processed_files' => 0,
            'total_deleted' => 0,
            'errors' => [],
        ];

        foreach ($fileIds as $fileId) {
            try {
                $deletedCount = $this->cleanupOldVersions($fileId, $maxVersions);
                $stats['total_deleted'] += $deletedCount;
                ++$stats['processed_files'];
            } catch (Throwable $e) {
                $stats['errors'][] = [
                    'file_id' => $fileId,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $stats;
    }

    /**
     * 文件回滚到指定版本.
     */
    public function rollbackFileToVersion(TaskFileEntity $fileEntity, int $targetVersion): ?TaskFileVersionEntity
    {
        $fileId = $fileEntity->getFileId();
        $organizationCode = $fileEntity->getOrganizationCode();

        $this->logger->info('Starting file rollback to version', [
            'file_id' => $fileId,
            'target_version' => $targetVersion,
            'organization_code' => $organizationCode,
        ]);

        // 1. 验证目标版本是否存在
        $targetVersionEntity = $this->taskFileVersionRepository->getByFileIdAndVersion($fileId, $targetVersion);
        if (! $targetVersionEntity) {
            $this->logger->error('Target version not found', [
                'file_id' => $fileId,
                'target_version' => $targetVersion,
            ]);
            return null;
        }

        $this->logger->info('Target version found', [
            'file_id' => $fileId,
            'target_version' => $targetVersion,
            'version_file_key' => $targetVersionEntity->getFileKey(),
        ]);

        // 2. 将版本文件复制到当前文件位置
        $currentFileKey = $fileEntity->getFileKey();
        $versionFileKey = $targetVersionEntity->getFileKey();

        $this->logger->info('Copying version file to current file location', [
            'source_key' => $versionFileKey,
            'destination_key' => $currentFileKey,
        ]);

        $this->copyFile(
            $organizationCode,
            $versionFileKey,
            $currentFileKey
        );

        $this->logger->info('File copied from version to workspace successfully', [
            'source_key' => $versionFileKey,
            'destination_key' => $currentFileKey,
        ]);

        // 3. 复用createFileVersion方法为回滚后的文件创建新版本记录
        $this->logger->info('Creating new version record after rollback using createFileVersion', [
            'file_id' => $fileId,
        ]);

        $newVersionEntity = $this->createFileVersion($fileEntity);

        if (! $newVersionEntity) {
            $this->logger->error('Failed to create version record after rollback', [
                'file_id' => $fileId,
                'target_version' => $targetVersion,
            ]);
            return null;
        }

        $this->logger->info('File rollback completed successfully', [
            'file_id' => $fileId,
            'target_version' => $targetVersion,
            'new_version' => $newVersionEntity->getVersion(),
            'new_version_id' => $newVersionEntity->getId(),
        ]);

        return $newVersionEntity;
    }

    /**
     * 获取文件的最新版本号.
     */
    public function getLatestVersionNumber(int $fileId): int
    {
        return $this->taskFileVersionRepository->getLatestVersionNumber($fileId);
    }

    /**
     * 获取下一个版本号.
     */
    private function getNextVersionNumber(int $fileId): int
    {
        $latestVersion = $this->taskFileVersionRepository->getLatestVersionNumber($fileId);
        return $latestVersion + 1;
    }

    /**
     * 生成版本文件键.
     */
    private function generateVersionFileKey(string $originalFileKey, int $version): string
    {
        // 验证原文件路径包含 /workspace/
        if (! str_contains($originalFileKey, '/workspace/')) {
            throw new InvalidArgumentException('Original file key must contain /workspace/ path');
        }

        // 只替换第一次出现的 /workspace/ 为 /version/
        $pos = strpos($originalFileKey, '/workspace/');
        if ($pos !== false) {
            $versionBasePath = substr_replace($originalFileKey, '/version/', $pos, strlen('/workspace/'));
        } else {
            // 理论上不会执行到这里，因为上面已经验证过
            throw new InvalidArgumentException('Original file key must contain /workspace/ path');
        }

        // 在文件名后追加版本号
        return $versionBasePath . '/' . $version;
    }

    /**
     * 清理旧版本，保留指定数量的最新版本.
     */
    private function cleanupOldVersions(int $fileId, int $maxVersions): int
    {
        try {
            // 1. 获取当前版本数量
            $currentCount = $this->taskFileVersionRepository->countByFileId($fileId);

            if ($currentCount <= $maxVersions) {
                return 0; // 不需要清理
            }

            $this->logger->info('Starting version cleanup', [
                'file_id' => $fileId,
                'current_count' => $currentCount,
                'max_versions' => $maxVersions,
                'to_delete' => $currentCount - $maxVersions,
            ]);

            // 2. 获取需要删除的版本实体列表
            $versionsToDelete = $this->taskFileVersionRepository->getVersionsToCleanup($fileId, $maxVersions);

            if (empty($versionsToDelete)) {
                return 0;
            }

            // 3. 先删除OSS文件
            $ossDeletedCount = 0;
            $ossFailedCount = 0;

            foreach ($versionsToDelete as $versionEntity) {
                $prefix = '/';

                $this->cloudFileRepository->deleteObjectByCredential(
                    $prefix,
                    $versionEntity->getOrganizationCode(),
                    $versionEntity->getFileKey(),
                    StorageBucketType::SandBox
                );

                ++$ossDeletedCount;

                $this->logger->debug('Version file deleted from OSS', [
                    'version_id' => $versionEntity->getId(),
                    'file_key' => $versionEntity->getFileKey(),
                ]);
            }

            // 4. 批量删除数据库记录（无论OSS删除是否成功）
            $dbDeletedCount = $this->taskFileVersionRepository->deleteOldVersionsByFileId($fileId, $maxVersions);

            $this->logger->info('Version cleanup completed', [
                'file_id' => $fileId,
                'target_delete_count' => count($versionsToDelete),
                'db_deleted_count' => $dbDeletedCount,
                'oss_deleted_count' => $ossDeletedCount,
                'oss_failed_count' => $ossFailedCount,
            ]);

            return $dbDeletedCount;
        } catch (Throwable $e) {
            $this->logger->error('Version cleanup failed', [
                'file_id' => $fileId,
                'max_versions' => $maxVersions,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function copyFile(string $organizationCode, string $sourceKey, string $destinationKey): void
    {
        // 从源文件路径中提取prefix（用于确定操作权限）
        $prefix = '/';

        // 使用已有的复制文件功能
        $this->cloudFileRepository->copyObjectByCredential(
            $prefix,
            $organizationCode,
            $sourceKey,
            $destinationKey,
            StorageBucketType::SandBox,
            [
                'metadata_directive' => 'COPY', // 复制原文件的元数据
            ]
        );

        $this->logger->info('File copied successfully', [
            'organization_code' => $organizationCode,
            'source_key' => $sourceKey,
            'destination_key' => $destinationKey,
            'prefix' => $prefix,
        ]);
    }
}
