<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Repository\Facade;

use App\Domain\SuperMagic\File\Entity\TaskFileCleanupRecordEntity;

interface TaskFileCleanupRecordRepositoryInterface
{
    /** @param TaskFileCleanupRecordEntity[] $entities */
    public function batchInsert(array $entities): void;

    /** @return TaskFileCleanupRecordEntity[] */
    public function claimPending(int $limit, int $leaseSeconds = 600): array;

    public function markSuccess(int $id): void;

    public function markFailed(int $id, string $errorMessage): void;

    public function incrementAttempt(int $id): void;

    public function findByOperationAndFile(string $operationId, int $fileId): ?TaskFileCleanupRecordEntity;
}
