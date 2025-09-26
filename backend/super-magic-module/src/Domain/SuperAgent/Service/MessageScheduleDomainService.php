<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageScheduleEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\MessageScheduleRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

use function Hyperf\Translation\trans;

/**
 * Message Schedule Domain Service.
 */
class MessageScheduleDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly MessageScheduleRepositoryInterface $messageScheduleRepository,
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
        int $status,
        array $timeConfig
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
            ->setStatus($status)
            ->setTimeConfig($timeConfig)
            ->setCreatedUid($userId)
            ->setUpdatedUid($userId)
            ->setCreatedAt($currentTime)
            ->setUpdatedAt($currentTime);

        return $this->messageScheduleRepository->create($messageSchedule);
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
        string $orderDirection = 'desc'
    ): array {
        return $this->messageScheduleRepository->getMessageSchedulesByConditions(
            $conditions,
            $page,
            $pageSize,
            $orderBy,
            $orderDirection
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
}
