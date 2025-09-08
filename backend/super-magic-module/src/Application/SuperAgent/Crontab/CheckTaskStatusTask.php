<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Crontab;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\TopicTaskAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\SandboxInterface;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 检查长时间处于运行状态的任务
 */
#[Crontab(rule: '12 * * * *', name: 'CheckTaskStatus', singleton: true, onOneServer: true, callback: 'execute', memo: '每小时的第12分钟检查超过6小时未完成的话题和容器状态')]
readonly class CheckTaskStatusTask
{
    private const GLOBAL_LOCK_KEY = 'check_task_status_crontab_lock';

    private const GLOBAL_LOCK_EXPIRE = 900; // Global lock timeout: 15 minutes

    protected LoggerInterface $logger;

    public function __construct(
        protected TopicAppService $topicAppService,
        protected TopicTaskAppService $taskAppService,
        protected SandboxInterface $sandboxService,
        private LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * 执行任务，检查超过3小时未更新的任务并根据沙箱状态更新任务状态
     */
    public function execute(): void
    {
        $enableCrontab = config('super-magic.task.check_task_crontab.enabled', false);
        if ($enableCrontab === false) {
            return;
        }

        $startTime = microtime(true);
        $globalLockOwner = IdGenerator::getUniqueId32();

        $this->logger->info('[CheckTaskStatusTask] 开始检查长时间未更新的任务');

        // Step 1: Acquire global lock to prevent multiple instances
        if (! $this->acquireGlobalLock($globalLockOwner)) {
            $this->logger->info('[CheckTaskStatusTask] 无法获取全局锁，其他实例正在执行任务，跳过本次执行');
            return;
        }

        try {
            // 检查任务状态和容器状态
            $this->checkTasksStatus();

            $executionTime = round((microtime(true) - $startTime) * 1000, 2);
            $this->logger->info(sprintf(
                '[CheckTaskStatusTask] 任务执行完成，耗时: %sms',
                $executionTime
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf('[CheckTaskStatusTask] 执行失败: %s', $e->getMessage()), [
                'exception' => $e,
            ]);
        } finally {
            // Step 2: Always release global lock
            $this->releaseGlobalLock($globalLockOwner);
        }
    }

    /**
     * 检查任务状态和容器状态
     */
    private function checkTasksStatus(): void
    {
        try {
            // 获取6小时前的时间点
            $timeThreshold = date('Y-m-d H:i:s', strtotime('-3 hours'));

            // 获取超时话题列表（更新时间超过7小时的话题，最多100条）
            $staleRunningTopics = $this->topicAppService->getTopicsExceedingUpdateTime($timeThreshold, 100);

            if (empty($staleRunningTopics)) {
                $this->logger->info('[CheckTaskStatusTask] 没有需要检查的超时话题');
                return;
            }

            $this->logger->info(sprintf('[CheckTaskStatusTask] 开始检查 %d 个超时话题的容器状态', count($staleRunningTopics)));

            $updatedToRunningCount = 0;
            $updatedToErrorCount = 0;

            foreach ($staleRunningTopics as $topic) {
                // 每次循环后休眠0.1秒，避免请求过于频繁
                usleep(100000); // 100000微秒 = 0.1秒
                $status = $this->taskAppService->updateTaskStatusFromSandbox($topic);
                if ($status === TaskStatus::RUNNING) {
                    ++$updatedToRunningCount;
                    continue;
                }
                ++$updatedToErrorCount;
            }
            $this->logger->info(sprintf(
                '[CheckTaskStatusTask] 检查完成，共更新 %d 个话题为运行状态，%d 个话题为错误状态',
                $updatedToRunningCount,
                $updatedToErrorCount
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf('[CheckTaskStatusTask] 检查任务状态失败: %s', $e->getMessage()));
            throw $e;
        }
    }

    /**
     * Acquire global lock.
     */
    private function acquireGlobalLock(string $lockOwner): bool
    {
        return $this->locker->mutexLock(self::GLOBAL_LOCK_KEY, $lockOwner, self::GLOBAL_LOCK_EXPIRE);
    }

    /**
     * Release global lock.
     */
    private function releaseGlobalLock(string $lockOwner): void
    {
        if ($this->locker->release(self::GLOBAL_LOCK_KEY, $lockOwner)) {
            $this->logger->info('[CheckTaskStatusTask] 全局锁释放成功');
        } else {
            $this->logger->error('[CheckTaskStatusTask] 全局锁释放失败，可能需要人工检查');
        }
    }
}
