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
    public function createFileVersion(TaskFileEntity $fileEntity): ?TaskFileVersionEntity
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
        $this->copyFileToVersionPath(
            $fileEntity->getOrganizationCode(),
            $fileEntity->getFileKey(),
            $versionFileKey
        );

        // 4. 创建版本记录
        $versionEntity = new TaskFileVersionEntity();
        $versionEntity->setId(IdGenerator::getSnowId());
        $versionEntity->setFileId($fileEntity->getFileId());
        $versionEntity->setOrganizationCode($fileEntity->getOrganizationCode());
        $versionEntity->setFileKey($versionFileKey);
        $versionEntity->setVersion($nextVersion);

        $savedEntity = $this->taskFileVersionRepository->insert($versionEntity);

        // 5. 清理旧版本
        $maxVersions = (int) config('super-magic.file_version.max_versions', 10);
        $this->cleanupOldVersions($fileEntity->getFileId(), $maxVersions);

        $this->logger->info('File version created successfully', [
            'file_id' => $fileEntity->getFileId(),
            'version' => $nextVersion,
            'version_file_key' => $versionFileKey,
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

        // 将 /workspace/ 替换为 /version/
        $versionBasePath = str_replace('/workspace/', '/version/', $originalFileKey);

        // 在文件名后追加版本号
        return $versionBasePath . '/' . $version;
    }

    /**
     * 复制文件到版本路径.
     */
    private function copyFileToVersionPath(string $organizationCode, string $sourceKey, string $destinationKey): void
    {
        try {
            // 从源文件路径中提取prefix（用于确定操作权限）
            $prefix = $this->extractPrefixFromFileKey($sourceKey);

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

            $this->logger->info('File copied to version path successfully', [
                'organization_code' => $organizationCode,
                'source_key' => $sourceKey,
                'destination_key' => $destinationKey,
                'prefix' => $prefix,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to copy file to version path', [
                'organization_code' => $organizationCode,
                'source_key' => $sourceKey,
                'destination_key' => $destinationKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
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
                try {
                    $prefix = $this->extractPrefixFromFileKey($versionEntity->getFileKey());

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
                } catch (Throwable $e) {
                    ++$ossFailedCount;
                    $this->logger->warning('Failed to delete version file from OSS', [
                        'version_id' => $versionEntity->getId(),
                        'file_key' => $versionEntity->getFileKey(),
                        'error' => $e->getMessage(),
                    ]);
                    // OSS删除失败不阻塞数据库清理
                }
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

    /**
     * 从文件键中提取prefix.
     */
    private function extractPrefixFromFileKey(string $fileKey): string
    {
        // 提取组织路径作为prefix
        // 例如从 "DT001/588417216353927169/project_821348087617409025/version/a/file10.txt/1"
        // 提取出 "DT001/588417216353927169/project_821348087617409025/"

        if (str_contains($fileKey, '/version/')) {
            $parts = explode('/version/', $fileKey);
            return $parts[0] . '/';
        }

        if (str_contains($fileKey, '/workspace/')) {
            $parts = explode('/workspace/', $fileKey);
            return $parts[0] . '/';
        }

        throw new InvalidArgumentException('Unable to extract prefix from file key: ' . $fileKey);
    }

    /**
     * 验证版本文件路径的合法性.
     */
    private function validateVersionPath(string $versionFileKey, string $organizationCode): bool
    {
        // 检查路径是否属于指定的组织
        if (! str_starts_with($versionFileKey, $organizationCode)) {
            return false;
        }

        // 检查路径是否包含 /version/
        if (! str_contains($versionFileKey, '/version/')) {
            return false;
        }

        return true;
    }
}
