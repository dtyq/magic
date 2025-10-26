<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Crontab;

use App\Application\Speech\Enum\AsrRecordingStatusEnum;
use App\Application\Speech\Service\AsrFileAppService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * ASR 录音心跳监控定时任务.
 */
#[Crontab(
    rule: '* * * * *',                    // 每分钟执行一次
    name: 'AsrHeartbeatMonitor',
    singleton: true,                      // 单例模式防止重复执行
    mutexExpires: 60,                     // 互斥锁 60 秒后过期
    onOneServer: true,                    // 仅在一台服务器上执行
    callback: 'execute',
    memo: 'ASR recording heartbeat monitoring task'
)]
class AsrHeartbeatMonitor
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly Redis $redis,
        private readonly AsrFileAppService $asrFileAppService,
        private readonly MagicUserDomainService $magicUserDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('AsrHeartbeatMonitor');
    }

    /**
     * 执行心跳监控任务.
     */
    public function execute(): void
    {
        try {
            $this->logger->info('开始执行 ASR 录音心跳监控任务');

            // 扫描所有心跳 key
            $pattern = 'asr:heartbeat:*';
            $cursor = 0;
            $timeoutCount = 0;

            do {
                $result = $this->redis->scan($cursor, $pattern, 100);
                if ($result === false) {
                    break;
                }

                [$cursor, $keys] = $result;

                foreach ($keys as $key) {
                    try {
                        $this->checkHeartbeatTimeout($key);
                    } catch (Throwable $e) {
                        $this->logger->error('检查心跳超时失败', [
                            'key' => $key,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            } while ($cursor !== 0);

            $this->logger->info('ASR 录音心跳监控任务执行完成', [
                'timeout_count' => $timeoutCount,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('ASR 录音心跳监控任务执行失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * 检查心跳是否超时.
     */
    private function checkHeartbeatTimeout(string $key): void
    {
        // 检查 key 是否存在
        $exists = $this->redis->exists($key);
        if (! $exists) {
            // Key 已经过期，说明心跳超时
            $this->handleHeartbeatTimeout($key);
        }
    }

    /**
     * 处理心跳超时.
     */
    private function handleHeartbeatTimeout(string $key): void
    {
        try {
            // 从 key 中提取 task_key 和 user_id
            // Key 格式：asr:heartbeat:{md5(user_id:task_key)}
            $this->logger->info('检测到心跳超时', ['key' => $key]);

            // 由于 key 是 MD5 hash，我们无法直接反向获取 task_key 和 user_id
            // 需要从 Redis 中扫描所有 asr:task:* 来查找匹配的任务
            $this->findAndTriggerTimeoutTask($key);
        } catch (Throwable $e) {
            $this->logger->error('处理心跳超时失败', [
                'key' => $key,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 查找并触发超时任务的自动总结.
     */
    private function findAndTriggerTimeoutTask(string $heartbeatKey): void
    {
        // 扫描所有任务
        $pattern = 'asr:task:*';
        $cursor = 0;

        do {
            $result = $this->redis->scan($cursor, $pattern, 100);
            if ($result === false) {
                break;
            }

            [$cursor, $keys] = $result;

            foreach ($keys as $taskKey) {
                try {
                    $taskData = $this->redis->hGetAll($taskKey);
                    if (empty($taskData)) {
                        continue;
                    }

                    $taskStatus = AsrTaskStatusDTO::fromArray($taskData);

                    // 检查是否匹配当前心跳 key
                    $expectedHeartbeatKey = sprintf(
                        'asr:heartbeat:%s',
                        md5($taskStatus->userId . ':' . $taskStatus->taskKey)
                    );

                    if ($expectedHeartbeatKey === $heartbeatKey) {
                        // 找到匹配的任务，检查是否需要触发自动总结
                        if ($this->shouldTriggerAutoSummary($taskStatus)) {
                            $this->triggerAutoSummary($taskStatus);
                        }
                        return;
                    }
                } catch (Throwable $e) {
                    $this->logger->error('检查任务失败', [
                        'task_key' => $taskKey,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        } while ($cursor !== 0);
    }

    /**
     * 判断是否应该触发自动总结.
     */
    private function shouldTriggerAutoSummary(AsrTaskStatusDTO $taskStatus): bool
    {
        // 如果处于暂停状态，不触发
        if ($taskStatus->isPaused) {
            return false;
        }

        // 如果录音状态不是 start 或 recording，不触发
        if (! in_array($taskStatus->recordingStatus, ['start', 'recording'], true)) {
            return false;
        }

        // 如果没有项目ID或话题ID，不触发
        if (empty($taskStatus->projectId) || empty($taskStatus->topicId)) {
            return false;
        }

        // 如果沙箱任务未创建，不触发
        if (! $taskStatus->sandboxTaskCreated) {
            return false;
        }

        return true;
    }

    /**
     * 触发自动总结.
     */
    private function triggerAutoSummary(AsrTaskStatusDTO $taskStatus): void
    {
        try {
            $this->logger->info('触发心跳超时自动总结', [
                'task_key' => $taskStatus->taskKey,
                'user_id' => $taskStatus->userId,
                'project_id' => $taskStatus->projectId,
                'topic_id' => $taskStatus->topicId,
            ]);

            // 获取用户实体
            $userEntity = $this->magicUserDomainService->getUserById($taskStatus->userId);
            if ($userEntity === null) {
                throw new InvalidArgumentException('用户不存在');
            }

            $userAuthorization = MagicUserAuthorization::fromUserEntity($userEntity);
            $organizationCode = $taskStatus->organizationCode ?? $userAuthorization->getOrganizationCode();

            // 更新任务状态为 stopped
            $taskStatus->recordingStatus = 'stopped';
            $this->asrFileAppService->saveTaskStatusToRedis($taskStatus);

            // 调用 handleStatusReport 来触发 stopped 状态（触发自动总结）
            $this->asrFileAppService->handleStatusReport(
                $taskStatus->taskKey,
                AsrRecordingStatusEnum::STOPPED,  // 使用枚举
                $taskStatus->modelId ?? '',
                $taskStatus->asrStreamContent ?? '',  // ASR 流式内容
                $taskStatus->noteContent,             // 笔记内容
                $taskStatus->noteFileType,            // 笔记文件类型
                $taskStatus->language ?? 'zh_CN',     // 语种
                $taskStatus->userId,
                $organizationCode
            );

            $this->logger->info('心跳超时自动总结已触发', [
                'task_key' => $taskStatus->taskKey,
                'user_id' => $taskStatus->userId,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('触发自动总结失败', [
                'task_key' => $taskStatus->taskKey,
                'user_id' => $taskStatus->userId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
