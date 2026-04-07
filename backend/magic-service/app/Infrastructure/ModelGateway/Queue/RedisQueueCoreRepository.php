<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ModelGateway\Queue;

use App\Domain\ModelGateway\Repository\QueueCoreRepositoryInterface;
use Hyperf\Redis\Redis;

readonly class RedisQueueCoreRepository implements QueueCoreRepositoryInterface
{
    // TODO: 这套 Redis 队列仍有已知问题待修复：
    // 1. running zset 没有僵尸任务扫描/恢复，worker 崩溃后会长期占住槽位
    // 2. heartbeat 只写不消费，没有真正用于并发槽位回收
    // 3. 缺少进程重启后的 running/waiting 一致性修复
    // 即使修复了，视频生成也不执行限流逻辑，以后再说。
    public function __construct(
        private Redis $redis,
    ) {
    }

    public function getEnqueueState(string $endpoint, string $userId): array
    {
        $pipeline = $this->redis->pipeline();
        $pipeline->hGet(QueueCoreRedisKeys::userPending($endpoint), $userId);
        $pipeline->zCard(QueueCoreRedisKeys::waitingAll($endpoint));
        $pipeline->zCard(QueueCoreRedisKeys::running($endpoint));
        $pipeline->zRange(QueueCoreRedisKeys::userQueue($endpoint, $userId), 0, 0);
        $results = $pipeline->exec();

        return [
            'user_pending' => (int) ($results[0] ?? 0),
            'waiting_count' => (int) ($results[1] ?? 0),
            'running_count' => (int) ($results[2] ?? 0),
            'user_head_id' => $results[3][0] ?? null,
        ];
    }

    public function nextSeq(): int
    {
        return (int) $this->redis->incr(QueueCoreRedisKeys::seq());
    }

    public function enqueue(string $endpoint, string $userId, string $operationId, int $seq, bool $addToReady): void
    {
        $pipeline = $this->redis->pipeline();
        $pipeline->zAdd(QueueCoreRedisKeys::userQueue($endpoint, $userId), $seq, $operationId);
        $pipeline->zAdd(QueueCoreRedisKeys::waitingAll($endpoint), $seq, $operationId);
        $pipeline->hIncrBy(QueueCoreRedisKeys::userPending($endpoint), $userId, 1);
        if ($addToReady) {
            $pipeline->zAdd(QueueCoreRedisKeys::ready($endpoint), $seq, $operationId);
        }
        $pipeline->lPush(QueueCoreRedisKeys::signalList(), $endpoint);
        $pipeline->exec();
    }

    public function buildQueueSnapshot(string $endpoint, string $userId, int $seq, bool $isDone, bool $isQueued): array
    {
        if ($isDone) {
            return [
                'same_user_ahead_count' => 0,
                'endpoint_ready_ahead_count' => 0,
                'endpoint_total_ahead_count' => 0,
                'queue_position' => null,
                'running_count' => (int) $this->redis->zCard(QueueCoreRedisKeys::running($endpoint)),
            ];
        }

        $maxScore = $seq > 0 ? '(' . $seq : '-inf';
        $pipeline = $this->redis->pipeline();
        $pipeline->zCount(QueueCoreRedisKeys::userQueue($endpoint, $userId), '-inf', $maxScore);
        $pipeline->zCount(QueueCoreRedisKeys::ready($endpoint), '-inf', $maxScore);
        $pipeline->zCount(QueueCoreRedisKeys::waitingAll($endpoint), '-inf', $maxScore);
        $pipeline->zCard(QueueCoreRedisKeys::running($endpoint));
        $results = $pipeline->exec();

        $totalAheadCount = (int) ($results[2] ?? 0);

        return [
            'same_user_ahead_count' => (int) ($results[0] ?? 0),
            'endpoint_ready_ahead_count' => (int) ($results[1] ?? 0),
            'endpoint_total_ahead_count' => $totalAheadCount,
            'queue_position' => $isQueued ? $totalAheadCount + 1 : null,
            'running_count' => (int) ($results[3] ?? 0),
        ];
    }

    public function cancelQueued(string $endpoint, string $userId, string $operationId): ?string
    {
        $userQueueKey = QueueCoreRedisKeys::userQueue($endpoint, $userId);
        $headBefore = $this->redis->zRange($userQueueKey, 0, 0)[0] ?? null;

        $pipeline = $this->redis->pipeline();
        $pipeline->zRem($userQueueKey, $operationId);
        $pipeline->zRem(QueueCoreRedisKeys::waitingAll($endpoint), $operationId);
        $pipeline->zRem(QueueCoreRedisKeys::ready($endpoint), $operationId);
        $pipeline->hIncrBy(QueueCoreRedisKeys::userPending($endpoint), $userId, -1);
        $pipeline->exec();

        if ($headBefore !== $operationId) {
            return null;
        }

        $nextHeadId = $this->redis->zRange($userQueueKey, 0, 0)[0] ?? null;
        return is_string($nextHeadId) && $nextHeadId !== '' ? $nextHeadId : null;
    }

    public function getReadyOperationIds(string $endpoint, int $maxConcurrency): array
    {
        if ($maxConcurrency <= 0) {
            return [];
        }

        $runningCount = (int) $this->redis->zCard(QueueCoreRedisKeys::running($endpoint));
        $slots = $maxConcurrency - $runningCount;
        if ($slots <= 0) {
            return [];
        }

        return array_values(array_map('strval', $this->redis->zRange(QueueCoreRedisKeys::ready($endpoint), 0, $slots - 1)));
    }

    public function markOperationsRunning(string $endpoint, array $operationIds): void
    {
        if ($operationIds === []) {
            return;
        }

        $pipeline = $this->redis->pipeline();
        foreach ($operationIds as $operationId) {
            $pipeline->zRem(QueueCoreRedisKeys::ready($endpoint), $operationId);
            $pipeline->zRem(QueueCoreRedisKeys::waitingAll($endpoint), $operationId);
            $pipeline->zAdd(QueueCoreRedisKeys::running($endpoint), time(), $operationId);
        }
        $pipeline->exec();
    }

    public function finishOperation(string $endpoint, string $userId, string $operationId): ?string
    {
        $userQueueKey = QueueCoreRedisKeys::userQueue($endpoint, $userId);

        $pipeline = $this->redis->pipeline();
        $pipeline->zRem(QueueCoreRedisKeys::running($endpoint), $operationId);
        $pipeline->zRem($userQueueKey, $operationId);
        $pipeline->hIncrBy(QueueCoreRedisKeys::userPending($endpoint), $userId, -1);
        $pipeline->exec();

        $nextHeadId = $this->redis->zRange($userQueueKey, 0, 0)[0] ?? null;
        return is_string($nextHeadId) && $nextHeadId !== '' ? $nextHeadId : null;
    }

    public function addReadyOperation(string $endpoint, string $operationId, int $seq): void
    {
        $this->redis->zAdd(QueueCoreRedisKeys::ready($endpoint), $seq, $operationId);
    }

    public function blockPopSignal(int $timeoutSeconds): ?string
    {
        $result = $this->redis->brPop([QueueCoreRedisKeys::signalList()], $timeoutSeconds);
        if (! is_array($result) || ! isset($result[1]) || $result[1] === '') {
            return null;
        }

        return (string) $result[1];
    }

    public function pushSignal(string $endpoint): void
    {
        $this->redis->lPush(QueueCoreRedisKeys::signalList(), $endpoint);
    }
}
