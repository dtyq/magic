<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository;

interface QueueCoreRepositoryInterface
{
    public function getEnqueueState(string $endpoint, string $userId): array;

    public function nextSeq(): int;

    public function enqueue(string $endpoint, string $userId, string $operationId, int $seq, bool $addToReady): void;

    public function buildQueueSnapshot(string $endpoint, string $userId, int $seq, bool $isDone, bool $isQueued): array;

    public function cancelQueued(string $endpoint, string $userId, string $operationId): ?string;

    public function getReadyOperationIds(string $endpoint, int $maxConcurrency): array;

    public function markOperationsRunning(string $endpoint, array $operationIds): void;

    public function finishOperation(string $endpoint, string $userId, string $operationId): ?string;

    public function addReadyOperation(string $endpoint, string $operationId, int $seq): void;

    public function blockPopSignal(int $timeoutSeconds): ?string;

    public function pushSignal(string $endpoint): void;
}
