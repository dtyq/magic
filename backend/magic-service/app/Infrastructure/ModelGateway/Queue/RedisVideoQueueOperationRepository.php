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

    /**
     * 使用 Redis 原子占位，记录组织用户当前运行中的视频任务 ID 列表。
     */
    public function claimUserActiveOperation(VideoQueueOperationEntity $operation, int $limit, int $ttlSeconds): bool
    {
        return $this->claimActiveOperation(
            QueueCoreRedisKeys::userActiveOperations($operation->getOrganizationCode(), $operation->getUserId()),
            $operation,
            $limit,
            $ttlSeconds,
        );
    }

    /**
     * 根据组织用户运行槽位中保存的任务 ID 列表读取任务实体。
     *
     * @return array<int, VideoQueueOperationEntity>
     */
    public function getUserActiveOperations(string $organizationCode, string $userId): array
    {
        return $this->getActiveOperations(QueueCoreRedisKeys::userActiveOperations($organizationCode, $userId));
    }

    /**
     * 比较任务 ID 后删除 Redis key，释放当前任务持有的运行槽位。
     */
    public function releaseUserActiveOperation(VideoQueueOperationEntity $operation): void
    {
        $this->redis->zRem(
            QueueCoreRedisKeys::userActiveOperations($operation->getOrganizationCode(), $operation->getUserId()),
            $operation->getId(),
        );
    }

    /**
     * 使用 Redis 原子占位，记录组织当前运行中的视频任务 ID 列表。
     */
    public function claimOrganizationActiveOperation(VideoQueueOperationEntity $operation, int $limit, int $ttlSeconds): bool
    {
        return $this->claimActiveOperation(
            QueueCoreRedisKeys::organizationActiveOperations($operation->getOrganizationCode()),
            $operation,
            $limit,
            $ttlSeconds,
        );
    }

    /**
     * 根据组织运行槽位中保存的任务 ID 列表读取任务实体。
     *
     * @return array<int, VideoQueueOperationEntity>
     */
    public function getOrganizationActiveOperations(string $organizationCode): array
    {
        return $this->getActiveOperations(QueueCoreRedisKeys::organizationActiveOperations($organizationCode));
    }

    /**
     * 释放当前任务持有的组织级运行槽位。
     */
    public function releaseOrganizationActiveOperation(VideoQueueOperationEntity $operation): void
    {
        $this->redis->zRem(
            QueueCoreRedisKeys::organizationActiveOperations($operation->getOrganizationCode()),
            $operation->getId(),
        );
    }

    /**
     * 按指定 Redis zset key 原子占用运行槽位，达到上限时返回 false。
     */
    private function claimActiveOperation(
        string $key,
        VideoQueueOperationEntity $operation,
        int $limit,
        int $ttlSeconds
    ): bool {
        if ($limit <= 0) {
            return true;
        }

        // 这段逻辑必须用 Lua 保持原子性，避免并发请求同时读到未达上限后一起写入导致超额。
        // KEYS[1] 是个人或组织运行槽位 zset；ARGV[1] 任务 ID；ARGV[2] 并发上限；
        // ARGV[3] 槽位 TTL；ARGV[4] 当前时间戳，作为 zset score 用于清理过期成员。
        $lua = <<<'LUA'
        -- 先删除超过 TTL 的旧成员，防止旧任务 ID 因为 key 续期而长期占用并发名额。
        redis.call("zremrangebyscore", KEYS[1], "-inf", tonumber(ARGV[4]) - tonumber(ARGV[3]))
        -- 当前任务已占位时直接刷新 key TTL 并返回成功，保证重复调用是幂等的。
        if redis.call("zscore", KEYS[1], ARGV[1]) then
            redis.call("expire", KEYS[1], ARGV[3])
            return 1
        end
        -- 清理后仍达到并发上限时拒绝占位。
        if redis.call("zcard", KEYS[1]) >= tonumber(ARGV[2]) then
            return 0
        end
        -- 未达到上限时写入当前任务 ID，并刷新 key TTL。
        redis.call("zadd", KEYS[1], ARGV[4], ARGV[1])
        redis.call("expire", KEYS[1], ARGV[3])
        return 1
        LUA;

        return (bool) $this->redis->eval(
            $lua,
            [
                $key,
                $operation->getId(),
                (string) $limit,
                (string) $ttlSeconds,
                (string) time(),
            ],
            1
        );
    }

    /**
     * 读取指定运行槽位 key 内的任务实体列表。
     *
     * @return array<int, VideoQueueOperationEntity>
     */
    private function getActiveOperations(string $key): array
    {
        $operationIds = $this->redis->zRange($key, 0, -1);
        if (! is_array($operationIds) || $operationIds === []) {
            return [];
        }

        $operationIds = array_values(array_map('strval', $operationIds));
        $operations = $this->getOperations($operationIds);
        return $this->filterActiveOperationsAndPruneInactive($key, $operationIds, $operations);
    }

    /**
     * 过滤仍在运行的任务，并清理 hash 缺失或已结束的槽位成员。
     *
     * @param list<string> $operationIds
     * @param array<int, VideoQueueOperationEntity> $operations
     * @return array<int, VideoQueueOperationEntity>
     */
    private function filterActiveOperationsAndPruneInactive(string $key, array $operationIds, array $operations): array
    {
        $existingOperationIds = [];
        $activeOperations = [];
        $finishedOperationIds = [];
        foreach ($operations as $operation) {
            $existingOperationIds[$operation->getId()] = true;
            if ($operation->getStatus()->isDone()) {
                $finishedOperationIds[] = $operation->getId();
                continue;
            }

            $activeOperations[] = $operation;
        }

        $missingOperationIds = array_values(array_filter(
            $operationIds,
            static fn (string $operationId): bool => ! isset($existingOperationIds[$operationId])
        ));
        $prunableOperationIds = array_values(array_unique([...$missingOperationIds, ...$finishedOperationIds]));
        if ($prunableOperationIds !== []) {
            // operation 不存在或已进入终态时同步清理运行槽位，避免“任务列表为空但并发已满”的残留占位。
            $this->redis->zRem($key, ...$prunableOperationIds);
        }

        return $activeOperations;
    }
}
