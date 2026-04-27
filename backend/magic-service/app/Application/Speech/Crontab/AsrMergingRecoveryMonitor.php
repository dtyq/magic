<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Crontab;

use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\Speech\Service\AsrFileAppService;
use App\Domain\Asr\Constants\AsrConfig;
use App\Domain\Asr\Constants\AsrRedisKeys;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\AudioProjectRepositoryInterface;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * ASR 合并阶段卡住任务恢复定时任务.
 *
 * Scans the database for audio projects whose merging phase has been stuck in
 * `in_progress` for longer than MERGING_STUCK_THRESHOLD_MINUTES and re-triggers
 * handleFinishRecording for each qualifying task.
 *
 * ── Design decisions ────────────────────────────────────────────────────────
 *
 * 1. DB-based scan (not Redis full-key-scan)
 *    The query is narrow (phase=merging + status=in_progress + old updated_at),
 *    so it returns only genuinely stuck tasks without scanning every Redis key.
 *
 * 2. Per-task FINISH_RECORDING_LOCK guard (most critical)
 *    Before touching any state for a task, we check whether its
 *    FINISH_RECORDING_LOCK is still held in Redis.
 *    - Lock held  → another coroutine/pod is actively merging; skip completely.
 *    - Lock absent → lock expired (process died), safe to recover.
 *    This prevents the cron from corrupting a live merge in progress.
 *
 * 3. Async dispatch per task (Coroutine::create)
 *    handleFinishRecording is synchronous and can block up to SANDBOX_MERGE_TIMEOUT
 *    (1200 s). Processing 10 tasks serially would block the cron thread for hours.
 *    Each task is dispatched to a background coroutine so the cron function
 *    returns in milliseconds regardless of how many tasks are found.
 *
 * 4. onOneServer + singleton prevent framework-level overlap.
 *    The manual Redis lock (MERGING_RECOVERY_LOCK) is a belt-and-suspenders guard
 *    against edge-cases where the framework mutex expires while the cron is
 *    still dispatching tasks. Since dispatching is now near-instant this is
 *    almost never needed, but costs nothing.
 *
 * ── Stuck-task detection ────────────────────────────────────────────────────
 *
 * A task is considered stuck when ALL of the following hold:
 *   - current_phase  = 'merging'
 *   - phase_status   = 'in_progress'
 *   - updated_at     < NOW() - MERGING_STUCK_THRESHOLD_MINUTES
 *   - FINISH_RECORDING_LOCK NOT present in Redis
 *
 * Normal tasks update their phase_percent (10 % → 50 % → 80 %) via
 * syncPhaseStateToDatabase, which refreshes updated_at. Only tasks whose
 * hosting process died mid-merge will stay "old" beyond the threshold.
 */
