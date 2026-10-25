<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Message\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAccessAppService;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Application\SuperMagic\Message\Chat\Service\ChatAppService;
use App\Application\SuperMagic\Task\Assembler\TaskConfigAssembler;
use App\Domain\Chat\DTO\Message\MagicMessageStruct;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Service\MagicClawRuntimePolicyDomainService;
use App\Domain\SuperMagic\Common\Entity\ValueObject\CreationSource;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\Common\Entity\ValueObject\SuperMagicExecutionSource;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileType;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Message\Entity\MessageScheduleEntity;
use App\Domain\SuperMagic\Message\Service\MessageScheduleDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Exception\TransactionCommitOutcomeUnknownException;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use App\Interfaces\SuperMagic\Common\DTO\Request\TimeConfigDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\CreateMessageScheduleRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\QueryMessageScheduleLogsRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\QueryMessageScheduleRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\UpdateMessageScheduleRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Response\MessageScheduleItemDTO;
use App\Interfaces\SuperMagic\Message\DTO\Response\MessageScheduleListItemDTO;
use App\Interfaces\SuperMagic\Message\DTO\Response\MessageScheduleLogItemDTO;
use Cron\CronExpression;
use DateTime;
use Dtyq\TaskScheduler\Entity\TaskScheduler;
use Dtyq\TaskScheduler\Entity\TaskSchedulerCrontab;
use Dtyq\TaskScheduler\Entity\ValueObject\TaskType;
use Dtyq\TaskScheduler\Service\TaskSchedulerDomainService;
use Exception;
use Hyperf\Context\ApplicationContext;
use Hyperf\Database\Connection as DatabaseConnection;
use Hyperf\Database\Connectors\ConnectionFactory;
use Hyperf\DbConnection\Connection;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Message Schedule Application Service.
 */
class MessageScheduleAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly MagicChatMessageAppService $chatMessageAppService,
        private readonly ChatAppService $chatAppService,
        private readonly MessageScheduleDomainService $messageScheduleDomainService,
        private readonly UserMessageToAgentAppService $userMessageToAgentAppService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly TaskSchedulerDomainService $taskSchedulerDomainService,
        private readonly MagicUserSettingDomainService $magicUserSettingDomainService,
        private readonly SuperMagicAgentAccessAppService $superMagicAgentAccessAppService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Message schedule callback method (task scheduler entry point).
     */
    public static function messageScheduleCallback(int $message_schedule_id): array
    {
        try {
            if (empty($message_schedule_id)) {
                return [
                    'success' => false,
                    'message' => 'Message schedule ID is required',
                ];
            }

            // Create application service instance
            $appService = di(self::class);
            return $appService->executeMessageSchedule($message_schedule_id);
        } catch (Throwable $e) {
            simple_logger('MessageScheduleCallback')->error('Message schedule callback failed', [
                'message_schedule_id' => $message_schedule_id,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return [
                'success' => false,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Create schedule.
     */
    public function createSchedule(RequestContext $requestContext, CreateMessageScheduleRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createDataIsolationFromContext($requestContext);

        // Check project permission
        $this->getAccessibleProjectWithEditor((int) $requestDTO->getProjectId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());
        $this->assertMessageContentAgentAccess($dataIsolation, $requestDTO->getMessageContent());

        try {
            return Db::transaction(function () use ($requestDTO, $dataIsolation) {
                // Validate resource permissions
                $this->validateResourcePermissions(
                    $dataIsolation,
                    $requestDTO->getWorkspaceId(), // Keep as string to support "collaboration"
                    $requestDTO->getProjectId() ? (int) $requestDTO->getProjectId() : null,
                    $requestDTO->getTopicId() ? (int) $requestDTO->getTopicId() : null
                );

                // Convert collaboration to 0 for database storage
                $workspaceIdForDb = $requestDTO->getWorkspaceId() === 'collaboration'
                    ? 0
                    : (int) $requestDTO->getWorkspaceId();

                // 2.1 Create message schedule
                $messageSchedule = $this->messageScheduleDomainService->createMessageSchedule(
                    $dataIsolation,
                    $requestDTO->getTaskName(),
                    $requestDTO->getMessageType(),
                    $requestDTO->getMessageContent(),
                    $workspaceIdForDb, // Use converted value
                    (int) $requestDTO->getProjectId(),
                    (int) $requestDTO->getTopicId(),
                    $requestDTO->getCompleted(),
                    $requestDTO->getEnabled(),
                    $requestDTO->getDeadline(),
                    $requestDTO->getRemark(),
                    $requestDTO->getTimeConfig(),
                    $requestDTO->getPlugins()
                );

                // 2.2 Validate time configuration
                $timeConfigDTO = $requestDTO->createTimeConfigDTO();
                $validationErrors = $timeConfigDTO->getValidationErrors();
                if (! empty($validationErrors)) {
                    throw new InvalidArgumentException(implode(', ', $validationErrors));
                }

                // 2.3 Create task scheduler
                $taskSchedulerId = $this->createTaskScheduler(
                    $messageSchedule->getId(),
                    $timeConfigDTO,
                    $messageSchedule->isEnabled(),
                    $requestDTO->getDeadline(), // Priority deadline from request
                    $requestDTO->getTaskName() // Task name from request
                );

                // 2.4 Update task_scheduler_crontab_id and completed status in one update
                if ($taskSchedulerId) {
                    // Set crontab_id in memory (no need to reload from database)
                    $messageSchedule->setTaskSchedulerCrontabId($taskSchedulerId);
                }

                // 2.5 Check if task should be marked as completed (for expired tasks)
                $shouldComplete = $this->shouldMarkAsCompleted($messageSchedule);
                $messageSchedule->setCompleted($shouldComplete ? 1 : 0);

                // Batch update: crontab_id and completed status in one query
                $this->messageScheduleDomainService->updateMessageSchedule($dataIsolation, $messageSchedule);

                return [
                    'id' => (string) $messageSchedule->getId(),
                ];
            });
        } catch (InvalidArgumentException $e) {
            // Parameter validation exception: show specific error message
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                $e->getMessage()
            );
        } catch (BusinessException $e) {
            // Business exception: re-throw to preserve error message
            throw $e;
        } catch (Throwable $e) {
            // System exception: log details and show generic error message
            $this->logger->error('Schedule create operation system exception', [
                'operation' => 'createSchedule',
                'user_id' => $requestContext->getUserId(),
                'organization_code' => $requestContext->getOrganizationCode(),
                'error' => $e->getMessage(),
            ]);

            ExceptionBuilder::throw(
                GenericErrorCode::SystemError,
                trans('common.system_exception')
            );
        }
    }

    /**
     * Query schedules (optimized for list queries with limited fields).
     */
    public function querySchedules(RequestContext $requestContext, QueryMessageScheduleRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createDataIsolationFromContext($requestContext);

        // Check project permission
        if (! empty($requestDTO->getProjectId())) {
            $this->getAccessibleProject((int) $requestDTO->getProjectId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());
        }
        $conditions = $requestDTO->buildConditions(
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );

        // Define specific fields for list queries to optimize performance
        $listFields = [
            'id', 'user_id', 'organization_code', 'task_name',
            'workspace_id', 'project_id', 'topic_id',
            'completed', 'enabled', 'deadline', 'time_config', 'updated_at',
        ];

        // Use existing method with specific fields for list queries
        $result = $this->messageScheduleDomainService->getMessageSchedulesByConditions(
            $conditions,
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
            $requestDTO->getOrderBy(),
            $requestDTO->getOrderDirection(),
            $listFields
        );

        // Extract unique IDs for batch name fetching
        $workspaceIds = [];
        $projectIds = [];
        $topicIds = [];

        foreach ($result['list'] as $entity) {
            $workspaceIds[] = $entity->getWorkspaceId();
            if ($entity->getProjectId()) {
                $projectIds[] = $entity->getProjectId();
            }
            if ($entity->getTopicId()) {
                $topicIds[] = $entity->getTopicId();
            }
        }

        // Remove duplicates
        $workspaceIds = array_unique($workspaceIds);
        $projectIds = array_unique($projectIds);
        $topicIds = array_unique($topicIds);

        // Remove 0 (collaboration workspace) from workspace IDs before batch fetching
        $workspaceIds = array_filter($workspaceIds, fn ($id) => $id > 0);

        // Batch get names
        $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);
        $projectNameMap = $this->projectDomainService->getProjectNamesBatch($projectIds);
        $topicNameMap = $this->topicDomainService->getTopicNamesBatch($topicIds);

        // Convert entities to DTOs with names
        $list = [];
        foreach ($result['list'] as $entity) {
            // For collaboration workspace (id=0), set name as "Collaboration"
            $workspaceName = $entity->getWorkspaceId() === 0
                ? 'Collaboration'
                : ($workspaceNameMap[$entity->getWorkspaceId()] ?? '');
            $projectName = $entity->getProjectId() ? ($projectNameMap[$entity->getProjectId()] ?? '') : '';
            $topicName = $entity->getTopicId() ? ($topicNameMap[$entity->getTopicId()] ?? '') : '';

            $dto = MessageScheduleListItemDTO::fromEntity($entity, $workspaceName, $projectName, $topicName);
            $list[] = $dto->toArray();
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    /**
     * Update schedule.
     */
    public function updateSchedule(RequestContext $requestContext, int $id, UpdateMessageScheduleRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createDataIsolationFromContext($requestContext);

        // Get existing message schedule
        $messageSchedule = $this->messageScheduleDomainService->getMessageScheduleByIdWithValidation($dataIsolation, $id);
        $this->assertMessageContentAgentAccess(
            $dataIsolation,
            $requestDTO->getMessageContent() === [] ? $messageSchedule->getMessageContent() : $requestDTO->getMessageContent()
        );

        // Check project permission (only if project_id is set)
        if ($messageSchedule->getProjectId() > 0) {
            $this->getAccessibleProjectWithEditor($messageSchedule->getProjectId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());
        }

        try {
            return Db::transaction(function () use ($id, $requestDTO, $dataIsolation, $messageSchedule) {
                // Validate permissions for new resource IDs (if provided)
                $currentWorkspaceId = $messageSchedule->getWorkspaceId();
                $currentProjectId = $messageSchedule->getProjectId();
                $currentTopicId = $messageSchedule->getTopicId();

                // Process new workspace ID
                $newWorkspaceIdRaw = null;
                $newWorkspaceIdForDb = $currentWorkspaceId;

                if (! empty($requestDTO->getWorkspaceId())) {
                    $newWorkspaceIdRaw = $requestDTO->getWorkspaceId();
                    $newWorkspaceIdForDb = $newWorkspaceIdRaw === 'collaboration' ? 0 : (int) $newWorkspaceIdRaw;
                }

                $newProjectId = $requestDTO->projectId !== null ? (int) $requestDTO->getProjectId() : $currentProjectId;
                $newTopicId = $requestDTO->topicId !== null ? (int) $requestDTO->getTopicId() : $currentTopicId;

                // Check if resource IDs have changed, and validate permissions for new resources
                if ($newWorkspaceIdForDb !== $currentWorkspaceId
                    || $newProjectId !== $currentProjectId
                    || $newTopicId !== $currentTopicId) {
                    // Use raw value for validation (string or int)
                    $workspaceIdForValidation = $newWorkspaceIdRaw ?? (
                        $currentWorkspaceId === 0 ? 'collaboration' : $currentWorkspaceId
                    );

                    $this->validateResourcePermissions(
                        $dataIsolation,
                        $workspaceIdForValidation,
                        $newProjectId > 0 ? $newProjectId : null,
                        $newTopicId > 0 ? $newTopicId : null
                    );
                }

                $needUpdateTaskScheduler = false;

                // Update fields
                if (! empty($requestDTO->getTaskName())) {
                    $messageSchedule->setTaskName($requestDTO->getTaskName());
                }

                // Update workspace ID
                if ($newWorkspaceIdRaw !== null && $newWorkspaceIdForDb !== $currentWorkspaceId) {
                    $messageSchedule->setWorkspaceId($newWorkspaceIdForDb);
                    $needUpdateTaskScheduler = true;
                }

                // Update project ID (check raw property to detect empty string)
                if ($requestDTO->projectId !== null && $newProjectId !== $currentProjectId) {
                    $messageSchedule->setProjectId($newProjectId);
                }

                // Update topic ID (check raw property to detect empty string)
                if ($requestDTO->topicId !== null && $newTopicId !== $currentTopicId) {
                    $messageSchedule->setTopicId($newTopicId);
                }

                if (! empty($requestDTO->getMessageType())) {
                    $messageSchedule->setMessageType($requestDTO->getMessageType());
                }

                if (! empty($requestDTO->getMessageContent())) {
                    $messageSchedule->setMessageContent($requestDTO->getMessageContent());
                }

                // Check if status fields changed
                if ($requestDTO->getEnabled() !== null) {
                    $oldEnabled = $messageSchedule->getEnabled();
                    $messageSchedule->setEnabled($requestDTO->getEnabled());

                    if ($oldEnabled !== $requestDTO->getEnabled()) {
                        $needUpdateTaskScheduler = true;
                    }
                }

                // Check if deadline changed (check raw property to detect empty string)
                // Note: We check $requestDTO->deadline directly because getDeadline() converts empty string to null
                if ($requestDTO->deadline !== null) {
                    $oldDeadline = $messageSchedule->getDeadline();
                    $newDeadline = $requestDTO->getDeadline();  // This converts empty string to null

                    // Only update if deadline value really changed
                    if ($oldDeadline !== $newDeadline) {
                        $messageSchedule->setDeadline($newDeadline);
                        $needUpdateTaskScheduler = true;
                    }
                }

                if ($requestDTO->getPlugins() !== null) {
                    $messageSchedule->setPlugins($requestDTO->getPlugins());
                }

                // Note: completed and remark fields are not modifiable by client
                // They always return fixed values (null for updates) and will not be processed

                // Check if time configuration really changed
                $oldTimeConfig = $messageSchedule->getTimeConfig();
                $newTimeConfig = $requestDTO->getTimeConfig();

                if (TimeConfigDTO::isConfigChanged($oldTimeConfig, $newTimeConfig)) {
                    // Validate new time configuration
                    $timeConfigDTO = new TimeConfigDTO($newTimeConfig);
                    $validationErrors = $timeConfigDTO->getValidationErrors();
                    if (! empty($validationErrors)) {
                        throw new InvalidArgumentException(implode(', ', $validationErrors));
                    }

                    $messageSchedule->setTimeConfig($newTimeConfig);
                    $needUpdateTaskScheduler = true;
                }

                // Update message schedule
                $this->messageScheduleDomainService->updateMessageSchedule($dataIsolation, $messageSchedule);

                // Update task scheduler if needed
                if ($needUpdateTaskScheduler) {
                    $this->updateTaskScheduler($messageSchedule);

                    // Check if task should be marked as completed
                    // Note: crontab_id has been updated in memory by updateTaskScheduler()
                    $shouldComplete = $this->shouldMarkAsCompleted($messageSchedule);
                    $messageSchedule->setCompleted($shouldComplete ? 1 : 0);
                    $this->messageScheduleDomainService->updateMessageSchedule($dataIsolation, $messageSchedule);

                    $this->logger->info('Updated task completion status after scheduler update', [
                        'schedule_id' => $id,
                        'completed' => $shouldComplete ? 1 : 0,
                    ]);
                }

                return [
                    'id' => (string) $messageSchedule->getId(),
                ];
            });
        } catch (InvalidArgumentException $e) {
            // Parameter validation exception: show specific error message
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                trans('common.parameter_validation_error') . ': ' . $e->getMessage()
            );
        } catch (BusinessException $e) {
            // Business exception: re-throw to preserve error message
            throw $e;
        } catch (Throwable $e) {
            // System exception: log details and show generic error message
            $this->logger->error('Schedule update operation system exception', [
                'operation' => 'updateSchedule',
                'schedule_id' => $id,
                'user_id' => $requestContext->getUserId(),
                'organization_code' => $requestContext->getOrganizationCode(),
                'error' => $e->getMessage(),
            ]);

            ExceptionBuilder::throw(
                GenericErrorCode::SystemError,
                trans('common.system_exception')
            );
        }
    }

    /**
     * Delete schedule.
     */
    public function deleteSchedule(RequestContext $requestContext, int $id): array
    {
        $dataIsolation = $this->createDataIsolationFromContext($requestContext);

        // Get message schedule
        $messageSchedule = $this->messageScheduleDomainService->getMessageScheduleByIdWithValidation($dataIsolation, $id);

        // Check project permission (only if project_id is set)
        if ($messageSchedule->getProjectId() > 0) {
            $this->getAccessibleProjectWithEditor($messageSchedule->getProjectId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());
        }

        return Db::transaction(function () use ($id, $dataIsolation, $messageSchedule) {
            // Delete task scheduler if exists
            if ($messageSchedule->hasTaskScheduler()) {
                $this->deleteTaskScheduler($messageSchedule->getId());
            }

            // Delete message schedule
            $this->messageScheduleDomainService->deleteMessageSchedule($dataIsolation, $id);

            return [
                'id' => (string) $id,
            ];
        });
    }

    /**
     * Get schedule detail.
     */
    public function getScheduleDetail(RequestContext $requestContext, int $id): array
    {
        $dataIsolation = $this->createDataIsolationFromContext($requestContext);

        $messageSchedule = $this->messageScheduleDomainService->getMessageScheduleByIdWithValidation($dataIsolation, $id);

        // Check project permission (only if project_id is set)
        if ($messageSchedule->getProjectId() > 0) {
            $this->getAccessibleProject($messageSchedule->getProjectId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());
        }

        return MessageScheduleItemDTO::fromEntity($messageSchedule)->toArray();
    }

    /**
     * Execute schedule for testing purpose (with authorization check).
     *
     * @param RequestContext $requestContext Request context with user authorization
     * @param int $id Message schedule ID
     * @return array Execution result
     */
    public function executeScheduleForTest(RequestContext $requestContext, int $id): array
    {
        $dataIsolation = $this->createDataIsolationFromContext($requestContext);

        // Validate ownership: check if the schedule belongs to current user
        $messageSchedule = $this->messageScheduleDomainService->getMessageScheduleByIdWithValidation($dataIsolation, $id);

        // Check project permission (must have editor access, only if project_id is set)
        if ($messageSchedule->getProjectId() > 0) {
            $this->getAccessibleProjectWithEditor(
                $messageSchedule->getProjectId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );
        }

        // Execute the schedule
        return $this->executeMessageSchedule($id);
    }

    /**
     * Get schedule execution logs with pagination.
     *
     * @param RequestContext $requestContext Request context
     * @param int $messageScheduleId Message schedule ID
     * @param QueryMessageScheduleLogsRequestDTO $requestDTO Request DTO with pagination parameters
     * @return array Execution logs result with total and list
     */
    public function getScheduleLogs(RequestContext $requestContext, int $messageScheduleId, QueryMessageScheduleLogsRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createDataIsolationFromContext($requestContext);

        // Validate that the user owns this message schedule
        $messageSchedule = $this->messageScheduleDomainService->getMessageScheduleByIdWithValidation($dataIsolation, $messageScheduleId);

        // Check project permission (only if project_id is set)
        if ($messageSchedule->getProjectId() > 0) {
            $this->getAccessibleProject($messageSchedule->getProjectId(), $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());
        }

        // Get execution logs with pagination (using domain service with conditions)
        $conditions = [
            'message_schedule_id' => $messageScheduleId,
        ];

        $result = $this->messageScheduleDomainService->getExecutionLogsByConditions(
            $conditions,
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
            'id', // Order by id (newest first)
            'desc'
        );

        if (empty($result['list'])) {
            return [
                'total' => $result['total'],
                'list' => [],
            ];
        }

        // Extract unique IDs for batch name fetching (similar to querySchedules)
        $workspaceIds = [];
        $projectIds = [];
        $topicIds = [];

        foreach ($result['list'] as $log) {
            $workspaceIds[] = $log->getWorkspaceId();
            if ($log->getProjectId()) {
                $projectIds[] = $log->getProjectId();
            }
            if ($log->getTopicId()) {
                $topicIds[] = $log->getTopicId();
            }
        }

        // Remove duplicates
        $workspaceIds = array_unique($workspaceIds);
        $projectIds = array_unique($projectIds);
        $topicIds = array_unique($topicIds);

        // Batch fetch names (reuse existing domain service methods)
        $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);
        $projectNameMap = $this->projectDomainService->getProjectNamesBatch($projectIds);
        $topicNameMap = $this->topicDomainService->getTopicNamesBatch($topicIds);

        // Convert entities to DTOs with names
        $list = [];
        foreach ($result['list'] as $log) {
            $workspaceName = $workspaceNameMap[$log->getWorkspaceId()] ?? '';
            $projectName = $log->getProjectId() ? ($projectNameMap[$log->getProjectId()] ?? '') : '';
            $topicName = $log->getTopicId() ? ($topicNameMap[$log->getTopicId()] ?? '') : '';

            $dto = MessageScheduleLogItemDTO::fromEntity($log, $workspaceName, $projectName, $topicName);
            $list[] = $dto->toArray();
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    /**
     * Get next execution time for crontab task.
     * Get the next execution time for scheduled tasks.
     *
     * @param null|int $crontabId The crontab ID from task_scheduler_crontab table
     * @return null|string Next execution time in 'Y-m-d H:i:s' format or null if not available
     */
    public function getNextExecutionTime(?int $crontabId): ?string
    {
        if (! $crontabId) {
            return null;
        }

        try {
            $crontab = $this->taskSchedulerDomainService->getByCrontabId($crontabId);
            if (! $crontab || ! $crontab->isEnabled()) {
                return null;
            }

            // Check if deadline has passed
            if ($crontab->getDeadline() && $crontab->getDeadline() < new DateTime()) {
                return null;
            }

            // Calculate next execution time using Cron expression
            $cron = new CronExpression($crontab->getCrontab());
            $nextRun = $cron->getNextRunDate();

            return $nextRun->format('Y-m-d H:i:s');
        } catch (Throwable $e) {
            $this->logger->error('Failed to calculate next execution time', [
                'crontab_id' => $crontabId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Execute message schedule (internal method).
     */
    private function executeMessageSchedule(int $messageScheduleId): array
    {
        // Both new and existing topics must own their real commit boundary.
        $this->assertScheduleOutsideTransaction();
        $executionLog = null;
        $schedule = null;
        $commitUncertain = false;
        $resourcesCommitted = false;
        $topicEntity = null;
        $pendingDefault = null;
        $sendResult = ['success' => false, 'message' => 'Message schedule execution failed'];

        try {
            $schedule = $this->messageScheduleDomainService->getMessageScheduleById($messageScheduleId);
            if (! $schedule) {
                throw new RuntimeException('Message schedule not found');
            }
            $this->runScheduleTransaction(function () use ($schedule, &$executionLog): void {
                $executionLog = $this->messageScheduleDomainService->createExecutionLog($schedule);
            }, $commitUncertain);
            $dataIsolation = DataIsolation::simpleMake($schedule->getOrganizationCode(), $schedule->getUserId());
            if (! $schedule->isEnabled()) {
                throw new RuntimeException('Message schedule is disabled');
            }
            try {
                if ($schedule->getProjectId() > 0) {
                    di(MagicClawRuntimePolicyDomainService::class)->assertProject($schedule->getProjectId());
                }
                $this->assertMessageContentAgentAccess($dataIsolation, $schedule->getMessageContent());
            } catch (BusinessException $exception) {
                $disabledSchedule = null;
                $this->runScheduleTransaction(function () use ($messageScheduleId, &$disabledSchedule): void {
                    $disabledSchedule = $this->messageScheduleDomainService->getMessageScheduleByIdForUpdate($messageScheduleId);
                    if ($disabledSchedule) {
                        $this->messageScheduleDomainService->updateScheduleExecutionState($disabledSchedule, enabled: 0);
                        $disabledSchedule->setEnabled(0);
                    }
                }, $commitUncertain);
                // After the disable commits, serialize cleanup with user edits on the latest row.
                if ($disabledSchedule) {
                    try {
                        $this->runScheduleTransaction(function () use ($messageScheduleId): void {
                            $latest = $this->messageScheduleDomainService->getMessageScheduleByIdForUpdate($messageScheduleId);
                            if ($latest && ! $latest->isEnabled()) {
                                $this->updateTaskScheduler($latest);
                                $this->messageScheduleDomainService->updateTaskSchedulerCrontabId($messageScheduleId, null);
                            }
                        }, $commitUncertain);
                    } catch (Throwable $schedulerException) {
                        $this->logger->error('权限拒绝后关闭任务调度器失败', [
                            'message_schedule_id' => $messageScheduleId,
                            'error' => $schedulerException->getMessage(),
                        ]);
                    }
                }
                throw $exception;
            }

            // A failed summary must not initialize even an IM-only topic.
            $projectName = empty($schedule->getProjectId())
                ? $this->getSummarizeMessageText($dataIsolation, $schedule->getMessageType(), $schedule->getMessageContent()) : null;
            $topicName = empty($schedule->getTopicId())
                ? $this->getSummarizeMessageText($dataIsolation, $schedule->getMessageType(), $schedule->getMessageContent()) : null;
            $pair = empty($schedule->getTopicId())
                ? $this->chatAppService->getOrCreateMagicChatConversationPair($dataIsolation) : [];
            $messageContent = [];

            // Phase A: metadata and log links commit before sending anything.
            $this->runScheduleTransaction(function () use ($schedule, $executionLog, $dataIsolation, $pair, $projectName, $topicName, &$topicEntity, &$pendingDefault, &$messageContent): void {
                $projectEntity = empty($schedule->getWorkspaceId())
                    ? $this->getAccessibleProjectWithEditor($schedule->getProjectId(), $schedule->getUserId(), $schedule->getOrganizationCode())
                    : $this->getProjectOrCreate($dataIsolation, $schedule->getProjectId(), $schedule->getWorkspaceId(), $schedule->getMessageType(), $schedule->getMessageContent(), $projectName);
                if (! empty($schedule->getPlugins())) {
                    $this->setProjectMcpConfig($dataIsolation, $projectEntity->getId(), $schedule->getPlugins());
                }
                $messageContent = $this->moveMessageFileToProject($dataIsolation, $schedule->getMessageType(), $schedule->getMessageContent(), $projectEntity);
                $messageContent = SuperMagicExecutionSource::stampMessageContent($messageContent, SuperMagicExecutionSource::MessageSchedule);
                $topicEntity = $this->getTopicOrCreate($dataIsolation, $schedule->getTopicId(), $projectEntity, $schedule->getMessageType(), $schedule->getMessageContent(), (string) $executionLog->getId(), $pair, $pendingDefault, $topicName);
                if (! $topicEntity) {
                    throw new RuntimeException('Topic not found');
                }
                if (! $this->messageScheduleDomainService->updateExecutionLogDetails($executionLog->getId(), [
                    'project_id' => $projectEntity->getId(),
                    'topic_id' => $topicEntity->getId(),
                ])) {
                    throw new RuntimeException('Unable to persist execution resource links');
                }
                if ($pendingDefault !== null) {
                    $this->chatAppService->setMagicChatDefaultTopic($pendingDefault);
                }
                // No business work may follow the shared conversation updates.
            }, $commitUncertain);
            $resourcesCommitted = true;

            // Phase B: preserve the sender's direct/queued routing and response contract.
            $this->assertScheduleOutsideTransaction();
            $sendResult = $this->sendMessageToAgent($dataIsolation, $schedule->getMessageType(), $messageContent, $topicEntity);
        } catch (Throwable $exception) {
            $sendResult = ['success' => false, 'message' => $exception->getMessage()];
            $commitUncertain = $commitUncertain || $exception instanceof TransactionCommitOutcomeUnknownException;
            if ($commitUncertain) {
                $this->inspectUncertainScheduleCommit($messageScheduleId, $executionLog?->getId(), $topicEntity, $pendingDefault, $exception);
            } else {
                $this->logger->error('计划消息执行失败', [
                    'message_schedule_id' => $messageScheduleId,
                    'execution_log_id' => $executionLog?->getId(),
                    'resources_committed' => $resourcesCommitted,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        // Phase C: a failed write leaves RUNNING for reconciliation, never resends.
        if ($schedule && ! $commitUncertain) {
            try {
                $this->runScheduleTransaction(function () use ($messageScheduleId, $executionLog, $sendResult): void {
                    if ($executionLog) {
                        if (! empty($sendResult['success'])) {
                            $updated = $this->messageScheduleDomainService->markLogAsSuccess($executionLog->getId());
                        } else {
                            $updated = $this->messageScheduleDomainService->markLogAsFailed($executionLog->getId(), $sendResult['error_message'] ?? $sendResult['message'] ?? 'send failed');
                        }
                        if (! $updated) {
                            throw new RuntimeException('Unable to persist execution outcome');
                        }
                    }
                    $this->finalizeScheduleCompletion($messageScheduleId);
                }, $commitUncertain);
            } catch (Throwable $exception) {
                $this->logger->error('计划消息收尾失败，需核对执行记录，禁止自动重发', [
                    'message_schedule_id' => $messageScheduleId,
                    'execution_log_id' => $executionLog?->getId(),
                    'topic_id' => $resourcesCommitted ? $topicEntity?->getId() : null,
                    'project_id' => $resourcesCommitted ? $topicEntity?->getProjectId() : null,
                    'commit_uncertain' => $commitUncertain,
                    'error' => $exception->getMessage(),
                ]);
            }
        }
        return $sendResult;
    }

    private function assertScheduleOutsideTransaction(): void
    {
        if (Db::transactionLevel() !== 0) {
            throw new RuntimeException('Message schedule execution requires no active transaction');
        }
    }

    /** Own an outer transaction without retrying work after an uncertain commit. */
    private function runScheduleTransaction(callable $callback, bool &$commitUncertain): void
    {
        $this->assertScheduleOutsideTransaction();
        Db::beginTransaction();
        try {
            $callback();
        } catch (Throwable $exception) {
            try {
                Db::rollBack();
                $this->assertScheduleOutsideTransaction();
            } catch (Throwable $rollbackException) {
                $commitUncertain = true;
                $this->logger->error('计划消息事务回滚未确认', ['error' => $rollbackException->getMessage()]);
                $this->discardScheduleConnection();
            }
            throw $exception;
        }
        $commitUncertain = true;
        try {
            Db::commit();
            $this->assertScheduleOutsideTransaction();
        } catch (Throwable $exception) {
            $this->discardScheduleConnection();
            throw $exception;
        }
        $commitUncertain = false;
    }

    /** Discard an ambiguous session without treating disconnect as proof of rollback. */
    private function discardScheduleConnection(): void
    {
        try {
            $connection = Db::connection();
            if ($connection instanceof Connection) {
                $connection->reconnect();
            } elseif ($connection instanceof DatabaseConnection) {
                $connection->disconnect();
            }
        } catch (Throwable $exception) {
            $this->logger->error('计划消息事务异常后重置连接失败', ['error' => $exception->getMessage()]);
        }
    }

    /** Read on an independent primary connection; an uncertain commit never authorizes sending. */
    private function inspectUncertainScheduleCommit(int $scheduleId, ?int $logId, ?TopicEntity $topic, ?array $context, Throwable $exception): void
    {
        $verification = 'unknown';
        $connection = null;
        try {
            /** @var Connection|DatabaseConnection $businessConnection */
            $businessConnection = Db::connection();
            $config = $businessConnection->getConfig();
            $connection = ApplicationContext::getContainer()->get(ConnectionFactory::class)->make($config);
            $log = $logId ? $connection->table('magic_super_agent_message_schedule_log')->useWritePdo()->where('id', $logId)->first() : null;
            $storedTopic = $topic ? $connection->table('magic_super_agent_topics')->useWritePdo()->where('id', $topic->getId())->whereNull('deleted_at')->first() : null;
            if ($log && $storedTopic && (int) $log->topic_id === $topic->getId() && (int) $log->project_id === (int) $storedTopic->project_id) {
                $pairExists = true;
                foreach ($context ? [$context['chat_conversation_id'], $context['receive_conversation_id']] : [$storedTopic->chat_conversation_id] as $conversationId) {
                    $pairExists = $pairExists && $connection->table('magic_chat_topics')->useWritePdo()
                        ->where('conversation_id', $conversationId)->where('topic_id', $storedTopic->chat_topic_id)->whereNull('deleted_at')->exists();
                }
                if ($context === null) {
                    $pairExists = $pairExists && $connection->table('magic_chat_topics')->useWritePdo()
                        ->where('topic_id', $storedTopic->chat_topic_id)->whereNull('deleted_at')
                        ->distinct()->count('conversation_id') === 2;
                }
                $verification = $pairExists ? 'resources_committed' : 'inconsistent_resources';
            }
        } catch (Throwable $verificationException) {
            $verification = 'verification_failed: ' . $verificationException->getMessage();
        } finally {
            $connection?->disconnect();
        }
        $this->logger->error('计划消息提交结果不确定，已停止发送，需人工核对 RUNNING 记录', [
            'message_schedule_id' => $scheduleId,
            'execution_log_id' => $logId,
            'candidate_project_id' => $topic?->getProjectId(),
            'candidate_topic_id' => $topic?->getId(),
            'verification' => $verification,
            'error' => $exception->getMessage(),
        ]);
    }

    private function finalizeScheduleCompletion(int $messageScheduleId): void
    {
        $latest = $this->messageScheduleDomainService->getMessageScheduleByIdForUpdate($messageScheduleId);
        if ($latest && (int) $latest->getCompleted() !== 1 && $this->shouldMarkAsCompleted($latest)) {
            $this->messageScheduleDomainService->updateScheduleExecutionState($latest, completed: 1);
        }
    }

    private function getProjectOrCreate(DataIsolation $dataIsolation, int $projectId, int $workspaceId, string $messageType, array $messageContent, ?string $projectName = null): ProjectEntity
    {
        // If project id is not empty, get it directly
        if (! empty($projectId)) {
            // Check Project Permission
            return $this->projectDomainService->getProjectNotUserId($projectId);
        }
        // If it doesn't exist, create it
        $newProjectId = IdGenerator::getSnowId();
        // Prepare creation parameters
        // Get project working directory
        $projectWorkDir = WorkDirectoryUtil::getWorkDir($dataIsolation->getCurrentUserId(), $newProjectId);

        $projectName ??= $this->getSummarizeMessageText($dataIsolation, $messageType, $messageContent);

        $projectEntity = $this->projectDomainService->createProject(
            workspaceId: $workspaceId,
            projectName: $projectName,
            userId: $dataIsolation->getCurrentUserId(),
            userOrganizationCode: $dataIsolation->getCurrentOrganizationCode(),
            projectId: (string) $newProjectId,
            workDir: $projectWorkDir,
            projectMode: null,
            source: CreationSource::SCHEDULED_TASK->value
        );

        $this->projectMemberDomainService->initializeProjectMemberAndSettings(
            $dataIsolation->getCurrentUserId(),
            $projectEntity->getId(),
            $workspaceId,
            $dataIsolation->getCurrentOrganizationCode()
        );

        return $projectEntity;
    }

    private function getSummarizeMessageText(DataIsolation $dataIsolation, string $messageType, array $messageContent): string
    {
        $chatMessageType = ChatMessageType::from($messageType);
        $messageStruct = MessageAssembler::getChatMessageStruct(
            $chatMessageType,
            $messageContent
        );
        $text = '';
        if ($messageStruct instanceof TextContentInterface) {
            $authorization = new MagicUserAuthorization();
            $authorization->setId($dataIsolation->getCurrentUserId());
            $authorization->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
            $authorization->setUserType(UserType::Human);
            $text = $this->chatMessageAppService->summarizeText($authorization, $messageStruct->getTextContent());
        }
        return $text;
    }

    private function moveMessageFileToProject(DataIsolation $dataIsolation, string $messageType, array $messageContent, ProjectEntity $projectEntity): array
    {
        // 1. Get attachments from chat content
        $chatMessageType = ChatMessageType::from($messageType);
        $messageStruct = MessageAssembler::getChatMessageStruct(
            $chatMessageType,
            $messageContent
        );

        // Cast to MagicMessageStruct to access getExtra() method
        $superAgentExtra = null;
        if ($messageStruct instanceof MagicMessageStruct) {
            $superAgentExtra = $messageStruct->getExtra()?->getSuperAgent();
        }
        $mentions = $superAgentExtra?->getMentionsJsonStruct();
        if (empty($mentions)) {
            return $messageContent;
        }
        $filePathMap = [];

        // Extract file paths from mentions where type is 'upload_file'
        foreach ($mentions as $mention) {
            if ($mention['type'] == 'upload_file') {
                $filePathMap[$mention['file_path']] = $mention;
            }
        }
        if (empty($filePathMap)) {
            return $messageContent;
        }

        // Collect file update mapping
        $fileUpdateMapping = [];

        // Start copying
        foreach ($filePathMap as $filePath => $fileData) {
            // Check if file exists
            $oldWorkDir = WorkDirectoryUtil::getWorkDirByFileKey($filePath);
            $targetFileKey = str_replace($oldWorkDir, $projectEntity->getWorkDir(), $filePath);
            $taskFileEntity = $this->taskFileDomainService->getByFileKey($targetFileKey);
            if (! empty($taskFileEntity)) {
                // Skip if exists
                $fileUpdateMapping[$fileData['file_id']] = [
                    'file_id' => $taskFileEntity->getFileId(),
                    'file_path' => $taskFileEntity->getFileKey(),
                    'file_key' => $taskFileEntity->getFileKey(), // file_key is same as file_path
                    'file_name' => $taskFileEntity->getFileName(),
                ];
                continue;
            }
            // Build based on $oldWorkDir
            $fileEntity = new TaskFileEntity();
            $fileEntity->setFileId((int) $fileData['file_id']);
            $fileEntity->setFileKey($filePath);
            $fileEntity->setFileName($fileData['file_name']);
            $fileEntity->setFileSize($fileData['file_size']);
            $fileEntity->setProjectId($projectEntity->getId());
            $fileEntity->setFileType(FileType::USER_UPLOAD->value);
            $fileEntity->setStorageType(StorageType::WORKSPACE->value);
            $fileEntity->setIsHidden(false);
            $fileEntity->setIsDirectory(false);
            $fileEntity->setSort(0);
            $fileEntity->setMetadata('');
            // Get parent id
            $parentId = $this->taskFileDomainService->findOrCreateDirectoryAndGetParentId(
                projectId: $projectEntity->getId(),
                userId: $dataIsolation->getCurrentUserId(),
                organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
                fullFileKey: $targetFileKey,
                workDir: $projectEntity->getWorkDir(),
                source: TaskFileSource::COPY,
            );
            // Execute copy
            $newFileEntity = $this->taskFileDomainService->copyFile($dataIsolation, $fileEntity, $projectEntity->getWorkDir(), $targetFileKey, $parentId);

            // Collect new file information for updating mentions
            $fileUpdateMapping[$fileData['file_id']] = [
                'file_id' => $newFileEntity->getFileId(),
                'file_path' => $newFileEntity->getFileKey(),
                'file_key' => $newFileEntity->getFileKey(), // file_key is same as file_path
                'file_name' => $newFileEntity->getFileName(),
            ];
        }

        // Update file information in messageContent
        if (count($fileUpdateMapping) > 0) {
            $this->updateMentionsFileInfo($messageContent, $fileUpdateMapping);
        }

        return $messageContent;
    }

    /**
     * Update file information in mentions array.
     */
    private function updateMentionsFileInfo(array &$messageContent, array $fileUpdateMapping): void
    {
        if (! isset($messageContent['extra']['super_agent']['mentions'])) {
            return;
        }

        foreach ($messageContent['extra']['super_agent']['mentions'] as &$mention) {
            if (
                $mention['type'] === 'mention'
                && isset($mention['attrs']['type'])
                && $mention['attrs']['type'] === 'upload_file'
                && isset($mention['attrs']['data']['file_id'])
            ) {
                $oldFileId = $mention['attrs']['data']['file_id'];

                if (isset($fileUpdateMapping[$oldFileId])) {
                    $newFileInfo = $fileUpdateMapping[$oldFileId];

                    // Update all file-related fields
                    $mention['attrs']['data']['file_id'] = (string) $newFileInfo['file_id'];
                    $mention['attrs']['data']['file_path'] = $newFileInfo['file_path'];
                    $mention['attrs']['data']['file_key'] = $newFileInfo['file_key'];
                    $mention['attrs']['data']['file_name'] = $newFileInfo['file_name'];
                }
            }
        }
    }

    private function getTopicOrCreate(DataIsolation $dataIsolation, int $topicId, ProjectEntity $projectEntity, string $messageType, array $messageContent, string $sourceId = '', array $pair = [], ?array &$pendingDefault = null, ?string $topicName = null): ?TopicEntity
    {
        if (! empty($topicId)) {
            return $this->topicDomainService->getTopicById($topicId);
        }
        $topicName ??= $this->getSummarizeMessageText($dataIsolation, $messageType, $messageContent);
        $pendingDefault = $this->chatAppService->createMagicChatTopicForConversationPair($dataIsolation, $pair);
        $chatConversationId = $pendingDefault['chat_conversation_id'];
        $chatConversationTopicId = $pendingDefault['chat_topic_id'];
        // Append timestamp in ymdHi format
        $topicName = $topicName . ' ' . date('ymdHi');

        // 2. Create topic
        $topicEntity = $this->topicDomainService->createTopic(
            $dataIsolation,
            $projectEntity->getWorkspaceId(),
            $projectEntity->getId(),
            $chatConversationId,
            $chatConversationTopicId, // Conversation topic ID
            $topicName,
            $projectEntity->getWorkDir(),
            '', // topicMode
            CreationSource::SCHEDULED_TASK->value, // source
            $sourceId // sourceId
        );
        $this->taskFileDomainService->findOrCreateTopicRootDirectory(
            $projectEntity->getId(),
            $topicEntity->getId(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            $projectEntity->getUserOrganizationCode()
        );
        return $topicEntity;
    }

    /**
     * Create task scheduler based on time configuration.
     */
    private function createTaskScheduler(int $messageScheduleId, TimeConfigDTO $timeConfigDTO, bool $enabled = true, ?string $priorityDeadline = null, ?string $taskName = null): ?int
    {
        try {
            $taskConfig = TaskConfigAssembler::assembleFromDTO($timeConfigDTO);
            $externalId = "message_schedule_{$messageScheduleId}";
            $callbackMethod = [self::class, 'messageScheduleCallback'];
            $callbackParams = [
                'message_schedule_id' => $messageScheduleId,
            ];

            if ($taskConfig->getType() === TaskType::NoRepeat) {
                // One-time task: write directly to task_scheduler
                $task = new TaskScheduler();
                $task->setExternalId($externalId);
                $task->setName($taskName ?: "Message Schedule {$messageScheduleId}");
                $task->setExpectTime($taskConfig->getDatetime());
                $task->setType(2);
                $task->setRetryTimes(3);
                $task->setCallbackMethod($callbackMethod);
                $task->setCallbackParams($callbackParams);
                $task->setCreator('system');

                $this->taskSchedulerDomainService->create($task);
                return null; // No crontab ID for one-time tasks
            }
            // Recurring task: write to task_scheduler_crontab
            $crontab = new TaskSchedulerCrontab();
            $crontab->setExternalId($externalId);
            $crontab->setName($taskName ?: "Message Schedule {$messageScheduleId}");
            $crontab->setCrontab($taskConfig->getCrontabRule());
            $crontab->setEnabled($enabled);
            $crontab->setRetryTimes(3);
            $crontab->setCallbackMethod($callbackMethod);
            $crontab->setCallbackParams($callbackParams);
            // Use priority deadline if provided, otherwise use timeConfig deadline
            $finalDeadline = null;
            if (! empty($priorityDeadline)) {
                $finalDeadline = new DateTime($priorityDeadline);
            } elseif ($taskConfig->getDeadline()) {
                $finalDeadline = $taskConfig->getDeadline();
            }
            $crontab->setDeadline($finalDeadline);
            $crontab->setCreator('system');

            $this->taskSchedulerDomainService->createCrontab($crontab);

            // Generate specific execution plans
            $this->taskSchedulerDomainService->createByCrontab($crontab, 3);

            return $crontab->getId();
        } catch (Throwable $e) {
            $this->logger->error('Failed to create task scheduler', [
                'message_schedule_id' => $messageScheduleId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Update task scheduler.
     * This method is called when task configuration (time_config, deadline, or enabled) changes.
     * It will always delete the old scheduler and create a new one based on current configuration.
     */
    private function updateTaskScheduler(MessageScheduleEntity $messageSchedule): void
    {
        try {
            // Always delete old task scheduler first (since this is called only when config changed)
            // This handles all cases: repeat->repeat, repeat->no_repeat, no_repeat->repeat, no_repeat->no_repeat
            $this->deleteTaskScheduler($messageSchedule->getId());

            // Create new task scheduler based on current configuration
            $taskSchedulerId = null;
            if ($messageSchedule->isEnabled()) {
                $timeConfigDTO = new TimeConfigDTO();
                $timeConfig = $messageSchedule->getTimeConfig();
                $timeConfigDTO->type = $timeConfig['type'] ?? '';
                $timeConfigDTO->day = $timeConfig['day'] ?? '';
                $timeConfigDTO->time = $timeConfig['time'] ?? '';
                $timeConfigDTO->value = $timeConfig['value'] ?? [];

                $taskSchedulerId = $this->createTaskScheduler(
                    $messageSchedule->getId(),
                    $timeConfigDTO,
                    $messageSchedule->isEnabled(),
                    $messageSchedule->getDeadline(),
                    $messageSchedule->getTaskName()
                );
            }

            // Update crontab_id in messageSchedule entity (in memory)
            $messageSchedule->setTaskSchedulerCrontabId($taskSchedulerId);
        } catch (Throwable $e) {
            $this->logger->error('Failed to update task scheduler', [
                'message_schedule_id' => $messageSchedule->getId(),
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Delete task scheduler.
     */
    private function deleteTaskScheduler(int $messageScheduleId): void
    {
        try {
            $externalId = "message_schedule_{$messageScheduleId}";
            $this->taskSchedulerDomainService->clearByExternalId($externalId);
        } catch (Throwable $e) {
            $this->logger->error('Failed to delete task scheduler', [
                'message_schedule_id' => $messageScheduleId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Send message to agent using UserMessageToAgentAppService.
     * Delegates to the new service for unified message sending logic.
     */
    private function sendMessageToAgent(DataIsolation $dataIsolation, string $messageType, array $messageContent, TopicEntity $topicEntity): array
    {
        // Call new service with intelligent routing
        $result = $this->userMessageToAgentAppService->sendMessageWithQueueSupport(
            $dataIsolation,
            $topicEntity,
            $messageType,
            $messageContent
        );

        // Map new service response to existing format for backward compatibility
        return [
            'success' => $result['success'],
            'error_message' => $result['error_message'],
            'result' => $result['data']['result'] ?? $result['data'],
        ];
    }

    /**
     * Create DataIsolation from RequestContext.
     */
    private function createDataIsolationFromContext(RequestContext $requestContext): DataIsolation
    {
        $authorization = $requestContext->getUserAuthorization();
        return DataIsolation::create($authorization->getOrganizationCode(), $authorization->getId());
    }

    /** 校验定时消息中的话题模式，避免把 MagicClaw code 当成员工 code。 */
    private function assertMessageContentAgentAccess(DataIsolation $dataIsolation, array $messageContent): void
    {
        $superAgent = $messageContent['extra']['super_agent'] ?? [];
        $topicPattern = trim((string) ($superAgent['topic_pattern'] ?? 'general'));
        $agentCode = trim((string) ($superAgent['agent_code'] ?? ''));

        [$allowed, $errorMessage] = $this->superMagicAgentAccessAppService->checkAgentAccess(
            SuperMagicAgentDataIsolation::create(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            ),
            $topicPattern,
            $agentCode
        );
        if (! $allowed) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, $errorMessage);
        }
    }

    /**
     * Validate resource permissions for scheduled message creation/update.
     *
     * @param int|string $workspaceId Workspace ID (number or "collaboration")
     * @param null|int $projectId Project ID
     * @param null|int $topicId Topic ID
     * @throws Exception
     */
    private function validateResourcePermissions(DataIsolation $dataIsolation, int|string $workspaceId, ?int $projectId = null, ?int $topicId = null): void
    {
        // Handle collaboration workspace
        if ($workspaceId === 'collaboration') {
            // 1. Validate project ID is required
            if (empty($projectId) || $projectId <= 0) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::PROJECT_ID_REQUIRED_FOR_COLLABORATION,
                    trans('project.project_id_required_for_collaboration')
                );
            }

            // 2. Validate user is a member of the project (collaboration project check)
            $isProjectMember = $this->projectMemberDomainService->isProjectMemberByUser(
                $projectId,
                $dataIsolation->getCurrentUserId()
            );

            if (! $isProjectMember) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::NOT_A_COLLABORATION_PROJECT,
                    trans('project.not_a_collaboration_project')
                );
            }

            // 3. Validate topic access (if topic_id is provided)
            if ($topicId !== null && $topicId > 0) {
                $this->topicDomainService->validateTopicForMessageQueue($dataIsolation, $topicId);
            }

            return;
        }

        // Handle normal workspace
        $workspaceIdInt = (int) $workspaceId;

        // 1. Validate workspace access
        $workspace = $this->workspaceDomainService->getWorkspaceDetail($workspaceIdInt);
        if (! $workspace) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, trans('workspace.workspace_not_found'));
        }

        if ($workspace->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, trans('workspace.workspace_access_denied'));
        }

        // 2. Validate project access (if project_id is provided)
        if ($projectId !== null && $projectId > 0) {
            $this->getAccessibleProject($projectId, $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());
        }

        // 3. Validate topic access (if topic_id is provided)
        if ($topicId !== null && $topicId > 0) {
            $this->topicDomainService->validateTopicForMessageQueue($dataIsolation, $topicId);
        }
    }

    /**
     * Set project MCP configuration from scheduled task plugins.
     */
    private function setProjectMcpConfig(
        DataIsolation $dataIsolation,
        int $projectId,
        array $plugins
    ): void {
        try {
            // Only set if plugins contain servers array
            if (empty($plugins['servers'])) {
                return;
            }

            // Create user setting entity for project MCP servers
            $entity = new MagicUserSettingEntity();
            $entity->setKey(UserSettingKey::genSuperMagicProjectMCPServers((string) $projectId));
            $entity->setValue([
                'servers' => $plugins['servers'],
            ]);

            // Save through domain service
            $this->magicUserSettingDomainService->save($dataIsolation, $entity);

            $this->logger->info('Set project MCP config from scheduled task', [
                'project_id' => $projectId,
                'servers_count' => count($plugins['servers']),
            ]);
        } catch (Throwable $e) {
            // Log error but don't break main flow
            $this->logger->error('Failed to set project MCP config', [
                'project_id' => $projectId,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
        }
    }

    /**
     * Check if task should be marked as completed.
     *
     * This method checks:
     * 1. For no_repeat tasks: if execution time has passed
     * 2. For repeating tasks: if next execution time exceeds deadline or no next execution time available
     *
     * @param MessageScheduleEntity $messageSchedule Message schedule entity
     * @return bool True if task should be completed, false otherwise
     */
    private function shouldMarkAsCompleted(MessageScheduleEntity $messageSchedule): bool
    {
        $timeConfig = $messageSchedule->getTimeConfig();
        $taskType = $timeConfig['type'] ?? '';
        $currentTime = date('Y-m-d H:i:s');

        // Case 1: One-time task (no_repeat)
        if ($taskType === TaskType::NoRepeat->value) {
            $day = $timeConfig['day'] ?? '';
            $time = $timeConfig['time'] ?? '';

            if (empty($day) || empty($time)) {
                // Invalid configuration, mark as completed to prevent execution
                return true;
            }

            // Assemble execution time: "2025-10-15 18:00:00"
            // Ensure time includes seconds
            $timeParts = explode(':', $time);
            if (count($timeParts) === 2) {
                $time .= ':00'; // Add seconds if not present
            }
            $executionTime = $day . ' ' . $time;

            // Return true if execution time has passed or equals current time
            // Use <= to handle the exact execution time moment (boundary condition)
            return $executionTime <= $currentTime;
        }

        // Case 2: Repeating task - use task scheduler to get next execution time
        if (! $messageSchedule->hasTaskScheduler()) {
            // No task scheduler, cannot execute
            return true;
        }

        $nextExecutionTime = $this->getNextExecutionTime($messageSchedule->getTaskSchedulerCrontabId());

        // If no next execution time, task cannot execute anymore
        if ($nextExecutionTime === null) {
            return true;
        }

        // Check if next execution time exceeds deadline
        $deadline = $messageSchedule->getDeadline();
        if ($deadline !== null && $nextExecutionTime > $deadline) {
            return true;
        }

        // Task still has valid future execution time
        return false;
    }
}
