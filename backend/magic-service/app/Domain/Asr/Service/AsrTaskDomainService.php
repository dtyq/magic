<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asr\Service;

use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\Speech\Enum\AsrRecordingStatusEnum;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Domain\Asr\Constants\AsrRedisKeys;
use App\Domain\Asr\Repository\AsrTaskRepository;
use App\Domain\SuperMagic\File\Entity\AudioProjectEntity;
use App\Domain\SuperMagic\File\Repository\Facade\AudioProjectRepositoryInterface;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

use function sprintf;

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
     * Start summarizing for a file_id virtual task without creating a Redis task hash.
     */
    public function startVirtualTaskSummarizingPhase(AsrTaskStatusDTO $taskStatus): void
    {
        $taskStatus->currentPhase = AsrTaskStatusDTO::PHASE_SUMMARIZING;
        $taskStatus->phaseStatus = AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS;
        $taskStatus->phasePercent = 0;
        $taskStatus->phaseError = null;

        if (! empty($taskStatus->projectId)) {
            $this->syncPhaseStateToDatabase($taskStatus);
        }
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
     * Persist and cache the task audio format without allowing format changes.
     */
    public function setAudioFormat(AsrTaskStatusDTO $taskStatus, string $audioFormat): void
    {
        $format = strtolower(ltrim(trim($audioFormat), '.'));
        if (! in_array($format, ['wav', 'opus'], true)) {
            throw new InvalidArgumentException(sprintf('Unsupported ASR audio format: %s', $audioFormat));
        }

        if (! empty($taskStatus->audioFormat) && $taskStatus->audioFormat !== $format) {
            throw new InvalidArgumentException(sprintf(
                'ASR task audio format conflict: existing=%s, requested=%s',
                $taskStatus->audioFormat,
                $format
            ));
        }

        if (! empty($taskStatus->projectId)) {
            $audioProject = $this->audioProjectRepository->findByProjectId((int) $taskStatus->projectId);
            if ($audioProject === null) {
                $this->logger->debug('Skip audio project audio format persistence', [
                    'project_id' => $taskStatus->projectId,
                    'task_key' => $taskStatus->taskKey,
                    'reason' => 'audio_project_not_exists',
                ]);
            } else {
                $persisted = $audioProject->getAudioFormat();
                if ($persisted !== null && $persisted !== $format) {
                    throw new InvalidArgumentException(sprintf(
                        'Persisted ASR audio format conflict: existing=%s, requested=%s',
                        $persisted,
                        $format
                    ));
                }

                $this->audioProjectRepository->setAudioFormatIfUnset(
                    (int) $taskStatus->projectId,
                    $format
                );
            }
        }

        $taskStatus->audioFormat = $format;
        $this->saveTaskStatus($taskStatus);
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
        $redisSaved = $this->asrTaskRepository->save($taskStatus, $ttl);

        if (! $redisSaved) {
            $this->logger->error('Redis write failed in saveTaskStatusWithDatabaseSync — Redis/DB may be inconsistent', [
                'task_key' => $taskStatus->taskKey,
                'phase_status' => $taskStatus->phaseStatus,
                'current_phase' => $taskStatus->currentPhase,
                'project_id' => $taskStatus->projectId,
            ]);
        }

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
     * Get task status with permission-checked database fallback.
     */
    public function getTaskStatusWithPermission(string $taskKey, string $userId, string $orgCode): AsrTaskStatusDTO
    {
        $taskStatus = $this->findTaskByKey($taskKey, $userId);
        if ($taskStatus !== null) {
            return $taskStatus;
        }

        $results = $this->batchRebuildFromDatabase([$taskKey], $userId, $orgCode);
        $taskStatus = $results[$taskKey] ?? null;
        if ($taskStatus !== null) {
            $this->logger->info('Task status rebuilt from database with permission check', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'org_code' => $orgCode,
            ]);
            return $taskStatus;
        }

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

            return $this->buildTaskStatusFromAudioProject($audioProject, $taskKey, $userId);
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
     * Sync phase state to database via partial update (direct repository call, no domain service).
     *
     * Uses updateByProjectId() instead of load-modify-save to avoid overwriting
     * concurrently-written fields (e.g. audio_file_id set by updateRecordingMetadata).
     *
     * ⚠️ DDD Compliance: Directly calls repository, not AudioProjectDomainService
     */
    private function syncPhaseStateToDatabase(AsrTaskStatusDTO $taskStatus): void
    {
        try {
            $projectId = (int) $taskStatus->projectId;

            // Partial update: only touch phase-related columns, never overwrite other fields
            $affected = $this->audioProjectRepository->updateByProjectId($projectId, [
                'current_phase' => $taskStatus->currentPhase,
                'phase_status' => $taskStatus->phaseStatus,
                'phase_percent' => $taskStatus->phasePercent,
                'phase_error' => $taskStatus->phaseError,
                'task_key' => $taskStatus->taskKey,
            ]);

            if ($affected === 0) {
                $this->logger->warning('Phase state sync affected 0 rows, audio project may not exist', [
                    'project_id' => $projectId,
                    'task_key' => $taskStatus->taskKey,
                ]);
                return;
            }

            $this->logger->debug('Phase state synced to database', [
                'project_id' => $projectId,
                'task_key' => $taskStatus->taskKey,
                'phase' => $taskStatus->currentPhase,
                'status' => $taskStatus->phaseStatus,
                'percent' => $taskStatus->phasePercent,
            ]);
        } catch (Throwable $e) {
            // Log error but don't block main flow; Redis is source of truth for live state
            $this->logger->error('Failed to sync phase state to database — Redis/DB may be inconsistent', [
                'project_id' => $taskStatus->projectId,
                'task_key' => $taskStatus->taskKey,
                'phase' => $taskStatus->currentPhase,
                'status' => $taskStatus->phaseStatus,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
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
                $results[$taskKey] = $this->buildTaskStatusFromAudioProject($audioProject, $taskKey, $userId, $orgCode);
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

    private function buildTaskStatusFromAudioProject(
        AudioProjectEntity $audioProject,
        string $taskKey,
        string $userId,
        ?string $orgCode = null
    ): AsrTaskStatusDTO {
        $audioFileId = $audioProject->getAudioFileId();
        $asrExtra = $this->extractAsrExtra($audioProject);
        $sandbox = $this->getArraySection($asrExtra, 'sandbox');
        $directories = $this->getArraySection($asrExtra, 'directories');
        $finish = $this->getArraySection($asrExtra, 'finish');
        $presetFiles = $this->getArraySection($asrExtra, 'preset_files');
        $resultFiles = $this->getArraySection($asrExtra, 'result_files');

        return new AsrTaskStatusDTO([
            'task_key' => $taskKey,
            'user_id' => $userId,
            'organization_code' => $orgCode,
            'project_id' => (string) $audioProject->getProjectId(),
            'topic_id' => (string) $audioProject->getTopicId(),
            'model_id' => $audioProject->getModelId(),
            'status' => $this->resolveTaskStatusFromAudioProject($audioProject)->value,
            'recording_status' => $this->resolveRecordingStatusFromAudioProject($audioProject),
            'current_phase' => $audioProject->getCurrentPhase(),
            'phase_status' => $audioProject->getPhaseStatus(),
            'phase_percent' => $audioProject->getPhasePercent(),
            'phase_error' => $audioProject->getPhaseError(),
            'audio_file_id' => $audioFileId === null ? null : (string) $audioFileId,
            'audio_format' => $audioProject->getAudioFormat(),
            'sandbox_topic_id' => $sandbox['sandbox_topic_id'] ?? null,
            'sandbox_id' => $sandbox['sandbox_id'] ?? null,
            'sandbox_task_created' => $sandbox['sandbox_task_created'] ?? ! empty($sandbox['sandbox_id'] ?? null),
            'sandbox_merge_completed' => $sandbox['merge_completed'] ?? false,
            'sandbox_merge_duration' => $sandbox['merge_duration'] ?? null,
            'sandbox_merge_file_size' => $sandbox['merge_file_size'] ?? null,
            'sandbox_finish_response_json' => $sandbox['finish_response_json'] ?? null,
            'temp_hidden_directory' => $directories['temp_hidden_directory'] ?? null,
            'temp_hidden_directory_id' => $directories['temp_hidden_directory_id'] ?? null,
            'display_directory' => $directories['display_directory'] ?? null,
            'display_directory_id' => $directories['display_directory_id'] ?? null,
            'preset_note_file_id' => $presetFiles['note_file_id'] ?? null,
            'preset_note_file_path' => $presetFiles['note_file_path'] ?? null,
            'preset_transcript_file_id' => $presetFiles['transcript_file_id'] ?? null,
            'preset_transcript_file_path' => $presetFiles['transcript_file_path'] ?? null,
            'preset_marker_file_id' => $presetFiles['marker_file_id'] ?? null,
            'preset_marker_file_path' => $presetFiles['marker_file_path'] ?? null,
            'file_path' => $resultFiles['audio_file_path'] ?? null,
            'note_file_id' => $resultFiles['note_file_id'] ?? null,
            'note_file_name' => $resultFiles['note_file_name'] ?? null,
            'marker_file_id' => $resultFiles['marker_file_id'] ?? null,
            'marker_file_name' => $resultFiles['marker_file_name'] ?? null,
            'finish_output_filename' => $finish['output_filename'] ?? null,
            'expected_audio_file_name' => $finish['expected_audio_file_name'] ?? null,
            'file_shard_count' => $finish['file_shard_count'] ?? null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function extractAsrExtra(AudioProjectEntity $audioProject): array
    {
        $extra = $audioProject->getExtra();
        if (! is_array($extra)) {
            return [];
        }

        $asrExtra = $extra['asr'] ?? null;
        return is_array($asrExtra) ? $asrExtra : [];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function getArraySection(array $data, string $key): array
    {
        $section = $data[$key] ?? null;
        return is_array($section) ? $section : [];
    }

    private function resolveTaskStatusFromAudioProject(AudioProjectEntity $audioProject): AsrTaskStatusEnum
    {
        $currentPhase = $audioProject->getCurrentPhase();
        $phaseStatus = $audioProject->getPhaseStatus();

        if ($phaseStatus === AsrTaskStatusDTO::PHASE_STATUS_FAILED) {
            return AsrTaskStatusEnum::FAILED;
        }

        if ($currentPhase === AsrTaskStatusDTO::PHASE_SUMMARIZING) {
            return $phaseStatus === AsrTaskStatusDTO::PHASE_STATUS_COMPLETED
                ? AsrTaskStatusEnum::COMPLETED
                : AsrTaskStatusEnum::PROCESSING;
        }

        if ($audioProject->getAudioFileId() !== null) {
            return AsrTaskStatusEnum::AUDIO_PROCESSED;
        }

        if ($phaseStatus === AsrTaskStatusDTO::PHASE_STATUS_IN_PROGRESS) {
            return AsrTaskStatusEnum::PROCESSING;
        }

        return AsrTaskStatusEnum::CREATED;
    }

    private function resolveRecordingStatusFromAudioProject(AudioProjectEntity $audioProject): ?string
    {
        if ($audioProject->getAudioFileId() !== null) {
            return AsrRecordingStatusEnum::STOPPED->value;
        }

        if (in_array($audioProject->getCurrentPhase(), [
            AsrTaskStatusDTO::PHASE_MERGING,
            AsrTaskStatusDTO::PHASE_SUMMARIZING,
        ], true)) {
            return AsrRecordingStatusEnum::STOPPED->value;
        }

        return null;
    }
}
