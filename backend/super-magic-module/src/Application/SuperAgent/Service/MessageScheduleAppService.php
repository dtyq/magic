<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Contact\UserSetting\UserSettingKey;
use App\Domain\Chat\DTO\Message\MagicMessageStruct;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Carbon\Carbon;
use Cron\CronExpression;
use DateTime;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Assembler\TaskConfigAssembler;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageScheduleEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\CreationSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageScheduleDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateMessageScheduleRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\QueryMessageScheduleLogsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\QueryMessageScheduleRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\TimeConfigDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateMessageScheduleRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\MessageScheduleItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\MessageScheduleListItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\MessageScheduleLogItemDTO;
use Dtyq\TaskScheduler\Entity\TaskScheduler;
use Dtyq\TaskScheduler\Entity\TaskSchedulerCrontab;
use Dtyq\TaskScheduler\Entity\ValueObject\TaskType;
use Dtyq\TaskScheduler\Service\TaskSchedulerDomainService;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
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
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly TaskSchedulerDomainService $taskSchedulerDomainService,
        private readonly MagicUserDomainService $userDomainService,
        private readonly MagicUserSettingDomainService $magicUserSettingDomainService,
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
        try {
            return Db::transaction(function () use ($requestContext, $requestDTO) {
                // Validate resource permissions
                $dataIsolation = $this->createDataIsolationFromContext($requestContext);
                $this->validateResourcePermissions(
                    $dataIsolation,
                    (int) $requestDTO->getWorkspaceId(),
                    $requestDTO->getProjectId() ? (int) $requestDTO->getProjectId() : null,
                    $requestDTO->getTopicId() ? (int) $requestDTO->getTopicId() : null
                );

                // 2.1 Create message schedule
                $messageSchedule = $this->messageScheduleDomainService->createMessageSchedule(
                    $dataIsolation,
                    $requestDTO->getTaskName(),
                    $requestDTO->getMessageType(),
                    $requestDTO->getMessageContent(),
                    (int) $requestDTO->getWorkspaceId(),
                    (int) $requestDTO->getProjectId(),
                    (int) $requestDTO->getTopicId(),
                    $requestDTO->getCompleted(),
                    $requestDTO->getEnabled(),
                    $requestDTO->getDeadline(),
                    $requestDTO->getRemark(),
                    $requestDTO->getTimeConfig(),
                    $requestDTO->getPlugins()
                );

                // 2.2 Create task scheduler
                $timeConfigDTO = $requestDTO->createTimeConfigDTO();
                $taskSchedulerId = $this->createTaskScheduler(
                    $messageSchedule->getId(),
                    $timeConfigDTO,
                    $messageSchedule->isEnabled(),
                    $requestDTO->getDeadline(), // Priority deadline from request
                    $requestDTO->getTaskName() // Task name from request
                );

                // 2.3 Update task_scheduler_crontab_id
                if ($taskSchedulerId) {
                    $this->messageScheduleDomainService->updateTaskSchedulerCrontabId($messageSchedule->getId(), $taskSchedulerId);
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

        // Batch get names
        $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);
        $projectNameMap = $this->projectDomainService->getProjectNamesBatch($projectIds);
        $topicNameMap = $this->topicDomainService->getTopicNamesBatch($topicIds);

        // Convert entities to DTOs with names
        $list = [];
        foreach ($result['list'] as $entity) {
            $workspaceName = $workspaceNameMap[$entity->getWorkspaceId()] ?? '';
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
        try {
            return Db::transaction(function () use ($requestContext, $id, $requestDTO) {
                $dataIsolation = $this->createDataIsolationFromContext($requestContext);

                // Get existing message schedule
                $messageSchedule = $this->messageScheduleDomainService->getMessageScheduleByIdWithValidation($dataIsolation, $id);

                // Validate permissions for new resource IDs (if provided)
                $currentWorkspaceId = $messageSchedule->getWorkspaceId();
                $currentProjectId = $messageSchedule->getProjectId();
                $currentTopicId = $messageSchedule->getTopicId();

                // Check raw properties to detect empty strings (which should be converted to 0)
                $newWorkspaceId = ! empty($requestDTO->getWorkspaceId()) ? (int) $requestDTO->getWorkspaceId() : $currentWorkspaceId;
                $newProjectId = $requestDTO->projectId !== null ? (int) $requestDTO->getProjectId() : $currentProjectId;
                $newTopicId = $requestDTO->topicId !== null ? (int) $requestDTO->getTopicId() : $currentTopicId;

                // Check if resource IDs have changed, and validate permissions for new resources
                if ($newWorkspaceId !== $currentWorkspaceId
                    || $newProjectId !== $currentProjectId
                    || $newTopicId !== $currentTopicId) {
                    $this->validateResourcePermissions(
                        $dataIsolation,
                        $newWorkspaceId,
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
                if (! empty($requestDTO->getWorkspaceId()) && $newWorkspaceId !== $currentWorkspaceId) {
                    $messageSchedule->setWorkspaceId($newWorkspaceId);
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
                    $messageSchedule->setTimeConfig($newTimeConfig);
                    $needUpdateTaskScheduler = true;
                }

                // Update message schedule
                $this->messageScheduleDomainService->updateMessageSchedule($dataIsolation, $messageSchedule);

                // Update task scheduler if needed
                if ($needUpdateTaskScheduler) {
                    $this->updateTaskScheduler($messageSchedule, $requestDTO);
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
        return Db::transaction(function () use ($requestContext, $id) {
            $dataIsolation = $this->createDataIsolationFromContext($requestContext);

            // Get message schedule
            $messageSchedule = $this->messageScheduleDomainService->getMessageScheduleByIdWithValidation($dataIsolation, $id);

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

        return MessageScheduleItemDTO::fromEntity($messageSchedule)->toArray();
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
        return Db::transaction(function () use ($messageScheduleId) {
            $executionLog = null;

            try {
                // 1. Get message schedule entity
                $messageScheduleEntity = $this->messageScheduleDomainService->getMessageScheduleById($messageScheduleId);
                if (! $messageScheduleEntity) {
                    $this->logger->warning('Message schedule not found', ['id' => $messageScheduleId]);
                    return [
                        'success' => false,
                        'message' => 'Message schedule not found',
                    ];
                }

                // Create execution log (status: running) only when all checks passed
                $executionLog = $this->messageScheduleDomainService->createExecutionLog($messageScheduleEntity);

                // Check if schedule is enabled
                if (! $messageScheduleEntity->isEnabled()) {
                    $this->logger->info('Message schedule is disabled, skip execution', ['id' => $messageScheduleId]);
                    return [
                        'success' => false,
                        'message' => 'Message schedule is disabled',
                    ];
                }
                $dataIsolation = DataIsolation::simpleMake($messageScheduleEntity->getOrganizationCode(), $messageScheduleEntity->getUserId());

                // 2. Get project entity
                $projectEntity = $this->getProjectOrCreate(
                    $dataIsolation,
                    $messageScheduleEntity->getProjectId(),
                    $messageScheduleEntity->getWorkspaceId(),
                    $messageScheduleEntity->getMessageType(),
                    $messageScheduleEntity->getMessageContent(),
                );
                if (! $projectEntity) {
                    $this->logger->warning('Project not found', ['project_id' => $messageScheduleEntity->getProjectId()]);
                    return [
                        'success' => false,
                        'message' => 'Project not found',
                    ];
                }

                // Set project MCP configuration if plugins are configured
                if (! empty($messageScheduleEntity->getPlugins())) {
                    $this->setProjectMcpConfig(
                        $dataIsolation,
                        $projectEntity->getId(),
                        $messageScheduleEntity->getPlugins()
                    );
                }

                // Migrate chat message attachments to project and get updated content
                $messageContent = $this->moveMessageFileToProject($dataIsolation, $messageScheduleEntity->getMessageType(), $messageScheduleEntity->getMessageContent(), $projectEntity);

                // 3. Get topic entity
                $topicEntity = $this->getTopicOrCreate($dataIsolation, $messageScheduleEntity->getTopicId(), $projectEntity, $messageScheduleEntity->getMessageType(), $messageScheduleEntity->getMessageContent(), (string) $executionLog->getId());
                if (! $topicEntity) {
                    $this->logger->warning('Topic not found', ['topic_id' => $messageScheduleEntity->getTopicId()]);
                    return [
                        'success' => false,
                        'message' => 'Topic not found',
                    ];
                }

                // 4. Send message (reference MessageQueueCompensationAppService::processTopicInternal)
                $sendResult = $this->sendMessageToAgent($dataIsolation, $messageScheduleEntity->getMessageType(), $messageContent, $topicEntity);

                // 5. Update task status to completed if it's a one-time task or next execution time exceeds deadline
                // Check if it's a one-time task
                $timeConfig = $messageScheduleEntity->getTimeConfig();
                $isNoRepeatTask = isset($timeConfig['type'])
                                  && $timeConfig['type'] === TaskType::NoRepeat->value;

                // Check if next execution time exceeds deadline
                $nextExecutionTime = $this->getNextExecutionTime($messageScheduleEntity->getTaskSchedulerCrontabId());
                $deadline = $messageScheduleEntity->getDeadline();
                $isExecutionTimeExceeded = $nextExecutionTime !== null
                                          && $deadline !== null
                                          && $nextExecutionTime > $deadline;

                // Mark as completed if any condition is met
                if ($isNoRepeatTask || $isExecutionTimeExceeded) {
                    $messageScheduleEntity->setCompleted(1);
                    $this->messageScheduleDomainService->updateMessageSchedule($dataIsolation, $messageScheduleEntity);
                }

                // Update executionLog's project_id and topic_id
                $executionLog = $executionLog->setProjectId($projectEntity->getId());
                $executionLog = $executionLog->setTopicId($topicEntity->getId());

                // Save updated execution log to database
                $this->messageScheduleDomainService->updateExecutionLogDetails(
                    $executionLog->getId(),
                    [
                        'project_id' => $projectEntity->getId(),
                        'topic_id' => $topicEntity->getId(),
                    ]
                );

                $this->logger->info('Message schedule execution completed', [
                    'message_schedule_id' => $messageScheduleId,
                    'execution_log_id' => $executionLog->getId(),
                    'success' => $sendResult['success'],
                    'error_message' => $sendResult['error_message'],
                ]);

                // Keep log status as RUNNING since this is async trigger
                // Real task processing will be handled by event listeners
                return $sendResult;
            } catch (Throwable $e) {
                // Update execution log status to failed if log was created
                if ($executionLog) {
                    $this->messageScheduleDomainService->markLogAsFailed(
                        $executionLog->getId(),
                        $e->getMessage()
                    );
                }

                $this->logger->error('Message schedule execution exception', [
                    'message_schedule_id' => $messageScheduleId,
                    'execution_log_id' => $executionLog?->getId(),
                    'error' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ]);

                return [
                    'success' => false,
                    'message' => $e->getMessage(),
                ];
            }
        });
    }

    private function getProjectOrCreate(DataIsolation $dataIsolation, int $projectId, int $workspaceId, string $messageType, array $messageContent): ?ProjectEntity
    {
        // If project id is not empty, get it directly
        if (! empty($projectId)) {
            return $this->projectDomainService->getProjectNotUserId($projectId);
        }
        // If it doesn't exist, create it
        $newProjectId = IdGenerator::getSnowId();
        // Prepare creation parameters
        // Get project working directory
        $projectWorkDir = WorkDirectoryUtil::getWorkDir($dataIsolation->getCurrentUserId(), $newProjectId);

        $projectName = $this->getSummarizeMessageText($dataIsolation, $messageType, $messageContent);

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
                userId: $projectEntity->getUserId(),
                organizationCode: $projectEntity->getUserOrganizationCode(),
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

    private function getTopicOrCreate(DataIsolation $dataIsolation, int $topicId, ProjectEntity $projectEntity, string $messageType, array $messageContent, string $sourceId = ''): ?TopicEntity
    {
        if (! empty($topicId)) {
            return $this->topicDomainService->getTopicById($topicId);
        }
        // 1. Initialize chat conversation and topic
        [$chatConversationId, $chatConversationTopicId] = $this->chatAppService->initMagicChatConversation($dataIsolation);

        $topicName = $this->getSummarizeMessageText($dataIsolation, $messageType, $messageContent);

        // 2. Create topic
        return $this->topicDomainService->createTopic(
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
     */
    private function updateTaskScheduler(MessageScheduleEntity $messageSchedule, UpdateMessageScheduleRequestDTO $requestDTO): void
    {
        try {
            // Clear old task scheduler
            $taskSchedulerId = null;
            if ($messageSchedule->hasTaskScheduler()) {
                $this->deleteTaskScheduler($messageSchedule->getId());
            }

            // Create new task scheduler if status is enabled and time config was updated
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
                    $messageSchedule->getDeadline(), // Use updated deadline from messageSchedule
                    $messageSchedule->getTaskName() // Use updated task name from messageSchedule
                );
            }

            $this->messageScheduleDomainService->updateTaskSchedulerCrontabId($messageSchedule->getId(), $taskSchedulerId);
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
     * Send message to agent (reference MessageQueueCompensationAppService::sendMessageToAgent).
     */
    private function sendMessageToAgent(DataIsolation $dataIsolation, string $messageType, array $messageContent, TopicEntity $topicEntity): array
    {
        try {
            // Convert message content
            $chatMessageType = ChatMessageType::from($messageType);
            $messageStruct = MessageAssembler::getChatMessageStruct(
                $chatMessageType,
                $messageContent
            );

            // Create MagicSeqEntity based on message content
            $seqEntity = new MagicSeqEntity();
            $seqEntity->setContent($messageStruct);
            $seqEntity->setSeqType($chatMessageType);

            // Set topic ID in extra
            $seqExtra = new SeqExtra();
            $seqExtra->setTopicId($topicEntity->getChatTopicId());
            $seqEntity->setExtra($seqExtra);

            // Generate unique app message ID for deduplication
            $appMessageId = IdGenerator::getUniqueId32();

            // Get agent user_id
            $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);

            if (empty($aiUserEntity)) {
                $this->logger->error('Agent user not found, skip processing', [
                    'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                ]);
                return [
                    'success' => false,
                    'error_message' => 'Agent user not found for organization: ' . $dataIsolation->getCurrentOrganizationCode(),
                    'result' => null,
                ];
            }

            // Call userSendMessageToAgent
            $result = $this->chatMessageAppService->userSendMessageToAgent(
                aiSeqDTO: $seqEntity,
                senderUserId: $dataIsolation->getCurrentUserId(),
                receiverId: $aiUserEntity->getUserId(),
                appMessageId: $appMessageId,
                doNotParseReferMessageId: false,
                sendTime: new Carbon(),
                receiverType: ConversationType::Ai,
                topicId: $topicEntity->getChatTopicId()
            );

            return [
                'success' => ! empty($result),
                'error_message' => null,
                'result' => $result,
            ];
        } catch (Throwable $e) {
            $this->logger->error('Failed to send message to agent', [
                'topic_id' => $topicEntity->getId(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return [
                'success' => false,
                'error_message' => $e->getMessage(),
                'result' => null,
            ];
        }
    }

    /**
     * Create DataIsolation from RequestContext.
     */
    private function createDataIsolationFromContext(RequestContext $requestContext): DataIsolation
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId($authorization->getId());
        $dataIsolation->setCurrentOrganizationCode($authorization->getOrganizationCode());
        return $dataIsolation;
    }

    /**
     * Validate resource permissions for scheduled message creation/update.
     */
    private function validateResourcePermissions(DataIsolation $dataIsolation, int $workspaceId, ?int $projectId = null, ?int $topicId = null): void
    {
        // 1. Validate workspace access
        $workspace = $this->workspaceDomainService->getWorkspaceDetail($workspaceId);
        if (! $workspace) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, trans('workspace.workspace_not_found'));
        }

        if ($workspace->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, trans('workspace.workspace_access_denied'));
        }

        // 2. Validate project access (if project_id is provided)
        if ($projectId !== null && $projectId > 0) {
            try {
                $this->projectDomainService->getProject($projectId, $dataIsolation->getCurrentUserId());
            } catch (Throwable $e) {
                // Re-throw the exception from getProject method
                throw $e;
            }
        }

        // 3. Validate topic access (if topic_id is provided)
        if ($topicId !== null && $topicId > 0) {
            try {
                $this->topicDomainService->validateTopicForMessageQueue($dataIsolation, $topicId);
            } catch (Throwable $e) {
                // Re-throw the exception from validateTopicForMessageQueue method
                throw $e;
            }
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
}
