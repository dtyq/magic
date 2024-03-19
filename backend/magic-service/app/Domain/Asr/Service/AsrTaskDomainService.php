<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asr\Service;

use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Domain\Asr\Constants\AsrRedisKeys;
use App\Domain\Asr\Repository\AsrTaskRepository;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\AudioProjectRepositoryInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * ASR 任务领域服务
 * 负责 ASR 任务状态的业务逻辑.
 */
readonly class AsrTaskDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        private AsrTaskRepository $asrTaskRepository,
        private AudioProjectRepositoryInterface $audioProjectRepository,
        private Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('AsrTaskDomainService');
    }

    /**
     * Start merging phase (paired update: Redis + Database).
     */
    public function startMergingPhase(AsrTaskStatusDTO $taskStatus, int $ttl = 604800): void
    {
        // Update phase state
        $taskStatus->currentPhase = AsrTaskStatusDTO::PHASE_MERGING;
        $taskStatus->phaseStatus = AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS;
        $taskStatus->phasePercent = 0;
        $taskStatus->phaseError = null;

        // Paired update: Redis + Database
        $this->saveTaskStatusWithDatabaseSync($taskStatus, $ttl);
    }

    /**
     * Complete merging phase (paired update: Redis + Database).
     */
    public function completeMergingPhase(AsrTaskStatusDTO $taskStatus, int $ttl = 604800): void
    {
        $taskStatus->phaseStatus = AsrTaskStatusDTO::PHASE_STATUS_COMPLETED;
        $taskStatus->phasePercent = 100;
        $taskStatus->phaseError = null;

        $this->saveTaskStatusWithDatabaseSync($taskStatus, $ttl);
    }

    /**
     * Fail merging phase (paired update: Redis + Database).
     */
    public function failMergingPhase(AsrTaskStatusDTO $taskStatus, string $error, int $ttl = 604800): void
    {
        $taskStatus->phaseStatus = AsrTaskStatusDTO::PHASE_STATUS_FAILED;
        $taskStatus->phaseError = $error;

        $this->saveTaskStatusWithDatabaseSync($taskStatus, $ttl);
    }

    /**
     * Start summarizing phase (paired update: Redis + Database).
     */
    public function startSummarizingPhase(AsrTaskStatusDTO $taskStatus, int $ttl = 604800): void
    {
        $taskStatus->currentPhase = AsrTaskStatusDTO::PHASE_SUMMARIZING;
        $taskStatus->phaseStatus = AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS;
        $taskStatus->phasePercent = 0;
        $taskStatus->phaseError = null;

        $this->saveTaskStatusWithDatabaseSync($taskStatus, $ttl);
    }

    /**
     * Complete summarizing phase (paired update: Redis + Database).
     */
    public function completeSummarizingPhase(AsrTaskStatusDTO $taskStatus, int $ttl = 604800): void
    {
        $taskStatus->phaseStatus = AsrTaskStatusDTO::PHASE_STATUS_COMPLETED;
        $taskStatus->phasePercent = 100;
        $taskStatus->phaseError = null;

        $this->saveTaskStatusWithDatabaseSync($taskStatus, $ttl);
    }

    /**
     * Fail summarizing phase (paired update: Redis + Database).
     */
    public function failSummarizingPhase(AsrTaskStatusDTO $taskStatus, string $error, int $ttl = 604800): void
    {
        $taskStatus->phaseStatus = AsrTaskStatusDTO::PHASE_STATUS_FAILED;
        $taskStatus->phaseError = $error;

        $this->saveTaskStatusWithDatabaseSync($taskStatus, $ttl);
    }

    /**
     * Update phase progress (paired update: Redis + Database).
     */
    public function updatePhaseProgress(AsrTaskStatusDTO $taskStatus, int $percent, int $ttl = 604800): void
    {
        $taskStatus->phasePercent = $percent;

        $this->saveTaskStatusWithDatabaseSync($taskStatus, $ttl);
    }

    // ===== Basic Operations =====

    /**
     * Save task status (Redis only, no database sync).
     *
     * @param AsrTaskStatusDTO $taskStatus 任务状态 DTO
     * @param int $ttl 过期时间（秒），默认 7 天
     */
    public function saveTaskStatus(AsrTaskStatusDTO $taskStatus, int $ttl = 604800): void
    {
        $this->asrTaskRepository->save($taskStatus, $ttl);
    }

    /**
     * Save task status with database sync (paired update).
     *
     * Strategy:
     * 1. Always write to Redis first (real-time state)
     * 2. Then sync phase state to Database (persistence)
     * 3. Database sync failure only logs error, doesn't block flow
     */
    public function saveTaskStatusWithDatabaseSync(AsrTaskStatusDTO $taskStatus, int $ttl = 604800): void
    {
        // 1. Always write to Redis first
        $this->asrTaskRepository->save($taskStatus, $ttl);

        // 2. Sync phase state to Database
        if (! empty($taskStatus->projectId)) {
            $this->syncPhaseStateToDatabase($taskStatus);
        }
    }

    /**
     * Get task status with automatic fallback (Redis → Database).
     *
     * Query strategy:
     * 1. Try Redis first (real-time state)
     * 2. Fallback to Database if Redis is empty (file import/Redis expired)
     * 3. Throw exception if both are empty
     */
    public function getTaskStatus(string $taskKey, string $userId): AsrTaskStatusDTO
    {
        // 1. Try Redis first
        $taskStatus = $this->findTaskByKey($taskKey, $userId);

        if ($taskStatus !== null) {
            return $taskStatus;
        }

        // 2. Fallback to Database
        $taskStatus = $this->rebuildFromDatabase($taskKey, $userId);

        if ($taskStatus !== null) {
            $this->logger->info('Task status rebuilt from database', [
                'task_key' => $taskKey,
                'user_id' => $userId,
            ]);
            return $taskStatus;
        }

        // 3. Not found
        ExceptionBuilder::throw(AsrErrorCode::TaskNotExist);
    }

    /**
     * Find task by key (Redis only, returns null if not found).
     */
    public function findTaskByKey(string $taskKey, string $userId): ?AsrTaskStatusDTO
    {
        return $this->asrTaskRepository->findByTaskKey($taskKey, $userId);
    }

    /**
     * Delete task heartbeat.
     */
    public function deleteTaskHeartbeat(string $taskKey, string $userId): void
    {
        $this->asrTaskRepository->deleteHeartbeat($taskKey, $userId);
    }

    /**
     * Atomic operation: Save task status with heartbeat (Redis MULTI/EXEC).
     */
    public function saveTaskStatusWithHeartbeat(
        AsrTaskStatusDTO $taskStatus,
        int $taskTtl = 604800
    ): void {
        [$taskKey, $heartbeatKey] = $this->getRedisKeys($taskStatus);

        // Use MULTI/EXEC for atomicity
        $this->redis->multi();
        $this->redis->hMSet($taskKey, $taskStatus->toArray());
        $this->redis->expire($taskKey, $taskTtl);
        // Heartbeat TTL matches task TTL to avoid premature expiration
        $this->redis->setex($heartbeatKey, $taskTtl, (string) time());
        $this->redis->exec();
    }

    /**
     * Atomic operation: Save task status and delete heartbeat (Redis MULTI/EXEC).
     */
    public function saveTaskStatusAndDeleteHeartbeat(
        AsrTaskStatusDTO $taskStatus,
        int $taskTtl = 604800
    ): void {
        [$taskKey, $heartbeatKey] = $this->getRedisKeys($taskStatus);

        // Use MULTI/EXEC for atomicity
        $this->redis->multi();
        $this->redis->hMSet($taskKey, $taskStatus->toArray());
        $this->redis->expire($taskKey, $taskTtl);
        $this->redis->del($heartbeatKey);
        $this->redis->exec();
    }

    /**
     * Rebuild task status from database.
     *
     * ⚠️ Public for use in RunTaskCallbackEventSubscriber
     */
    public function rebuildFromDatabase(string $taskKey, string $userId): ?AsrTaskStatusDTO
    {
        try {
            // Direct repository call
            $audioProject = $this->audioProjectRepository->findByTaskKey($taskKey);

            if ($audioProject === null) {
                return null;
            }

            return new AsrTaskStatusDTO([
                'task_key' => $taskKey,
                'user_id' => $userId,
                'project_id' => (string) $audioProject->getProjectId(),
                'topic_id' => (string) $audioProject->getTopicId(),
                'model_id' => $audioProject->getModelId(),
                'status' => 'completed',
                'recording_status' => 'completed',
                'current_phase' => $audioProject->getCurrentPhase(),
                'phase_status' => $audioProject->getPhaseStatus(),
                'phase_percent' => $audioProject->getPhasePercent(),
                'phase_error' => $audioProject->getPhaseError(),
                'audio_file_id' => $audioProject->getAudioFileId()
                    ? (string) $audioProject->getAudioFileId()
                    : null,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to rebuild task status from database', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Batch get task status with automatic fallback (Redis Pipeline → Database).
     *
     * Performance optimization:
     * - Use Redis Pipeline to reduce network round-trips (1 trip for N keys)
     * - Automatic fallback to database for expired/missing Redis data
     *
     * Security:
     * - Database fallback validates user permission via JOIN with project table
     *
     * @param array $taskKeys Array of task keys
     * @param string $userId User ID
     * @param string $orgCode Organization code (for permission validation)
     * @return array Associative array [task_key => AsrTaskStatusDTO|null]
     */
    public function batchGetTaskStatus(array $taskKeys, string $userId, string $orgCode): array
    {
        if (empty($taskKeys)) {
            return [];
        }

        $results = [];
        $cacheKeys = [];
        $keyMapping = []; // Map Redis key to task key

        // Build Redis keys for Pipeline
        foreach ($taskKeys as $taskKey) {
            $hash = md5($userId . ':' . $taskKey);
            $cacheKey = sprintf(AsrRedisKeys::TASK_HASH, $hash);
            $cacheKeys[] = $cacheKey;
            $keyMapping[$cacheKey] = $taskKey;
        }

        // Step 1: Use Redis Pipeline for batch query (1 network round-trip)
        $pipeline = $this->redis->pipeline();
        foreach ($cacheKeys as $cacheKey) {
            $pipeline->hGetAll($cacheKey);
        }
        $redisResults = $pipeline->exec();

        // Step 2: Parse Redis results and collect missing tasks
        $missingTaskKeys = [];
        foreach ($cacheKeys as $index => $cacheKey) {
            $taskKey = $keyMapping[$cacheKey];
            $data = $redisResults[$index];

            // Redis hit: Convert to DTO
            if (! empty($data) && is_array($data)) {
                try {
                    $results[$taskKey] = new AsrTaskStatusDTO($data);
                } catch (Throwable $e) {
                    $this->logger->warning('Failed to parse task status from Redis', [
                        'task_key' => $taskKey,
                        'error' => $e->getMessage(),
                    ]);
                    $missingTaskKeys[] = $taskKey;
                }
            } else {
                // Redis miss: Mark for database fallback
                $missingTaskKeys[] = $taskKey;
            }
        }

        // Step 3: Fallback to database for missing tasks (batch query with permission check)
        if (! empty($missingTaskKeys)) {
            $this->logger->info('Redis miss, fallback to database', [
                'user_id' => $userId,
                'org_code' => $orgCode,
                'redis_miss_count' => count($missingTaskKeys),
                'redis_hit_count' => count($results),
            ]);

            $dbResults = $this->batchRebuildFromDatabase($missingTaskKeys, $userId, $orgCode);
            $results = array_merge($results, $dbResults);
        }

        return $results;
    }

    // ===== Private Helper Methods =====

    /**
     * Sync phase state to database (direct repository call, no domain service).
     *
     * ⚠️ DDD Compliance: Directly calls repository, not AudioProjectDomainService
     */
    private function syncPhaseStateToDatabase(AsrTaskStatusDTO $taskStatus): void
    {
        try {
            $projectId = (int) $taskStatus->projectId;

            // Direct repository call (DDD compliant)
            $audioProject = $this->audioProjectRepository->findByProjectId($projectId);

            if ($audioProject === null) {
                $this->logger->warning('Audio project not found for phase sync', [
                    'project_id' => $projectId,
                    'task_key' => $taskStatus->taskKey,
                ]);
                return;
            }

            // Only update phase state fields
            $audioProject->setCurrentPhase($taskStatus->currentPhase);
            $audioProject->setPhaseStatus($taskStatus->phaseStatus);
            $audioProject->setPhasePercent($taskStatus->phasePercent);
            $audioProject->setPhaseError($taskStatus->phaseError);
            $audioProject->setTaskKey($taskStatus->taskKey);

            // Direct save via repository
            $this->audioProjectRepository->save($audioProject);

            $this->logger->debug('Phase state synced to database', [
                'project_id' => $projectId,
                'task_key' => $taskStatus->taskKey,
                'phase' => $taskStatus->currentPhase,
                'status' => $taskStatus->phaseStatus,
                'percent' => $taskStatus->phasePercent,
            ]);
        } catch (Throwable $e) {
            // Log error but don't block main flow
            $this->logger->error('Failed to sync phase state to database', [
                'project_id' => $taskStatus->projectId,
                'task_key' => $taskStatus->taskKey,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Generate Redis keys (task status and heartbeat).
     */
    private function getRedisKeys(AsrTaskStatusDTO $taskStatus): array
    {
        $hash = md5($taskStatus->userId . ':' . $taskStatus->taskKey);
        return [
            sprintf(AsrRedisKeys::TASK_HASH, $hash),
            sprintf(AsrRedisKeys::HEARTBEAT, $hash),
        ];
    }

    /**
     * Batch rebuild task status from database with permission validation.
     *
     * Security: Only returns tasks that belong to the specified user (via JOIN with project table).
     *
     * @param array $taskKeys Array of task keys that were not found in Redis
     * @param string $userId User ID
     * @param string $orgCode Organization code
     * @return array Associative array [task_key => AsrTaskStatusDTO|null]
     */
    private function batchRebuildFromDatabase(array $taskKeys, string $userId, string $orgCode): array
    {
        if (empty($taskKeys)) {
            return [];
        }

        try {
            // Batch query audio projects by task keys with permission validation (IN query + JOIN)
            $audioProjects = $this->audioProjectRepository->findByTaskKeysWithPermission(
                $taskKeys,
                $userId,
                $orgCode
            );

            $results = [];
            foreach ($taskKeys as $taskKey) {
                $audioProject = $audioProjects[$taskKey] ?? null;

                if ($audioProject === null) {
                    // Task not found or user has no permission
                    $results[$taskKey] = null;
                    continue;
                }

                // Rebuild DTO from database
                $results[$taskKey] = new AsrTaskStatusDTO([
                    'task_key' => $taskKey,
                    'user_id' => $userId,
                    'organization_code' => $orgCode,
                    'project_id' => (string) $audioProject->getProjectId(),
                    'topic_id' => (string) $audioProject->getTopicId(),
                    'model_id' => $audioProject->getModelId(),
                    'status' => 'completed',
                    'recording_status' => 'completed',
                    'current_phase' => $audioProject->getCurrentPhase(),
                    'phase_status' => $audioProject->getPhaseStatus(),
                    'phase_percent' => $audioProject->getPhasePercent(),
                    'phase_error' => $audioProject->getPhaseError(),
                    'audio_file_id' => $audioProject->getAudioFileId()
                        ? (string) $audioProject->getAudioFileId()
                        : null,
                ]);
            }

            return $results;
        } catch (Throwable $e) {
            $this->logger->error('Failed to batch rebuild from database', [
                'task_count' => count($taskKeys),
                'user_id' => $userId,
                'org_code' => $orgCode,
                'error' => $e->getMessage(),
            ]);

            // Return null for all tasks on error
            return array_fill_keys($taskKeys, null);
        }
    }
}
