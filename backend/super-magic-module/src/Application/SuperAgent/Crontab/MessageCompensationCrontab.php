<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Crontab;

use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Carbon\Carbon;
use Dtyq\SuperMagic\Application\SuperAgent\Service\HandleAgentMessageAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskMessageModel;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Coroutine\Parallel;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Message Compensation Crontab
 * 消息补偿定时任务 - 处理可能遗漏的消息队列补偿
 */
#[Crontab(
    rule: '*/5 * * * * *',                    // Execute every 5 seconds
    name: 'MessageCompensationCrontab',
    singleton: true,                          // Singleton mode to prevent duplicate execution
    mutexExpires: 60,                         // Mutex lock expires in 60 seconds
    onOneServer: true,                        // Execute on only one server
    callback: 'execute',
    memo: 'Message compensation scheduled task for handling missed messages'
)]
readonly class MessageCompensationCrontab
{
    private const GLOBAL_LOCK_KEY = 'message_compensation_crontab_lock';

    // Unified topic lock prefix - consistent with all message queue services
    private const TOPIC_LOCK_PREFIX = 'msg_queue_compensation:topic:';

    private const GLOBAL_LOCK_EXPIRE = 60; // Global lock timeout: 60 seconds

    private const TOPIC_LOCK_EXPIRE = 20;  // Topic lock timeout: 20 seconds (same as consumer)

    private const TIME_WINDOW_MINUTES = 20; // Query messages from last 20 minutes

    private const MAX_TOPICS_PER_BATCH = 50; // Maximum topics to process per batch

    private const MAX_TOPICS_PER_EXECUTION = 20; // Maximum topics to process per execution

    protected LoggerInterface $logger;

    public function __construct(
        private HandleAgentMessageAppService $handleAgentMessageAppService,
        private LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Main execution method.
     */
    public function execute(): void
    {
        $enableCrontab = config('super-magic.message.enable_compensate', false);
        if ($enableCrontab === false) {
            return;
        }
        $startTime = microtime(true);
        $globalLockOwner = IdGenerator::getUniqueId32();

        $this->logger->info('消息补偿定时任务开始执行');

        // Step 1: Acquire global lock to prevent multiple instances
        if (! $this->acquireGlobalLock($globalLockOwner)) {
            $this->logger->info('无法获取全局锁，其他实例正在执行补偿任务，跳过本次执行');
            return;
        }

        try {
            // Step 2: Get topics that need compensation
            $topicTasks = $this->getCompensationTopics();

            if (empty($topicTasks)) {
                $this->logger->info('没有需要补偿处理的话题');
                return;
            }

            $topicCount = count($topicTasks);
            $this->logger->info(sprintf('发现 %d 个话题需要补偿处理', $topicCount));

            // Step 3: Process topics concurrently in batches
            $this->processTopicsConcurrently($topicTasks);

            $executionTime = round((microtime(true) - $startTime) * 1000, 2);
            $this->logger->info(sprintf(
                '消息补偿定时任务执行完成，处理话题数: %d，耗时: %sms',
                $topicCount,
                $executionTime
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '消息补偿定时任务执行异常: %s',
                $e->getMessage()
            ), ['exception' => $e]);
        } finally {
            // Step 4: Always release global lock
            $this->releaseGlobalLock($globalLockOwner);
        }
    }

    /**
     * Get topics that need compensation processing
     * 获取需要补偿处理的话题列表（高性能查询）.
     */
    private function getCompensationTopics(): array
    {
        try {
            $timeThreshold = Carbon::now()->subMinutes(self::TIME_WINDOW_MINUTES);

            // High-performance query: Use simple conditions and proper indexing
            // 使用原生SQL提高性能，避免ORM开销，只查询topic_id进行分组
            $sql = '
                SELECT DISTINCT topic_id 
                FROM ' . (new TaskMessageModel())->getTable() . " 
                WHERE processing_status IN (?, ?) 
                  AND created_at >= ? 
                  AND sender_type = 'assistant'
                GROUP BY topic_id
                ORDER BY topic_id ASC 
                LIMIT ?
            ";

            $results = Db::select($sql, [
                TaskMessageEntity::PROCESSING_STATUS_PENDING,
                TaskMessageEntity::PROCESSING_STATUS_PROCESSING,
                $timeThreshold->toDateTimeString(),
                self::MAX_TOPICS_PER_BATCH,
            ]);

            $topicTasks = [];
            foreach ($results as $result) {
                // Convert stdClass to array for consistent access
                $resultArray = (array) $result;
                $topicTasks[] = [
                    'topic_id' => (int) $resultArray['topic_id'],
                    'task_id' => 0, // 不需要具体的task_id，统一使用0
                ];
            }

            $this->logger->info(sprintf(
                '查询到 %d 个需要补偿的话题，时间窗口: %s',
                count($topicTasks),
                $timeThreshold->toDateTimeString()
            ));

            return $topicTasks;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '查询补偿话题失败: %s',
                $e->getMessage()
            ), ['exception' => $e]);
            return [];
        }
    }

    /**
     * Process topics concurrently using coroutines
     * 使用协程并发处理话题列表.
     */
    private function processTopicsConcurrently(array $topicTasks): void
    {
        $batches = array_chunk($topicTasks, self::MAX_TOPICS_PER_EXECUTION);
        $totalProcessed = 0;
        $totalSuccessful = 0;

        foreach ($batches as $batchIndex => $batch) {
            $this->logger->info(sprintf(
                '开始协程并发处理第 %d 批话题，数量: %d',
                $batchIndex + 1,
                count($batch)
            ));

            // Create parallel processor for this batch
            $parallel = new Parallel();
            $fromCoroutineId = Coroutine::id();

            // Add coroutine tasks for each topic in this batch
            foreach ($batch as $topicTask) {
                $parallel->add(function () use ($topicTask, $fromCoroutineId) {
                    // Copy coroutine context to maintain proper isolation
                    CoContext::copy($fromCoroutineId);

                    return $this->processTopicWithLock(
                        $topicTask['topic_id'],
                        0  // 补偿任务不需要具体的task_id
                    );
                });
            }

            // Wait for all coroutines in this batch to complete
            $results = $parallel->wait();

            // Collect statistics
            $batchSuccessful = 0;
            foreach ($results as $result) {
                ++$totalProcessed;
                if ($result['success']) {
                    ++$totalSuccessful;
                    ++$batchSuccessful;
                }
            }

            $this->logger->info(sprintf(
                '第 %d 批话题协程处理完成，成功: %d，总计: %d',
                $batchIndex + 1,
                $batchSuccessful,
                count($results)
            ));
        }

        $this->logger->info(sprintf(
            '全部话题协程处理完成，总数: %d，成功: %d，失败: %d',
            $totalProcessed,
            $totalSuccessful,
            $totalProcessed - $totalSuccessful
        ));
    }

    /**
     * Process single topic with lock protection
     * 使用锁保护处理单个话题.
     */
    private function processTopicWithLock(int $topicId, int $taskId): array
    {
        $lockKey = self::TOPIC_LOCK_PREFIX . $topicId;
        $lockOwner = IdGenerator::getUniqueId32();
        $startTime = microtime(true);

        // Try to acquire topic lock
        if (! $this->acquireTopicLock($lockKey, $lockOwner)) {
            $this->logger->info(sprintf(
                'topic %d 正在被其他实例处理，跳过补偿处理',
                $topicId
            ));
            return [
                'success' => false,
                'topic_id' => $topicId,
                'reason' => 'lock_failed',
                'processed_count' => 0,
            ];
        }

        try {
            $this->logger->info(sprintf(
                '开始补偿处理 topic %d，锁持有者: %s',
                $topicId,
                $lockOwner
            ));

            // Call the batch processing method
            $processedCount = $this->handleAgentMessageAppService->batchHandleAgentMessage($topicId, 0);

            $executionTime = round((microtime(true) - $startTime) * 1000, 2);
            $this->logger->info(sprintf(
                'topic %d 补偿处理完成，处理消息数: %d，耗时: %sms',
                $topicId,
                $processedCount,
                $executionTime
            ));

            return [
                'success' => true,
                'topic_id' => $topicId,
                'processed_count' => $processedCount,
                'execution_time_ms' => $executionTime,
            ];
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'topic %d 补偿处理失败: %s',
                $topicId,
                $e->getMessage()
            ), [
                'topic_id' => $topicId,
                'exception' => $e,
            ]);

            return [
                'success' => false,
                'topic_id' => $topicId,
                'reason' => 'processing_failed',
                'error' => $e->getMessage(),
                'processed_count' => 0,
            ];
        } finally {
            // Always release topic lock
            if ($this->releaseTopicLock($lockKey, $lockOwner)) {
                $this->logger->info(sprintf(
                    '已释放 topic %d 的锁，持有者: %s',
                    $topicId,
                    $lockOwner
                ));
            } else {
                $this->logger->error(sprintf(
                    '释放 topic %d 的锁失败，持有者: %s，可能需要人工干预',
                    $topicId,
                    $lockOwner
                ));
            }
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
            $this->logger->info('全局锁释放成功');
        } else {
            $this->logger->error('全局锁释放失败，可能需要人工检查');
        }
    }

    /**
     * Acquire topic lock.
     */
    private function acquireTopicLock(string $lockKey, string $lockOwner): bool
    {
        return $this->locker->mutexLock($lockKey, $lockOwner, self::TOPIC_LOCK_EXPIRE);
    }

    /**
     * Release topic lock.
     */
    private function releaseTopicLock(string $lockKey, string $lockOwner): bool
    {
        return $this->locker->release($lockKey, $lockOwner);
    }
}
