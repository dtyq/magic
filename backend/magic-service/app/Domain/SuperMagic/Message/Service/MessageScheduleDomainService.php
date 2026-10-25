<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Message\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Message\Entity\MessageScheduleEntity;
use App\Domain\SuperMagic\Message\Entity\MessageScheduleLogEntity;
use App\Domain\SuperMagic\Message\Repository\Facade\MessageScheduleLogRepositoryInterface;
use App\Domain\SuperMagic\Message\Repository\Facade\MessageScheduleRepositoryInterface;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;

use function Hyperf\Translation\trans;

/**
 * Message Schedule Domain Service.
 */
class MessageScheduleDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly MessageScheduleRepositoryInterface $messageScheduleRepository,
        private readonly MessageScheduleLogRepositoryInterface $messageScheduleLogRepository,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('message_schedule');
    }

    /**
     * Get message schedule by ID.
     */
    public function getMessageScheduleById(int $id): ?MessageScheduleEntity
    {
        return $this->messageScheduleRepository->findById($id);
    }

    /** @return MessageScheduleEntity[] */
    public function getCleanupCandidates(int $afterId, int $limit, ?string $organizationCode = null, array $projectIds = []): array
    {
        return $this->messageScheduleRepository->getCleanupCandidates($afterId, $limit, $organizationCode, $projectIds);
    }

    public function getMessageScheduleForCleanup(int $id): ?MessageScheduleEntity
    {
        return $this->messageScheduleRepository->findByIdForCleanup($id);
    }

    public function isProjectAvailableForCleanup(int $projectId): bool
    {
        return $this->messageScheduleRepository->isProjectAvailableForCleanup($projectId);
    }

    public function markDeletedForCleanup(int $id, string $updatedUid): void
    {
        $this->messageScheduleRepository->markDeletedForCleanup($id, $updatedUid);
    }

    public function getMessageScheduleByIdForUpdate(int $id): ?MessageScheduleEntity
    {
        return $this->messageScheduleRepository->findByIdForUpdate($id);
    }

    /** Update only execution-owned fields; never save the execution's stale configuration. */
    public function updateScheduleExecutionState(MessageScheduleEntity $schedule, ?int $completed = null, ?int $enabled = null): void
    {
        $data = [
            'updated_at' => date('Y-m-d H:i:s'),
            'updated_uid' => $schedule->getUserId(),
        ];
        if ($completed !== null) {
            $data['completed'] = $completed;
        }
        if ($enabled !== null) {
            $data['enabled'] = $enabled;
        }
        $updated = $this->messageScheduleRepository->updateMessageScheduleByCondition([
            'id' => $schedule->getId(),
            'user_id' => $schedule->getUserId(),
            'organization_code' => $schedule->getOrganizationCode(),
        ], $data);
        if (! $updated && (($completed !== null && $completed !== $schedule->getCompleted())
            || ($enabled !== null && $enabled !== $schedule->getEnabled()))) {
            throw new RuntimeException('Unable to update schedule execution state');
        }
    }

    /**
     * Get message schedule by ID with user validation.
     */
    public function getMessageScheduleByIdWithValidation(DataIsolation $dataIsolation, int $id): MessageScheduleEntity
    {
        $messageSchedule = $this->messageScheduleRepository->findById($id);
        if (! $messageSchedule) {
            ExceptionBuilder::throw(SuperAgentErrorCode::MESSAGE_SCHEDULE_NOT_FOUND, trans('message_schedule.not_found'));
        }

        // Check ownership
        if ($messageSchedule->getUserId() !== $dataIsolation->getCurrentUserId()
            || $messageSchedule->getOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::MESSAGE_SCHEDULE_ACCESS_DENIED, trans('message_schedule.access_denied'));
        }

        return $messageSchedule;
    }

    /**
     * Create message schedule.
     */
    public function createMessageSchedule(
        DataIsolation $dataIsolation,
        string $taskName,
        string $messageType,
        array $messageContent,
        int $workspaceId,
        int $projectId,
        int $topicId,
        int $completed,
        int $enabled,
        ?string $deadline,
        string $remark,
        array $timeConfig,
        ?array $plugins = null
    ): MessageScheduleEntity {
        $currentTime = date('Y-m-d H:i:s');
        $userId = $dataIsolation->getCurrentUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        $messageSchedule = new MessageScheduleEntity();
        $messageSchedule->setUserId($userId)
            ->setOrganizationCode($organizationCode)
            ->setTaskName($taskName)
            ->setMessageType($messageType)
            ->setMessageContent($messageContent)
            ->setWorkspaceId($workspaceId)
            ->setProjectId($projectId)
            ->setTopicId($topicId)
            ->setCompleted($completed)
            ->setEnabled($enabled)
            ->setDeadline($deadline)
            ->setRemark($remark)
            ->setTimeConfig($timeConfig)
            ->setPlugins($plugins)
            ->setCreatedUid($userId)
            ->setUpdatedUid($userId)
            ->setCreatedAt($currentTime)
            ->setUpdatedAt($currentTime);

        return $this->messageScheduleRepository->create($messageSchedule);
    }

    /**
     * Create message schedule from entity (single parameter, DDD-style).
     * Caller (Application) builds entity via Factory; Domain only validates and persists.
     */
    public function create(DataIsolation $dataIsolation, MessageScheduleEntity $entity): MessageScheduleEntity
    {
        $userId = $dataIsolation->getCurrentUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $entity->setUserId($userId);
        $entity->setOrganizationCode($organizationCode);
        return $this->messageScheduleRepository->create($entity);
    }

    /**
     * Update message schedule.
     */
    public function updateMessageSchedule(DataIsolation $dataIsolation, MessageScheduleEntity $messageSchedule): MessageScheduleEntity
    {
        // Check ownership
        if ($messageSchedule->getUserId() !== $dataIsolation->getCurrentUserId()
            || $messageSchedule->getOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::MESSAGE_SCHEDULE_ACCESS_DENIED, trans('message_schedule.access_denied'));
        }

        $messageSchedule->setUpdatedUid($dataIsolation->getCurrentUserId())
            ->setUpdatedAt(date('Y-m-d H:i:s'));

        return $this->messageScheduleRepository->save($messageSchedule);
    }

    /**
     * Delete message schedule.
     */
    public function deleteMessageSchedule(DataIsolation $dataIsolation, int $id): bool
    {
        $messageSchedule = $this->getMessageScheduleByIdWithValidation($dataIsolation, $id);

        return $this->messageScheduleRepository->delete($messageSchedule);
    }

    /**
     * Get message schedules by conditions with pagination.
     */
    public function getMessageSchedulesByConditions(
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'updated_at',
        string $orderDirection = 'desc',
        array $selectFields = []
    ): array {
        return $this->messageScheduleRepository->getMessageSchedulesByConditions(
            $conditions,
            $page,
            $pageSize,
            $orderBy,
            $orderDirection,
            $selectFields
        );
    }

    /**
     * Update task scheduler crontab ID.
     */
    public function updateTaskSchedulerCrontabId(int $id, ?int $taskSchedulerCrontabId): bool
    {
        $this->logger->info('Update task scheduler crontab ID', ['id' => $id, 'taskSchedulerCrontabId' => $taskSchedulerCrontabId]);
        return $this->messageScheduleRepository->updateTaskSchedulerCrontabId($id, $taskSchedulerCrontabId);
    }

    /**
     * Find message schedule by task scheduler crontab ID.
     */
    public function findByTaskSchedulerCrontabId(int $taskSchedulerCrontabId): ?MessageScheduleEntity
    {
        return $this->messageScheduleRepository->findByTaskSchedulerCrontabId($taskSchedulerCrontabId);
    }

    /**
     * Get enabled message schedules for a user.
     */
    public function getEnabledMessageSchedules(DataIsolation $dataIsolation): array
    {
        return $this->messageScheduleRepository->getEnabledMessageSchedules(
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );
    }

    /**
     * Enable message schedule.
     */
    public function enableMessageSchedule(DataIsolation $dataIsolation, int $id): bool
    {
        $messageSchedule = $this->getMessageScheduleByIdWithValidation($dataIsolation, $id);

        $messageSchedule->enable()
            ->setUpdatedUid($dataIsolation->getCurrentUserId())
            ->setUpdatedAt(date('Y-m-d H:i:s'));

        $this->messageScheduleRepository->save($messageSchedule);
        return true;
    }

    /**
     * Disable message schedule.
     */
    public function disableMessageSchedule(DataIsolation $dataIsolation, int $id): bool
    {
        $messageSchedule = $this->getMessageScheduleByIdWithValidation($dataIsolation, $id);

        $messageSchedule->disable()
            ->setUpdatedUid($dataIsolation->getCurrentUserId())
            ->setUpdatedAt(date('Y-m-d H:i:s'));

        $this->messageScheduleRepository->save($messageSchedule);
        return true;
    }

    /**
     * Get message schedules by workspace ID.
     */
    public function getMessageSchedulesByWorkspaceId(DataIsolation $dataIsolation, int $workspaceId): array
    {
        return $this->messageScheduleRepository->getMessageSchedulesByWorkspaceId(
            $workspaceId,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );
    }

    /**
     * Get message schedules by project ID.
     */
    public function getMessageSchedulesByProjectId(DataIsolation $dataIsolation, int $projectId): array
    {
        return $this->messageScheduleRepository->getMessageSchedulesByProjectId(
            $projectId,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );
    }

    /**
     * Get message schedules by topic ID.
     */
    public function getMessageSchedulesByTopicId(DataIsolation $dataIsolation, int $topicId): array
    {
        return $this->messageScheduleRepository->getMessageSchedulesByTopicId(
            $topicId,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );
    }

    /**
     * Validate message schedule ownership and return entity.
     */
    public function validateMessageScheduleOwnership(DataIsolation $dataIsolation, int $id): MessageScheduleEntity
    {
        return $this->getMessageScheduleByIdWithValidation($dataIsolation, $id);
    }

    /**
     * Batch update message schedules by workspace ID.
     */
    public function batchUpdateByWorkspaceId(DataIsolation $dataIsolation, int $workspaceId, array $data): int
    {
        $conditions = [
            'workspace_id' => $workspaceId,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
        ];

        return $this->messageScheduleRepository->batchUpdateByCondition($conditions, $data);
    }

    /**
     * Batch update message schedules by project ID.
     */
    public function batchUpdateByProjectId(DataIsolation $dataIsolation, int $projectId, array $data): int
    {
        $conditions = [
            'project_id' => $projectId,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
        ];

        return $this->messageScheduleRepository->batchUpdateByCondition($conditions, $data);
    }

    /**
     * Batch update message schedules by topic ID.
     */
    public function batchUpdateByTopicId(DataIsolation $dataIsolation, int $topicId, array $data): int
    {
        $conditions = [
            'topic_id' => $topicId,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
        ];

        return $this->messageScheduleRepository->batchUpdateByCondition($conditions, $data);
    }

    /**
     * Sync message schedules after project/workspace ownership transfer.
     */
    public function syncTransferredProjectSchedules(
        array $projectIds,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        int $workspaceId,
        string $updatedUid
    ): int {
        $projectIds = $this->normalizeProjectIds($projectIds);
        if (empty($projectIds)) {
            return 0;
        }

        return $this->messageScheduleRepository->batchUpdateOwnerAndWorkspaceByProjectIds(
            $projectIds,
            $fromUserId,
            $toUserId,
            $organizationCode,
            $workspaceId,
            $updatedUid,
            date('Y-m-d H:i:s')
        );
    }

    /**
     * Sync message schedule workspace after project move.
     */
    public function syncMovedProjectSchedules(
        array $projectIds,
        string $userId,
        string $organizationCode,
        int $workspaceId,
        string $updatedUid
    ): int {
        $projectIds = $this->normalizeProjectIds($projectIds);
        if (empty($projectIds)) {
            return 0;
        }

        return $this->messageScheduleRepository->batchUpdateWorkspaceByProjectIds(
            $projectIds,
            $userId,
            $organizationCode,
            $workspaceId,
            $updatedUid,
            date('Y-m-d H:i:s')
        );
    }

    // ===== Message Schedule Log Methods =====

    /**
     * Create execution log for message schedule.
     */
    public function createExecutionLog(MessageScheduleEntity $messageSchedule): MessageScheduleLogEntity
    {
        $currentTime = date('Y-m-d H:i:s');

        $logEntity = new MessageScheduleLogEntity();
        $logEntity->setMessageScheduleId($messageSchedule->getId())
            ->setWorkspaceId($messageSchedule->getWorkspaceId())
            ->setProjectId(0)
            ->setTopicId(0)
            ->setTaskName($messageSchedule->getTaskName())
            ->setStatus(MessageScheduleLogEntity::STATUS_RUNNING)
            ->setExecutedAt($currentTime);

        return $this->messageScheduleLogRepository->create($logEntity);
    }

    /**
     * Update execution log status to success.
     */
    public function markLogAsSuccess(int $logId): bool
    {
        return $this->messageScheduleLogRepository->updateStatus($logId, MessageScheduleLogEntity::STATUS_SUCCESS);
    }

    /**
     * Update execution log status to failed.
     */
    public function markLogAsFailed(int $logId, ?string $errorMessage = null): bool
    {
        return $this->messageScheduleLogRepository->updateStatus($logId, MessageScheduleLogEntity::STATUS_FAILED, $errorMessage);
    }

    /**
     * Get execution logs by message schedule ID.
     */
    public function getExecutionLogs(int $messageScheduleId): array
    {
        return $this->messageScheduleLogRepository->findByMessageScheduleId($messageScheduleId);
    }

    /**
     * Get execution logs with pagination.
     */
    public function getExecutionLogsByConditions(
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'executed_at',
        string $orderDirection = 'desc'
    ): array {
        return $this->messageScheduleLogRepository->getLogsByConditions(
            $conditions,
            $page,
            $pageSize,
            $orderBy,
            $orderDirection
        );
    }

    /**
     * Update execution log details.
     */
    public function updateExecutionLogDetails(int $executionLogId, array $updateData): bool
    {
        return $this->messageScheduleLogRepository->updateExecutionLogDetails($executionLogId, $updateData);
    }

    /**
     * @param array<int|string> $projectIds
     * @return int[]
     */
    private function normalizeProjectIds(array $projectIds): array
    {
        $normalized = [];
        foreach ($projectIds as $projectId) {
            $projectId = (int) $projectId;
            if ($projectId > 0) {
                $normalized[$projectId] = $projectId;
            }
        }

        return array_values($normalized);
    }
}
