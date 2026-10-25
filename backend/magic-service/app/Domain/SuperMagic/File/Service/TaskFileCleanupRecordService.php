<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Service;

use App\Domain\SuperMagic\Common\Event\DeleteEventSource;
use App\Domain\SuperMagic\File\Entity\TaskFileCleanupRecordEntity;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Enum\FileDeletionPolicy;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileCleanupRecordRepositoryInterface;

class TaskFileCleanupRecordService
{
    public function __construct(private readonly TaskFileCleanupRecordRepositoryInterface $repository)
    {
    }

    /** @param TaskFileEntity[] $entities */
    public function insertSnapshots(
        array $entities,
        string $operationId,
        FileDeletionPolicy $policy,
        DeleteEventSource $source,
        string $reason,
        string $deletedBy
    ): void {
        $records = [];
        foreach ($entities as $entity) {
            $records[] = TaskFileCleanupRecordEntity::fromTaskFile(
                $entity,
                $operationId,
                $policy,
                $source,
                $reason,
                $deletedBy
            );
        }
        $this->repository->batchInsert($records);
    }

    public function enqueue(
        TaskFileEntity $entity,
        string $operationId,
        DeleteEventSource $source,
        string $reason,
        string $deletedBy
    ): void {
        $record = TaskFileCleanupRecordEntity::fromTaskFile(
            $entity,
            $operationId,
            FileDeletionPolicy::PhysicalDelete,
            $source,
            $reason,
            $deletedBy,
            'root',
            $entity->getFileId()
        );
        $this->repository->batchInsert([$record]);
    }

    public function enqueueChild(
        TaskFileEntity $entity,
        string $operationId,
        int $rootFileId,
        DeleteEventSource $source,
        string $reason,
        string $deletedBy
    ): void {
        $record = TaskFileCleanupRecordEntity::fromTaskFile(
            $entity,
            $operationId,
            FileDeletionPolicy::PhysicalDelete,
            $source,
            $reason,
            $deletedBy,
            'child',
            $rootFileId
        );
        $this->repository->batchInsert([$record]);
    }
}
