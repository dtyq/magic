<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asr\Service;

use App\Domain\Asr\Constants\AsrRedisKeys;
use App\Domain\Asr\Repository\AsrTaskRepository;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;
use Hyperf\Redis\Redis;

/**
 * ASR 任务领域服务
 * 负责 ASR 任务状态的业务逻辑.
 */
readonly class AsrTaskDomainService
{
    public function __construct(
        private AsrTaskRepository $asrTaskRepository,
        private Redis $redis
    ) {
    }

    /**
     * 保存任务状态.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态 DTO
     * @param int $ttl 过期时间（秒），默认 7 天
     */
    public function saveTaskStatus(AsrTaskStatusDTO $taskStatus, int $ttl = 604800): void
    {
        $this->asrTaskRepository->save($taskStatus, $ttl);
    }

    /**
     * 根据任务键和用户ID查询任务状态.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     * @return null|AsrTaskStatusDTO 任务状态 DTO，不存在时返回 null
     */
    public function findTaskByKey(string $taskKey, string $userId): ?AsrTaskStatusDTO
    {
        return $this->asrTaskRepository->findByTaskKey($taskKey, $userId);
    }

    /**
     * 删除心跳 Key.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     */
    public function deleteTaskHeartbeat(string $taskKey, string $userId): void
    {
        $this->asrTaskRepository->deleteHeartbeat($taskKey, $userId);
    }

    /**
     * 原子操作：保存任务状态并设置心跳
     * 使用 Redis MULTI/EXEC 确保原子性.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态 DTO
     * @param int $taskTtl 任务状态过期时间（秒），默认 7 天
     * @param int $heartbeatTtl 心跳过期时间（秒），默认 5 分钟
     */
    public function saveTaskStatusWithHeartbeat(
        AsrTaskStatusDTO $taskStatus,
        int $taskTtl = 604800,
        int $heartbeatTtl = 300
    ): void {
        [$taskKey, $heartbeatKey] = $this->getRedisKeys($taskStatus);

        // 使用 MULTI/EXEC 确保原子性
        $this->redis->multi();
        $this->redis->hMSet($taskKey, $taskStatus->toArray());
        $this->redis->expire($taskKey, $taskTtl);
        $this->redis->setex($heartbeatKey, $heartbeatTtl, (string) time());
        $this->redis->exec();
    }

    /**
     * 原子操作：保存任务状态并删除心跳
     * 使用 Redis MULTI/EXEC 确保原子性.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态 DTO
     * @param int $taskTtl 任务状态过期时间（秒），默认 7 天
     */
    public function saveTaskStatusAndDeleteHeartbeat(
        AsrTaskStatusDTO $taskStatus,
        int $taskTtl = 604800
    ): void {
        [$taskKey, $heartbeatKey] = $this->getRedisKeys($taskStatus);

        // 使用 MULTI/EXEC 确保原子性
        $this->redis->multi();
        $this->redis->hMSet($taskKey, $taskStatus->toArray());
        $this->redis->expire($taskKey, $taskTtl);
        $this->redis->del($heartbeatKey);
        $this->redis->exec();
    }

    /**
     * 生成 Redis 键（任务状态和心跳）.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态 DTO
     * @return array{0: string, 1: string} [任务键, 心跳键]
     */
    private function getRedisKeys(AsrTaskStatusDTO $taskStatus): array
    {
        $hash = md5($taskStatus->userId . ':' . $taskStatus->taskKey);
        return [
            sprintf(AsrRedisKeys::TASK_HASH, $hash),
            sprintf(AsrRedisKeys::HEARTBEAT, $hash),
        ];
    }
}
