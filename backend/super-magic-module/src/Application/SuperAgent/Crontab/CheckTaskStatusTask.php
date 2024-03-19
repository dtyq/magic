<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Crontab;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\SandboxDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 检查长时间处于运行状态的任务
 */
#[Crontab(rule: '*/10 * * * *', name: 'CheckTaskStatus', singleton: true, onOneServer: true, callback: 'execute', memo: '每10分钟检查开始时间超过2分钟且状态为running/waiting的任务，根据沙箱状态更新任务和话题状态')]
readonly class CheckTaskStatusTask
{
    private const GLOBAL_LOCK_KEY = 'check_task_status_crontab_lock';

    private const GLOBAL_LOCK_EXPIRE = 900; // Global lock timeout: 15 minutes

    protected LoggerInterface $logger;

    public function __construct(
        protected TaskRepositoryInterface $taskRepository,
        protected TopicRepositoryInterface $topicRepository,
        protected TaskDomainService $taskDomainService,
        protected TopicDomainService $topicDomainService,
        protected SandboxDomainService $sandboxDomainService,
        private LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * 执行任务，检查创建时间超过15分钟且状态为running的任务，根据沙箱状态更新任务和话题状态
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
            // 获取2分钟前的时间点（PHP 计算避免 MySQL 函数，提高索引利用率）
            $timeThreshold = date('Y-m-d H:i:s', strtotime('-2 minutes'));

            // 获取超时任务列表（开始时间超过2分钟且状态为running/waiting的任务，最多100条）
            $staleRunningTasks = $this->taskRepository->getRunningTasksExceedingCreatedTime($timeThreshold, 100);

            if (empty($staleRunningTasks)) {
                $this->logger->info('[CheckTaskStatusTask] 没有需要检查的超时任务');
                return;
            }

            $this->logger->info(sprintf('[CheckTaskStatusTask] 开始检查 %d 个超时任务的沙箱状态', count($staleRunningTasks)));

            $taskUpdatedCount = 0;
            $topicUpdatedCount = 0;
            $skippedCount = 0;

            foreach ($staleRunningTasks as $task) {
                // 每次循环后休眠0.1秒，避免请求过于频繁
                usleep(100000); // 100000微秒 = 0.1秒

                $result = $this->checkAndUpdateTaskStatus($task);

                if ($result['taskUpdated']) {
                    ++$taskUpdatedCount;
                }
                if ($result['topicUpdated']) {
                    ++$topicUpdatedCount;
                }
                if (! $result['taskUpdated'] && ! $result['topicUpdated']) {
                    ++$skippedCount;
                }
            }

            $this->logger->info(sprintf(
                '[CheckTaskStatusTask] 检查完成，共更新 %d 个任务状态，%d 个话题状态，跳过 %d 个',
                $taskUpdatedCount,
                $topicUpdatedCount,
                $skippedCount
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf('[CheckTaskStatusTask] 检查任务状态失败: %s', $e->getMessage()));
            throw $e;
        }
    }

    /**
     * 检查任务状态并更新.
     *
     * @param TaskEntity $task 任务实体
     * @return array{taskUpdated: bool, topicUpdated: bool, status: TaskStatus}
     */
    private function checkAndUpdateTaskStatus(TaskEntity $task): array
    {
        $this->logger->info(sprintf('开始检查任务状态: task_id=%s, topic_id=%s', $task->getId(), $task->getTopicId()));

        // 获取沙箱ID（优先使用任务的sandbox_id，否则使用topic_id）
        $sandboxId = ! empty($task->getSandboxId()) ? $task->getSandboxId() : (string) $task->getTopicId();

        // 调用沙箱API查询状态
        $sandboxStatusResult = $this->sandboxDomainService->getSandboxStatus($sandboxId);
        $sandboxStatus = $sandboxStatusResult->getStatus();

        $taskUpdated = false;
        $topicUpdated = false;

        // 判断沙箱状态
        if ($sandboxStatus === SandboxStatus::NOT_FOUND) {
            // 沙箱不存在，更新任务状态为ERROR
            $errMsg = sprintf('Sandbox not found: %s', $sandboxId);
            $this->taskDomainService->updateTaskStatusByTaskId($task->getId(), TaskStatus::ERROR, $errMsg);
            $taskUpdated = true;

            // 获取任务对应的话题
            $topic = $this->topicRepository->getTopicById($task->getTopicId());
            if ($topic && $topic->getCurrentTaskId() === $task->getId()) {
                // 话题的当前任务ID与任务ID一致，更新话题状态
                $this->topicDomainService->updateTopicStatus($topic->getId(), $task->getId(), TaskStatus::ERROR);
                $topicUpdated = true;
                $this->logger->info(sprintf('任务和话题状态已更新为ERROR: task_id=%s, topic_id=%s', $task->getId(), $topic->getId()));
            } else {
                $this->logger->info(sprintf(
                    '任务状态已更新，但话题当前任务ID不一致，跳过话题更新: task_id=%s, topic_id=%s, topic_current_task_id=%s',
                    $task->getId(),
                    $task->getTopicId(),
                    $topic ? (string) $topic->getCurrentTaskId() : 'null'
                ));
            }

            return [
                'taskUpdated' => $taskUpdated,
                'topicUpdated' => $topicUpdated,
                'status' => TaskStatus::ERROR,
            ];
        }

        if ($sandboxStatus === SandboxStatus::RUNNING) {
            // 沙箱正常运行，保持任务状态为RUNNING
            $this->logger->info(sprintf('沙箱状态正常(running): sandboxId=%s, task_id=%s', $sandboxId, $task->getId()));
            return [
                'taskUpdated' => false,
                'topicUpdated' => false,
                'status' => TaskStatus::RUNNING,
            ];
        }

        // 其他状态（EXITED, UNKNOWN等），更新任务状态为ERROR
        $errMsg = sprintf('Sandbox status: %s', $sandboxStatus);
        $this->taskDomainService->updateTaskStatusByTaskId($task->getId(), TaskStatus::ERROR, $errMsg);
        $taskUpdated = true;

        // 获取任务对应的话题
        $topic = $this->topicRepository->getTopicById($task->getTopicId());
        if ($topic && $topic->getCurrentTaskId() === $task->getId()) {
            // 话题的当前任务ID与任务ID一致，更新话题状态
            $this->topicDomainService->updateTopicStatus($topic->getId(), $task->getId(), TaskStatus::ERROR);
            $topicUpdated = true;
            $this->logger->info(sprintf(
                '任务和话题状态已更新为ERROR: task_id=%s, topic_id=%s, sandbox_status=%s',
                $task->getId(),
                $topic->getId(),
                $sandboxStatus
            ));
        } else {
            $this->logger->info(sprintf(
                '任务状态已更新，但话题当前任务ID不一致，跳过话题更新: task_id=%s, topic_id=%s, topic_current_task_id=%s, sandbox_status=%s',
                $task->getId(),
                $task->getTopicId(),
                $topic ? (string) $topic->getCurrentTaskId() : 'null',
                $sandboxStatus
            ));
        }

        return [
            'taskUpdated' => $taskUpdated,
            'topicUpdated' => $topicUpdated,
            'status' => TaskStatus::ERROR,
        ];
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