#[Crontab(
    rule: '*/2 * * * *',                  // Every 2 minutes
    name: 'AsrMergingRecoveryMonitor',
    singleton: true,                       // No concurrent executions on the same server
    mutexExpires: AsrConfig::MERGING_RECOVERY_MUTEX_EXPIRES,
    onOneServer: true,                     // Run on exactly one server in a cluster
    callback: 'execute',
    memo: 'ASR stuck-merging-task recovery monitor'
)]
class AsrMergingRecoveryMonitor
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly Redis $redis,
        private readonly AsrFileAppService $asrFileAppService,
        private readonly AudioProjectRepositoryInterface $audioProjectRepository,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('AsrMergingRecoveryMonitor');
    }

    /**
     * Execute the recovery scan.
     *
     * This method returns quickly: it only queries the DB and dispatches
     * background coroutines; the actual merge work happens asynchronously.
     */
    public function execute(): void
    {
        // Manual Redis lock as a belt-and-suspenders guard.
        // Since we dispatch asynchronously, this returns in milliseconds,
        // so the TTL only needs to cover the dispatch phase.
        if (! $this->acquireLock()) {
            $this->logger->info('Merging recovery lock already held, skipping this tick');
            return;
        }

        try {
            $this->logger->info('ASR merging recovery monitor started');
            $this->dispatchStuckTasks();
            $this->logger->info('ASR merging recovery monitor dispatch completed');
        } finally {
            $this->releaseLock();
        }
    }

    /**
     * Query DB for stuck tasks and dispatch each one asynchronously.
     */
    private function dispatchStuckTasks(): void
    {
        $stuckTasks = $this->audioProjectRepository->findStuckMergingTasks(
            AsrConfig::MERGING_STUCK_THRESHOLD_MINUTES,
            AsrConfig::MERGING_RECOVERY_MAX_TASKS
        );

        if (empty($stuckTasks)) {
            $this->logger->info('No stuck merging tasks found');
            return;
        }

        $this->logger->info('Found candidate stuck merging tasks', [
            'count' => count($stuckTasks),
            'threshold_minutes' => AsrConfig::MERGING_STUCK_THRESHOLD_MINUTES,
        ]);

        $dispatched = 0;
        $skipped = 0;

        foreach ($stuckTasks as $task) {
            if ($this->dispatchRecovery($task)) {
                ++$dispatched;
            } else {
                ++$skipped;
            }
        }

        $this->logger->info('Merging recovery dispatch summary', [
            'dispatched' => $dispatched,
            'skipped_lock_held' => $skipped,
        ]);
    }

    /**
     * Attempt to dispatch recovery for a single task.
     *
     * Returns true if a recovery coroutine was dispatched, false if the task
     * was skipped (lock still held, or max retries exceeded).
     *
     * @param array{project_id: int, task_key: string, user_id: string, organization_code: string, auto_summary: bool} $task
     */
    private function dispatchRecovery(array $task): bool
    {
        $taskKey = $task['task_key'];
        $userId = $task['user_id'];
        $organizationCode = $task['organization_code'];

        // ── Critical guard: skip tasks whose merge lock is still alive ─────────
        // FINISH_RECORDING_LOCK TTL = 120 s. If the lock is present, the original
        // coroutine/pod is still running. Touching Redis state here would corrupt it.
        $lockKey = sprintf(AsrRedisKeys::FINISH_RECORDING_LOCK, $taskKey);
        if ($this->redis->exists($lockKey)) {
            $this->logger->info('Skipping task: FINISH_RECORDING_LOCK still held', [
                'task_key' => $taskKey,
            ]);
            return false;
        }

        // ── Retry limit guard ─────────────────────────────────────────────────
        $retryKey = sprintf(AsrRedisKeys::MERGING_RECOVERY_RETRY_COUNT, $taskKey);
        $retryCount = (int) $this->redis->get($retryKey);
        if ($retryCount >= AsrConfig::MERGING_RECOVERY_MAX_RETRIES) {
            $this->markTaskAsFailed($task, $retryCount);
            return false;
        }

        // Increment before dispatch so each attempt is counted even if the coroutine crashes.
        // TTL matches TASK_STATUS_TTL (7 days) — counter auto-clears with the task.
        $this->redis->incr($retryKey);
        $this->redis->expire($retryKey, AsrConfig::TASK_STATUS_TTL);

        // ── Prepare Redis state for clean re-entry ────────────────────────────
        // Reset phase_status from in_progress → failed so that handleFinishRecording's
        // idempotent guard (which only blocks on phase_status=completed) does not
        // interfere. If the Redis key has already expired this is a no-op.
        $this->resetPhaseStatusInRedis($taskKey, $userId);

        // ── Async dispatch ─────────────────────────────────────────────────────
        // handleFinishRecording is synchronous and can take up to SANDBOX_MERGE_TIMEOUT
        // seconds. Running it in a child coroutine keeps this cron function fast.
        Coroutine::create(function () use ($taskKey, $userId, $organizationCode): void {
            try {
                $this->logger->info('Recovery coroutine started', ['task_key' => $taskKey]);
                $this->asrFileAppService->handleFinishRecording(
                    $taskKey,
                    $userId,
                    $organizationCode,
                    null
                );
                $this->logger->info('Recovery coroutine completed', ['task_key' => $taskKey]);
            } catch (Throwable $e) {
                $this->logger->error('Recovery coroutine failed', [
                    'task_key' => $taskKey,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        });

        $this->logger->info('Recovery coroutine dispatched', [
            'task_key' => $taskKey,
            'user_id' => $userId,
            'auto_summary' => $task['auto_summary'],
        ]);

        return true;
    }

    /**
     * Mark a task as permanently failed in both DB and Redis after max retries.
     *
     * This prevents the task from:
     * - Appearing in future cron scans (phase_status no longer 'in_progress')
     * - Showing an infinite spinner to the user (failed state surfaces an error)
     *
     * @param array{project_id: int, task_key: string, user_id: string, organization_code: string, auto_summary: bool} $task
     */
    private function markTaskAsFailed(array $task, int $retryCount): void
    {
        $taskKey = $task['task_key'];
        $projectId = $task['project_id'];
        $errorMessage = sprintf(
            'Merging failed after %d recovery attempts. Manual intervention required.',
            $retryCount
        );

        $this->logger->warning('Max recovery retries reached, marking task as failed', [
            'task_key' => $taskKey,
            'project_id' => $projectId,
            'retry_count' => $retryCount,
            'max_retries' => AsrConfig::MERGING_RECOVERY_MAX_RETRIES,
        ]);

        // Update DB so the task no longer appears in stuck-task scans
        try {
            $this->audioProjectRepository->updateByProjectId($projectId, [
                'phase_status' => AsrTaskStatusDTO::PHASE_STATUS_FAILED,
                'phase_error' => $errorMessage,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to update DB phase_status to failed', [
                'task_key' => $taskKey,
                'project_id' => $projectId,
                'error' => $e->getMessage(),
            ]);
        }

        // Update Redis if the key still exists so the user sees the error state
        $hash = md5($task['user_id'] . ':' . $taskKey);
        $redisKey = sprintf(AsrRedisKeys::TASK_HASH, $hash);
        if ($this->redis->exists($redisKey)) {
            $this->redis->hMSet($redisKey, [
                'phase_status' => AsrTaskStatusDTO::PHASE_STATUS_FAILED,
                'phase_error' => $errorMessage,
            ]);
        }
    }

    /**
     * Reset phase_status in Redis to 'failed' so handleFinishRecording can re-enter.
     *
     * Only the two phase fields are touched; all other task state (file IDs,
     * sandbox ID, recording status, etc.) is preserved so the retry has full context.
     */
    private function resetPhaseStatusInRedis(string $taskKey, string $userId): void
    {
        $hash = md5($userId . ':' . $taskKey);
        $redisKey = sprintf(AsrRedisKeys::TASK_HASH, $hash);

        if (! $this->redis->exists($redisKey)) {
            // Key already expired; handleFinishRecording will rebuild from DB.
            return;
        }

        $this->redis->hMSet($redisKey, [
            'phase_status' => AsrTaskStatusDTO::PHASE_STATUS_FAILED,
            'phase_error' => 'Recovered by AsrMergingRecoveryMonitor after pod/process restart',
        ]);

        $this->logger->info('Reset Redis phase_status to failed for clean recovery', [
            'task_key' => $taskKey,
        ]);
    }

    /**
     * Acquire the global dispatch mutex.
     *
     * TTL is kept short (MERGING_RECOVERY_MUTEX_EXPIRES) because we now only
     * hold the lock during the fast dispatch phase, not during the actual merge.
     */
    private function acquireLock(): bool
    {
        return (bool) $this->redis->set(
            AsrRedisKeys::MERGING_RECOVERY_LOCK,
            '1',
            ['NX', 'EX' => AsrConfig::MERGING_RECOVERY_MUTEX_EXPIRES]
        );
    }

    /**
     * Release the global dispatch mutex immediately after dispatching.
     */
    private function releaseLock(): void
    {
        $this->redis->del(AsrRedisKeys::MERGING_RECOVERY_LOCK);
    }
}
