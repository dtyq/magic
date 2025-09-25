<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Carbon\Carbon;
use DateTime;
use Dtyq\SuperMagic\Application\SuperAgent\Assembler\TaskConfigAssembler;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageScheduleDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateMessageScheduleRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\QueryMessageScheduleRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\TimeConfigDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateMessageScheduleRequestDTO;
use Dtyq\TaskScheduler\Entity\TaskScheduler;
use Dtyq\TaskScheduler\Entity\TaskSchedulerCrontab;
use Dtyq\TaskScheduler\Entity\ValueObject\TaskType;
use Dtyq\TaskScheduler\Service\TaskSchedulerDomainService;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
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
        private readonly MessageScheduleDomainService $messageScheduleDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskSchedulerDomainService $taskSchedulerDomainService,
        private readonly MagicChatMessageAppService $chatMessageAppService,
        private readonly MagicUserDomainService $userDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Message schedule callback method (task scheduler entry point).
     */
    public static function messageScheduleCallback(array $params): array
    {
        try {
            $messageScheduleId = $params['message_schedule_id'] ?? 0;
            if (empty($messageScheduleId)) {
                return [
                    'success' => false,
                    'message' => 'Message schedule ID is required',
                ];
            }

            // Create application service instance
            $appService = di(self::class);
            return $appService->executeMessageSchedule((int) $messageScheduleId);
        } catch (Throwable $e) {
            simple_logger('MessageScheduleCallback')->error('Message schedule callback failed', [
                'params' => $params,
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
     * Execute message schedule (internal method).
     */
    private function executeMessageSchedule(int $messageScheduleId): array
    {
        try {
            // 1. Get message schedule entity
            $messageScheduleEntity = $this->messageScheduleDomainService->getMessageScheduleById($messageScheduleId);
            if (!$messageScheduleEntity) {
                $this->logger->warning('Message schedule not found', ['id' => $messageScheduleId]);
                return [
                    'success' => false,
                    'message' => 'Message schedule not found',
                ];
            }

            // Check if schedule is enabled
            if (!$messageScheduleEntity->isEnabled()) {
                $this->logger->info('Message schedule is disabled, skip execution', ['id' => $messageScheduleId]);
                return [
                    'success' => true,
                    'message' => 'Message schedule is disabled',
                ];
            }

            // 2. Get project entity
            $projectEntity = $this->projectDomainService->getProjectNotUserId($messageScheduleEntity->getProjectId());
            if (!$projectEntity) {
                $this->logger->warning('Project not found', ['project_id' => $messageScheduleEntity->getProjectId()]);
                return [
                    'success' => false,
                    'message' => 'Project not found',
                ];
            }

            // 3. Get topic entity
            $topicEntity = $this->topicDomainService->getTopicById($messageScheduleEntity->getTopicId());
            if (!$topicEntity) {
                $this->logger->warning('Topic not found', ['topic_id' => $messageScheduleEntity->getTopicId()]);
                return [
                    'success' => false,
                    'message' => 'Topic not found',
                ];
            }

            // 4. Send message (reference MessageQueueCompensationAppService::processTopicInternal)
            $sendResult = $this->sendMessageToAgent($messageScheduleEntity, $topicEntity);

            $this->logger->info('Message schedule execution completed', [
                'message_schedule_id' => $messageScheduleId,
                'success' => $sendResult['success'],
                'error_message' => $sendResult['error_message'],
            ]);

            return $sendResult;
        } catch (Throwable $e) {
            $this->logger->error('Message schedule execution exception', [
                'message_schedule_id' => $messageScheduleId,
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
        return Db::transaction(function () use ($requestContext, $requestDTO) {
            // 2.1 Create message schedule
            $dataIsolation = $this->createDataIsolationFromContext($requestContext);
            $messageSchedule = $this->messageScheduleDomainService->createMessageSchedule(
                $dataIsolation,
                $requestDTO->getTaskName(),
                $requestDTO->getMessageType(),
                $requestDTO->getMessageContent(),
                (int) $requestDTO->getWorkspaceId(),
                (int) $requestDTO->getProjectId(),
                (int) $requestDTO->getTopicId(),
                $requestDTO->getStatus(),
                $requestDTO->getTimeConfig()
            );

            // 2.2 Create task scheduler
            $timeConfigDTO = $requestDTO->createTimeConfigDTO();
            $taskSchedulerId = $this->createTaskScheduler($messageSchedule->getId(), $timeConfigDTO, $messageSchedule->isEnabled());

            // 2.3 Update task_scheduler_crontab_id
            if ($taskSchedulerId) {
                $this->messageScheduleDomainService->updateTaskSchedulerCrontabId($messageSchedule->getId(), $taskSchedulerId);
            }

            return [
                'id' => (string) $messageSchedule->getId(),
            ];
        });
    }

    /**
     * Query schedules.
     */
    public function querySchedules(RequestContext $requestContext, QueryMessageScheduleRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createDataIsolationFromContext($requestContext);
        
        $conditions = $requestDTO->buildConditions(
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );

        $result = $this->messageScheduleDomainService->getMessageSchedulesByConditions(
            $conditions,
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
            $requestDTO->getOrderBy(),
            $requestDTO->getOrderDirection()
        );

        // Convert entities to arrays
        $list = [];
        foreach ($result['list'] as $entity) {
            $list[] = $entity->toArray();
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
        return Db::transaction(function () use ($requestContext, $id, $requestDTO) {
            $dataIsolation = $this->createDataIsolationFromContext($requestContext);
            
            // Get existing message schedule
            $messageSchedule = $this->messageScheduleDomainService->getMessageScheduleByIdWithValidation($dataIsolation, $id);

            $needUpdateTaskScheduler = false;

            // Update fields
            if (!empty($requestDTO->getTaskName())) {
                $messageSchedule->setTaskName($requestDTO->getTaskName());
            }

            if (!empty($requestDTO->getMessageType())) {
                $messageSchedule->setMessageType($requestDTO->getMessageType());
            }

            if (!empty($requestDTO->getMessageContent())) {
                $messageSchedule->setMessageContent($requestDTO->getMessageContent());
            }

            // Check if status changed to disabled or time config changed
            if ($requestDTO->getStatus() !== null) {
                $oldStatus = $messageSchedule->getStatus();
                $messageSchedule->setStatus($requestDTO->getStatus());
                
                if ($oldStatus !== $requestDTO->getStatus()) {
                    $needUpdateTaskScheduler = true;
                }
            }

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

        return $messageSchedule->toArray();
    }

    /**
     * Create task scheduler based on time configuration.
     */
    private function createTaskScheduler(int $messageScheduleId, TimeConfigDTO $timeConfigDTO, bool $enabled = true): ?int
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
                $task->setName("Message Schedule {$messageScheduleId}");
                $task->setExpectTime($taskConfig->getDatetime());
                $task->setType(2);
                $task->setRetryTimes(3);
                $task->setCallbackMethod($callbackMethod);
                $task->setCallbackParams($callbackParams);
                $task->setCreator('system');
                
                $this->taskSchedulerDomainService->create($task);
                return null; // No crontab ID for one-time tasks
            } else {
                // Recurring task: write to task_scheduler_crontab
                $crontab = new TaskSchedulerCrontab();
                $crontab->setExternalId($externalId);
                $crontab->setName("Message Schedule {$messageScheduleId}");
                $crontab->setCrontab($taskConfig->getCrontabRule());
                $crontab->setEnabled($enabled);
                $crontab->setRetryTimes(3);
                $crontab->setCallbackMethod($callbackMethod);
                $crontab->setCallbackParams($callbackParams);
                $crontab->setDeadline($taskConfig->getDeadline());
                $crontab->setCreator('system');
                
                $this->taskSchedulerDomainService->createCrontab($crontab);
                
                // Generate specific execution plans
                $this->taskSchedulerDomainService->createByCrontab($crontab, 3);
                
                return $crontab->getId();
            }
        } catch (Throwable $e) {
            $this->logger->error('Failed to create task scheduler', [
                'message_schedule_id' => $messageScheduleId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Update task scheduler.
     */
    private function updateTaskScheduler($messageSchedule, UpdateMessageScheduleRequestDTO $requestDTO): void
    {
        try {
            // Clear old task scheduler
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
                
                $taskSchedulerId = $this->createTaskScheduler($messageSchedule->getId(), $timeConfigDTO, $messageSchedule->isEnabled());
                
                if ($taskSchedulerId) {
                    $this->messageScheduleDomainService->updateTaskSchedulerCrontabId($messageSchedule->getId(), $taskSchedulerId);
                }
            }
        } catch (Throwable $e) {
            $this->logger->error('Failed to update task scheduler', [
                'message_schedule_id' => $messageSchedule->getId(),
                'error' => $e->getMessage(),
            ]);
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
        }
    }

    /**
     * Send message to agent (reference MessageQueueCompensationAppService::sendMessageToAgent).
     */
    private function sendMessageToAgent($messageScheduleEntity, $topicEntity): array
    {
        try {
            // Convert message content
            $chatMessageType = ChatMessageType::from($messageScheduleEntity->getMessageType());
            $messageStruct = MessageAssembler::getChatMessageStruct(
                $chatMessageType,
                $messageScheduleEntity->getMessageContent()
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
            $dataIsolation = new DataIsolation();
            $dataIsolation->setCurrentOrganizationCode($messageScheduleEntity->getOrganizationCode());
            $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);

            if (empty($aiUserEntity)) {
                $this->logger->error('Agent user not found, skip processing', [
                    'organization_code' => $messageScheduleEntity->getOrganizationCode()
                ]);
                return [
                    'success' => false,
                    'error_message' => 'Agent user not found for organization: ' . $messageScheduleEntity->getOrganizationCode(),
                    'result' => null,
                ];
            }

            // Call userSendMessageToAgent
            $result = $this->chatMessageAppService->userSendMessageToAgent(
                aiSeqDTO: $seqEntity,
                senderUserId: $messageScheduleEntity->getUserId(),
                receiverId: $aiUserEntity->getUserId(),
                appMessageId: $appMessageId,
                doNotParseReferMessageId: false,
                sendTime: new Carbon(),
                receiverType: ConversationType::Ai,
                topicId: $topicEntity->getChatTopicId()
            );

            return [
                'success' => !empty($result),
                'error_message' => null,
                'result' => $result,
            ];
        } catch (Throwable $e) {
            $this->logger->error('Failed to send message to agent', [
                'message_schedule_id' => $messageScheduleEntity->getId(),
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
}
