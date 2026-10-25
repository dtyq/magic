<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Service;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\Common\Event\DeleteEventSource;
use App\Domain\SuperMagic\File\Entity\TaskFileCleanupRecordEntity;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileCleanupRecordRepositoryInterface;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

class TaskFileCleanupDomainService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly TaskFileCleanupRecordRepositoryInterface $cleanupRepository,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly TaskFileCleanupRecordService $cleanupRecordService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly CloudFileRepositoryInterface $cloudFileRepository,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /** @return array{claimed:int,success:int,failed:int} */
    public function processPendingRecords(int $limit = 50): array
    {
        $records = $this->cleanupRepository->claimPending($limit);
        $stats = ['claimed' => count($records), 'success' => 0, 'failed' => 0];

        foreach ($records as $record) {
            try {
                $root = $this->taskFileRepository->getByIdWithTrash($record->getOriginalFileId());
                if ($root === null) {
                    $this->cleanupRepository->markSuccess($record->getId());
                    ++$stats['success'];
                    continue;
                }

                $success = $root->getIsDirectory()
                    ? $this->processDirectory($root, $record, $this->buildStorageContext($root))
                    : $this->processEntity($root, $record, $this->buildStorageContext($root));

                if ($success) {
                    $this->cleanupRepository->markSuccess($record->getId());
                    ++$stats['success'];
                } else {
                    $this->cleanupRepository->markFailed($record->getId(), 'One or more descendants failed');
                    ++$stats['failed'];
                }
            } catch (Throwable $e) {
                $this->cleanupRepository->markFailed($record->getId(), $e->getMessage());
                ++$stats['failed'];
                $this->logger->error('Task file cleanup failed', [
                    'record_id' => $record->getId(),
                    'operation_id' => $record->getDeletionOperationId(),
                    'file_id' => $record->getOriginalFileId(),
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $stats;
    }

    /** @param array{organization_code:string, work_dir:string, full_work_dir:string, prefix:string} $storageContext */
    private function processDirectory(
        TaskFileEntity $root,
        TaskFileCleanupRecordEntity $rootRecord,
        array $storageContext
    ): bool {
        $success = true;
        $parentIds = [$root->getFileId()];

        while ($parentIds !== []) {
            $children = [];
            $offset = 0;
            do {
                $page = $this->taskFileRepository->getChildrenByParentIdsAndProjectWithTrash(
                    $root->getProjectId(),
                    $parentIds,
                    200,
                    $offset
                );
                $children = array_merge($children, $page);
                $offset += count($page);
            } while (count($page) === 200);

            if ($children === []) {
                break;
            }

            $nextParentIds = [];
            foreach ($children as $child) {
                $childRecord = $this->getOrCreateChildRecord($child, $rootRecord);
                if ($childRecord->getStatus() === 'success') {
                    if ($child->getIsDirectory()) {
                        $nextParentIds[] = $child->getFileId();
                    }
                    continue;
                }

                try {
                    if (! $this->processEntity($child, $childRecord, $storageContext)) {
                        $success = false;
                    } else {
                        $this->cleanupRepository->markSuccess($childRecord->getId());
                    }
                } catch (Throwable $e) {
                    $success = false;
                    $this->cleanupRepository->markFailed($childRecord->getId(), $e->getMessage());
                    $this->logger->error('Task file child cleanup failed', [
                        'record_id' => $childRecord->getId(),
                        'file_id' => $child->getFileId(),
                        'root_file_id' => $root->getFileId(),
                        'error' => $e->getMessage(),
                    ]);
                }

                if ($child->getIsDirectory()) {
                    $nextParentIds[] = $child->getFileId();
                }
            }

            $parentIds = array_values(array_unique($nextParentIds));
        }

        if ($success) {
            $this->taskFileRepository->deleteById($root->getFileId(), true);
        }

        return $success;
    }

    /** @param array{organization_code:string, work_dir:string, full_work_dir:string, prefix:string} $storageContext */
    private function processEntity(
        TaskFileEntity $entity,
        TaskFileCleanupRecordEntity $record,
        array $storageContext
    ): bool {
        if (! $entity->getIsDirectory() && $entity->getFileKey() !== '') {
            $this->deleteStorageObject($entity, $storageContext);
        }

        $this->taskFileRepository->deleteById($entity->getFileId(), true);
        return true;
    }

    /** @param array{organization_code:string, work_dir:string, full_work_dir:string, prefix:string} $storageContext */
    private function deleteStorageObject(TaskFileEntity $entity, array $storageContext): void
    {
        if (! WorkDirectoryUtil::checkEffectiveFileKey($storageContext['full_work_dir'], $entity->getFileKey())) {
            throw new RuntimeException('File key is outside workdir: ' . $entity->getFileId());
        }

        $this->cloudFileRepository->deleteObjectByCredential(
            $storageContext['prefix'],
            $storageContext['organization_code'],
            $entity->getFileKey(),
            StorageBucketType::SandBox
        );
    }

    /** @return array{organization_code:string, work_dir:string, full_work_dir:string, prefix:string} */
    private function buildStorageContext(TaskFileEntity $root): array
    {
        if ($root->getOrganizationCode() === '') {
            throw new RuntimeException('Organization code is missing: ' . $root->getFileId());
        }

        $project = $root->getProjectId() > 0
            ? $this->projectDomainService->getProjectNotUserId($root->getProjectId())
            : null;
        if ($root->getProjectId() > 0 && $project === null) {
            throw new RuntimeException('Project not found: ' . $root->getProjectId());
        }

        $workDir = $project?->getWorkDir() ?? WorkDirectoryUtil::getUserWorkDir($root->getUserId());
        $fullPrefix = $this->cloudFileRepository->getFullPrefix($root->getOrganizationCode());

        return [
            'organization_code' => $root->getOrganizationCode(),
            'work_dir' => $workDir,
            'full_work_dir' => WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir),
            'prefix' => WorkDirectoryUtil::getPrefix($workDir),
        ];
    }

    private function getOrCreateChildRecord(
        TaskFileEntity $child,
        TaskFileCleanupRecordEntity $rootRecord
    ): TaskFileCleanupRecordEntity {
        $existing = $this->cleanupRepository->findByOperationAndFile(
            $rootRecord->getDeletionOperationId(),
            $child->getFileId()
        );
        if ($existing !== null) {
            return $existing;
        }

        $this->cleanupRecordService->enqueueChild(
            $child,
            $rootRecord->getDeletionOperationId(),
            $rootRecord->getRootFileId(),
            DeleteEventSource::from($rootRecord->getDeleteSource()),
            $rootRecord->getDeleteReason(),
            $rootRecord->getDeletedBy()
        );

        return $this->cleanupRepository->findByOperationAndFile(
            $rootRecord->getDeletionOperationId(),
            $child->getFileId()
        ) ?? throw new RuntimeException('Cleanup child record was not created');
    }
}
