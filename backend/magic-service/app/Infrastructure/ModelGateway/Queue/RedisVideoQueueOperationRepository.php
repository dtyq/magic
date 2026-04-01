<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ModelGateway\Queue;

use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\ModelGateway\Repository\VideoQueueOperationRepositoryInterface;
use Hyperf\Redis\Redis;

readonly class RedisVideoQueueOperationRepository implements VideoQueueOperationRepositoryInterface
{
    public function __construct(
        private Redis $redis,
    ) {
    }

    public function getOperation(string $operationId): ?VideoQueueOperationEntity
    {
        $data = $this->redis->hGetAll(QueueCoreRedisKeys::operation($operationId));
        if (empty($data)) {
            return null;
        }

        return VideoQueueOperationEntity::fromStorageArray($data);
    }

    public function getOperations(array $operationIds): array
    {
        if ($operationIds === []) {
            return [];
        }

        $pipeline = $this->redis->pipeline();
        foreach ($operationIds as $operationId) {
            $pipeline->hGetAll(QueueCoreRedisKeys::operation((string) $operationId));
        }
        $rawOperations = $pipeline->exec();

        $operations = [];
        foreach ($rawOperations as $rawOperation) {
            if (! is_array($rawOperation) || $rawOperation === []) {
                continue;
            }
            $operations[] = VideoQueueOperationEntity::fromStorageArray($rawOperation);
        }

        return $operations;
    }

    public function saveOperation(VideoQueueOperationEntity $operation, int $ttlSeconds): void
    {
        $pipeline = $this->redis->pipeline();
        $pipeline->hMSet(QueueCoreRedisKeys::operation($operation->getId()), $operation->toStorageArray());
        $pipeline->expire(QueueCoreRedisKeys::operation($operation->getId()), $ttlSeconds);
        $pipeline->exec();
    }

    public function deleteOperation(string $operationId): void
    {
        $this->redis->del(QueueCoreRedisKeys::operation($operationId));
    }

    public function addActiveOperation(VideoQueueOperationEntity $operation): void
    {
        $this->redis->zAdd(
            QueueCoreRedisKeys::userActive($operation->getEndpoint(), $operation->getUserId()),
            $operation->getSeq(),
            $operation->getId(),
        );
    }

    public function removeActiveOperation(VideoQueueOperationEntity $operation): void
    {
        $this->redis->zRem(
            QueueCoreRedisKeys::userActive($operation->getEndpoint(), $operation->getUserId()),
            $operation->getId(),
        );
    }
}
