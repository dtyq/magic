<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository;

use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

interface VideoQueueOperationRepositoryInterface
{
    public function getOperation(string $operationId): ?VideoQueueOperationEntity;

    public function getOperations(array $operationIds): array;

    public function saveOperation(VideoQueueOperationEntity $operation, int $ttlSeconds): void;

    public function deleteOperation(string $operationId): void;

    public function addActiveOperation(VideoQueueOperationEntity $operation): void;

    public function removeActiveOperation(VideoQueueOperationEntity $operation): void;
}
