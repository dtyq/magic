<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Crontab;

use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\Speech\Enum\AsrRecordingStatusEnum;
use App\Application\Speech\Service\AsrFileAppService;
use App\Domain\Asr\Constants\AsrRedisKeys;
use App\Domain\Asr\Constants\AsrTimeouts;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\Redis\RedisUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

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

            // 扫描所有心跳 key（使用 RedisUtil::scanKeys 防止阻塞）
            $keys = RedisUtil::scanKeys(AsrRedisKeys::HEARTBEAT_SCAN_PATTERN, 200, 2000);
            $timeoutCount = 0;

            foreach ($keys as $key) {
                try {
                    if ($this->checkHeartbeatTimeout($key)) {
                        ++$timeoutCount;
                    }
                } catch (Throwable $e) {
                    $this->logger->error('检查心跳超时失败', [
                        'key' => $key,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

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
    private function checkHeartbeatTimeout(string $key): bool
    {
        // 读取心跳时间戳
        $last = (int) $this->redis->get($key);
        // 超时阈值：90 秒
        if (($last > 0) && (time() - $last) <= AsrTimeouts::HEARTBEAT_TIMEOUT) {
            return false;
        }

        // Key 不存在或时间戳超时，触发处理
        $this->handleHeartbeatTimeout($key);
        return true;
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
        $keys = RedisUtil::scanKeys(AsrRedisKeys::TASK_SCAN_PATTERN, 200, 2000);

        foreach ($keys as $taskKey) {
            try {
                $taskData = $this->redis->hGetAll($taskKey);
                if (empty($taskData)) {
                    continue;
                }

                $taskStatus = AsrTaskStatusDTO::fromArray($taskData);

                // 检查是否匹配当前心跳 key
                $expectedHeartbeatKey = sprintf(
                    AsrRedisKeys::HEARTBEAT,
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
    }

    /**
     * 判断是否应该触发自动总结.
     */
    private function shouldTriggerAutoSummary(AsrTaskStatusDTO $taskStatus): bool
    {
        // 如果已取消，不触发
        if ($taskStatus->recordingStatus === AsrRecordingStatusEnum::CANCELED->value) {
            return false;
        }

        // 如果处于暂停状态，不触发
        if ($taskStatus->isPaused) {
            return false;
        }

        // 如果录音状态不是 start 或 recording，不触发
        if (! in_array($taskStatus->recordingStatus, [
            AsrRecordingStatusEnum::START->value,
            AsrRecordingStatusEnum::RECORDING->value,
        ], true)) {
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
            // 幂等性检查：如果任务已完成，跳过处理
            if ($taskStatus->isSummaryCompleted()) {
                $this->logger->info('任务已完成，跳过心跳超时处理', [
                    'task_key' => $taskStatus->taskKey,
                    'audio_file_id' => $taskStatus->audioFileId,
                    'status' => $taskStatus->status->value,
                ]);
                return;
            }

            $this->logger->info('触发心跳超时自动总结', [
                'task_key' => $taskStatus->taskKey,
                'user_id' => $taskStatus->userId,
                'project_id' => $taskStatus->projectId,
                'topic_id' => $taskStatus->topicId,
            ]);

            // 获取用户实体
            $userEntity = $this->magicUserDomainService->getUserById($taskStatus->userId);
            if ($userEntity === null) {
                throw new InvalidArgumentException(trans('asr.exception.user_not_exist'));
            }

            $userAuthorization = MagicUserAuthorization::fromUserEntity($userEntity);
            $organizationCode = $taskStatus->organizationCode ?? $userAuthorization->getOrganizationCode();

            // 直接调用自动总结方法（会在方法内部更新状态）
            $this->asrFileAppService->autoTriggerSummary($taskStatus, $taskStatus->userId, $organizationCode);

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
