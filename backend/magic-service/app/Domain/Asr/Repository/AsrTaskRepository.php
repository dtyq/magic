<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asr\Repository;

use App\Domain\Asr\Constants\AsrRedisKeys;
use App\Domain\Asr\Constants\AsrTimeouts;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * ASR 任务状态仓储
 * 统一管理 Redis 中的任务状态 CRUD.
 */
readonly class AsrTaskRepository
{
    public function __construct(
        private Redis $redis,
        private LoggerInterface $logger
    ) {
    }

    /**
     * 保存任务状态到 Redis.
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态 DTO
     * @param int $ttl 过期时间（秒），默认 7 天
     */
    public function save(AsrTaskStatusDTO $taskStatus, int $ttl = AsrTimeouts::TASK_STATUS_TTL): void
    {
        try {
            $redisKey = $this->generateTaskKey($taskStatus->taskKey, $taskStatus->userId);

            // 保存任务状态数据
            $this->redis->hMSet($redisKey, $taskStatus->toArray());

            // 设置过期时间
            $this->redis->expire($redisKey, $ttl);
        } catch (Throwable $e) {
            // Redis 操作失败时记录但不抛出异常
            $this->logger->warning(trans('asr.api.redis.save_task_status_failed'), [
                'task_key' => $taskStatus->taskKey ?? 'unknown',
                'user_id' => $taskStatus->userId ?? 'unknown',
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 根据任务键和用户ID查询任务状态.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     * @return null|AsrTaskStatusDTO 任务状态 DTO，不存在时返回 null
     */
    public function findByTaskKey(string $taskKey, string $userId): ?AsrTaskStatusDTO
    {
        try {
            $redisKey = $this->generateTaskKey($taskKey, $userId);
            $taskData = $this->redis->hGetAll($redisKey);

            if (empty($taskData)) {
                return null;
            }

            $dto = AsrTaskStatusDTO::fromArray($taskData);
            return $dto->isEmpty() ? null : $dto;
        } catch (Throwable $e) {
            $this->logger->warning('从 Redis 获取任务状态失败', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * 检查任务是否存在.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     * @return bool 是否存在
     */
    public function exists(string $taskKey, string $userId): bool
    {
        try {
            $redisKey = $this->generateTaskKey($taskKey, $userId);
            $result = $this->redis->exists($redisKey);
            return is_int($result) && $result > 0;
        } catch (Throwable $e) {
            $this->logger->warning('检查任务是否存在失败', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * 删除任务状态.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     * @return bool 是否删除成功
     */
    public function delete(string $taskKey, string $userId): bool
    {
        try {
            $redisKey = $this->generateTaskKey($taskKey, $userId);
            $result = $this->redis->del($redisKey);
            return is_int($result) && $result > 0;
        } catch (Throwable $e) {
            $this->logger->warning('删除任务状态失败', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * 删除心跳 Key.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     */
    public function deleteHeartbeat(string $taskKey, string $userId): void
    {
        try {
            $key = $this->generateHeartbeatKey($taskKey, $userId);
            $this->redis->del($key);
        } catch (Throwable $e) {
            $this->logger->warning('删除心跳 Key 失败', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 生成任务状态的 Redis 键名.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     * @return string Redis 键名
     */
    private function generateTaskKey(string $taskKey, string $userId): string
    {
        // 按统一规则生成字符串，然后 MD5 避免键名过长
        $keyString = sprintf('%s:%s', $userId, $taskKey);
        $keyHash = md5($keyString);
        return sprintf(AsrRedisKeys::TASK_HASH, $keyHash);
    }

    /**
     * 生成心跳 Key.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     * @return string Redis 键名
     */
    private function generateHeartbeatKey(string $taskKey, string $userId): string
    {
        return sprintf(AsrRedisKeys::HEARTBEAT, md5(sprintf('%s:%s', $userId, $taskKey)));
    }
}
