<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\File\Service;

use App\Domain\File\Entity\FileCleanupRecordEntity;
use App\Domain\File\Repository\FileCleanupRecordRepository;
use App\Domain\File\Service\FileCleanupDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 文件清理应用服务.
 */
class FileCleanupAppService extends AbstractAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly FileCleanupDomainService $domainService,
        private readonly FileCleanupRecordRepository $repository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('FileCleanupApp');
    }

    /**
     * 注册文件清理.
     *
     * @param string $organizationCode 组织编码
     * @param string $fileKey 文件存储key
     * @param string $fileName 文件名称
     * @param int $fileSize 文件大小
     * @param string $sourceType 来源类型
     * @param null|string $sourceId 来源ID
     * @param int $expireAfterSeconds 过期时间(秒)
     * @param string $bucketType 存储桶类型
     * @return bool 注册是否成功
     */
    public function registerFileForCleanup(
        string $organizationCode,
        string $fileKey,
        string $fileName,
        int $fileSize,
        string $sourceType,
        ?string $sourceId = null,
        int $expireAfterSeconds = 7200,
        string $bucketType = 'private'
    ): bool {
        try {
            // 参数验证
            if (empty($organizationCode) || empty($fileKey) || empty($fileName) || empty($sourceType)) {
                $this->logger->error('注册文件清理参数不完整', [
                    'organization_code' => $organizationCode,
                    'file_key' => $fileKey,
                    'file_name' => $fileName,
                    'source_type' => $sourceType,
                ]);
                return false;
            }

            if ($expireAfterSeconds <= 0) {
                $this->logger->error('过期时间必须大于0', ['expire_after_seconds' => $expireAfterSeconds]);
                return false;
            }

            // 检查是否已存在相同记录
            $existingRecord = $this->repository->findByFileKey($fileKey, $organizationCode);
            if ($existingRecord && $existingRecord->isPending()) {
                $this->logger->warning('文件清理记录已存在', [
                    'file_key' => $fileKey,
                    'organization_code' => $organizationCode,
                    'existing_id' => $existingRecord->getId(),
                ]);
                return true; // 已存在待清理记录，直接返回成功
            }

            // 创建实体
            $entity = new FileCleanupRecordEntity();
            $entity->setOrganizationCode($organizationCode);
            $entity->setFileKey($fileKey);
            $entity->setFileName($fileName);
            $entity->setFileSize($fileSize);
            $entity->setBucketType($bucketType);
            $entity->setSourceType($sourceType);
            $entity->setSourceId($sourceId);
            $entity->setExpireAt(date('Y-m-d H:i:s', time() + $expireAfterSeconds));
            $entity->setStatus(0); // 待清理
            $entity->setRetryCount(0);
            $entity->setErrorMessage(null);

            // 保存到数据库
            $this->repository->create($entity);

            $this->logger->info('文件清理注册成功', [
                'id' => $entity->getId(),
                'organization_code' => $organizationCode,
                'file_key' => $fileKey,
                'file_name' => $fileName,
                'source_type' => $sourceType,
                'expire_at' => $entity->getExpireAt(),
            ]);

            return true;
        } catch (Throwable $e) {
            $this->logger->error('注册文件清理失败', [
                'organization_code' => $organizationCode,
                'file_key' => $fileKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return false;
        }
    }

    /**
     * 批量注册文件清理.
     *
     * @param array $files 文件信息数组
     * @return array 注册结果
     */
    public function registerFilesForCleanup(array $files): array
    {
        $results = [
            'total' => count($files),
            'success' => 0,
            'failed' => 0,
            'failed_files' => [],
        ];

        foreach ($files as $file) {
            $success = $this->registerFileForCleanup(
                $file['organization_code'],
                $file['file_key'],
                $file['file_name'],
                $file['file_size'],
                $file['source_type'],
                $file['source_id'] ?? null,
                $file['expire_after_seconds'] ?? 7200,
                $file['bucket_type'] ?? 'private'
            );

            if ($success) {
                ++$results['success'];
            } else {
                ++$results['failed'];
                $results['failed_files'][] = $file['file_key'];
            }
        }

        $this->logger->info('批量注册文件清理完成', $results);
        return $results;
    }

    /**
     * 取消文件清理.
     *
     * @param string $fileKey 文件key
     * @param string $organizationCode 组织编码
     * @return bool 取消是否成功
     */
    public function cancelCleanup(string $fileKey, string $organizationCode): bool
    {
        try {
            if (empty($fileKey) || empty($organizationCode)) {
                $this->logger->error('取消清理参数不完整', [
                    'file_key' => $fileKey,
                    'organization_code' => $organizationCode,
                ]);
                return false;
            }

            return $this->domainService->cancelCleanup($fileKey, $organizationCode);
        } catch (Throwable $e) {
            $this->logger->error('取消文件清理失败', [
                'file_key' => $fileKey,
                'organization_code' => $organizationCode,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * 手动清理文件.
     *
     * @param int $recordId 记录ID
     * @return bool 清理是否成功
     */
    public function forceCleanup(int $recordId): bool
    {
        try {
            if ($recordId <= 0) {
                $this->logger->error('无效的记录ID', ['record_id' => $recordId]);
                return false;
            }

            return $this->domainService->forceCleanupFile($recordId);
        } catch (Throwable $e) {
            $this->logger->error('手动清理文件失败', [
                'record_id' => $recordId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * 获取清理统计信息.
     *
     * @param null|string $sourceType 来源类型过滤
     * @return array 统计信息
     */
    public function getCleanupStats(?string $sourceType = null): array
    {
        try {
            return $this->domainService->getCleanupStats($sourceType);
        } catch (Throwable $e) {
            $this->logger->error('获取清理统计失败', [
                'source_type' => $sourceType,
                'error' => $e->getMessage(),
            ]);
            return [
                'pending' => 0,
                'cleaned' => 0,
                'failed' => 0,
                'expired' => 0,
                'total' => 0,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * 获取文件清理记录详情.
     *
     * @param int $recordId 记录ID
     * @return null|array 记录详情
     */
    public function getCleanupRecord(int $recordId): ?array
    {
        try {
            $record = $this->repository->findById($recordId);
            if (! $record) {
                return null;
            }

            return [
                'id' => $record->getId(),
                'organization_code' => $record->getOrganizationCode(),
                'file_key' => $record->getFileKey(),
                'file_name' => $record->getFileName(),
                'file_size' => $record->getFileSize(),
                'bucket_type' => $record->getBucketType(),
                'source_type' => $record->getSourceType(),
                'source_id' => $record->getSourceId(),
                'expire_at' => $record->getExpireAt(),
                'status' => $record->getStatus(),
                'status_text' => $this->getStatusText($record->getStatus()),
                'retry_count' => $record->getRetryCount(),
                'error_message' => $record->getErrorMessage(),
                'created_at' => $record->getCreatedAt(),
                'updated_at' => $record->getUpdatedAt(),
                'is_expired' => $record->isExpired(),
            ];
        } catch (Throwable $e) {
            $this->logger->error('获取清理记录失败', [
                'record_id' => $recordId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * 执行系统维护清理.
     *
     * @param int $successDaysToKeep 成功记录保留天数
     * @param int $failedDaysToKeep 失败记录保留天数
     * @param int $maxRetries 最大重试次数
     * @return array 维护结果
     */
    public function maintenance(int $successDaysToKeep = 7, int $failedDaysToKeep = 7, int $maxRetries = 3): array
    {
        try {
            return $this->domainService->maintenance($successDaysToKeep, $failedDaysToKeep, $maxRetries);
        } catch (Throwable $e) {
            $this->logger->error('系统维护失败', [
                'error' => $e->getMessage(),
            ]);
            return [
                'success_records_cleaned' => 0,
                'failed_records_cleaned' => 0,
                'total_cleaned' => 0,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * 获取状态文本描述.
     */
    private function getStatusText(int $status): string
    {
        return match ($status) {
            0 => '待清理',
            1 => '已清理',
            2 => '清理失败',
            default => '未知状态',
        };
    }
}
