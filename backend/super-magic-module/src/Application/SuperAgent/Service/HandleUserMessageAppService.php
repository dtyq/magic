<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\UserMessageDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskBeforeEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Handle User Message Application Service
 * Responsible for handling the complete business process of users sending messages to agents.
 */
class HandleUserMessageAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly TopicTaskAppService $topicTaskAppService,
        private readonly FileProcessAppService $fileProcessAppService,
        private readonly ClientMessageAppService $clientMessageAppService,
        private readonly AgentAppService $agentAppService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    public function handleInternalMessage(DataIsolation $dataIsolation, UserMessageDTO $dto)
    {
        // Get topic information
        $topicEntity = $this->topicDomainService->getTopicByChatTopicId($dataIsolation, $dto->getChatTopicId());
        if (is_null($topicEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }
        // Get task information
        $taskEntity = $this->taskDomainService->getTaskById($topicEntity->getCurrentTaskId());
        if (is_null($taskEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'task.task_not_found');
        }
        // Update task status
        $this->topicTaskAppService->updateTaskStatus(
            dataIsolation: $dataIsolation,
            task: $taskEntity,
            status: TaskStatus::Suspended,
            errMsg: 'User manually terminated task',
        );
        // Get sandbox status, if sandbox is running, send interrupt command
        $result = $this->agentAppService->getSandboxStatus($topicEntity->getSandboxId());
        if ($result->getStatus() === SandboxStatus::RUNNING) {
            $this->agentAppService->sendInterruptMessage($dataIsolation, $taskEntity->getSandboxId(), (string) $taskEntity->getId(), '任务已终止.');
        } else {
            // Send interrupt message directly to client
            $this->clientMessageAppService->sendInterruptMessageToClient(
                topicId: $topicEntity->getId(),
                taskId: $topicEntity->getCurrentTaskId() ?? '0',
                chatTopicId: $dto->getChatTopicId(),
                chatConversationId: $dto->getChatConversationId(),
                interruptReason: $dto->getPrompt() ?: trans('agent.agent_stopped')
            );
        }
    }

    public function handleChatMessage(DataIsolation $dataIsolation, UserMessageDTO $dto)
    {
        $topicId = 0;
        $taskId = '';
        try {
            // Get topic information
            $topicEntity = $this->topicDomainService->getTopicByChatTopicId($dataIsolation, $dto->getChatTopicId());
            if (is_null($topicEntity)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
            }
            $topicId = $topicEntity->getId();

            // Check message before task starts
            $this->beforeHandleChatMessage($dataIsolation, $dto->getInstruction(), $topicEntity);

            // Initialize task
            $taskEntity = $this->taskDomainService->initTopicTask(
                dataIsolation: $dataIsolation,
                topicEntity: $topicEntity,
                instruction: $dto->getInstruction(),
                taskMode: $dto->getTaskMode(),
                prompt: $dto->getPrompt(),
                attachments: $dto->getAttachments(),
            );
            $taskId = (string) $taskEntity->getId();

            // Save user information
            $this->saveUserMessage($dataIsolation, $taskEntity, $dto->getAgentUserId(), $dto->getAttachments());

            // Send message to agent
            $taskContext = new TaskContext(
                task: $taskEntity,
                dataIsolation: $dataIsolation,
                chatConversationId: $dto->getChatConversationId(),
                chatTopicId: $dto->getChatTopicId(),
                agentUserId: $dto->getAgentUserId(),
                sandboxId: $topicEntity->getSandboxId(),
                taskId: (string) $taskEntity->getId(),
                instruction: ChatInstruction::FollowUp
            );
            $sandboxID = $this->createAndSendMessageToAgent($dataIsolation, $taskContext);
            $taskEntity->setSandboxId($sandboxID);

            // Update task status
            $this->topicTaskAppService->updateTaskStatus(
                dataIsolation: $dataIsolation,
                task: $taskEntity,
                status: TaskStatus::RUNNING,
                errMsg: '',
            );
        } catch (EventException $e) {
            $this->logger->error(sprintf(
                'Initialize task, event processing failed: %s',
                $e->getMessage()
            ));
            // Send error message directly to client
            $this->clientMessageAppService->sendErrorMessageToClient(
                topicId: $topicId,
                taskId: $taskId,
                chatTopicId: $dto->getChatTopicId(),
                chatConversationId: $dto->getChatConversationId(),
                errorMessage: $e->getMessage()
            );
            throw new BusinessException('Initialize task, event processing failed', 500);
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'handleChatMessage Error: %s, User: %s',
                $e->getMessage(),
                $dataIsolation->getCurrentUserId()
            ));
            // Send error message directly to client
            $this->clientMessageAppService->sendErrorMessageToClient(
                topicId: $topicId,
                taskId: $taskId,
                chatTopicId: $dto->getChatTopicId(),
                chatConversationId: $dto->getChatConversationId(),
                errorMessage: trans('agent.initialize_error')
            );
            throw new BusinessException('Initialize task failed', 500);
        }
    }

    /**
     * Pre-task detection.
     */
    private function beforeHandleChatMessage(DataIsolation $dataIsolation, ChatInstruction $instruction, TopicEntity $topicEntity): void
    {
        $currentTaskRunCount = $this->pullUserTopicStatus($dataIsolation);
        $taskRound = $this->taskDomainService->getTaskNumByTopicId($topicEntity->getId());
        AsyncEventUtil::dispatch(new RunTaskBeforeEvent($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId(), $topicEntity->getId(), $taskRound, $currentTaskRunCount));
        $this->logger->info(sprintf('Dispatched task start event, topic id: %s, round: %d, currentTaskRunCount: %d (after real status check)', $topicEntity->getId(), $taskRound, $currentTaskRunCount));
    }

    /**
     * Update topics and tasks by pulling sandbox status.
     */
    private function pullUserTopicStatus(DataIsolation $dataIsolation): int
    {
        // Get user's running tasks
        $topicEntities = $this->topicDomainService->getUserRunningTopics($dataIsolation);
        // Get sandbox IDs
        $sandboxIds = [];
        foreach ($topicEntities as $topicEntityItem) {
            $sandboxId = $topicEntityItem->getSandboxId();
            if ($sandboxId === '') {
                continue;
            }
            $sandboxIds[] = $sandboxId;
        }
        // Batch query status
        $updateSandboxIds = [];
        $result = $this->agentAppService->getBatchSandboxStatus($sandboxIds);
        foreach ($result->getSandboxStatuses() as $sandboxStatus) {
            if ($sandboxStatus['status'] != SandboxStatus::RUNNING) {
                $updateSandboxIds[] = $sandboxStatus['sandbox_id'];
            }
        }
        // Update topic status
        $this->topicDomainService->updateTopicStatusBySandboxIds($updateSandboxIds, TaskStatus::Suspended);
        // Update task status
        $this->taskDomainService->updateTaskStatusBySandboxIds($updateSandboxIds, TaskStatus::Suspended, 'Synchronize sandbox status');

        $initialRunningCount = count($topicEntities);
        $suspendedCount = count($updateSandboxIds); // Number of tasks to suspend
        return $initialRunningCount - $suspendedCount; // Number of tasks actually running
    }

    /**
     * Initialize agent environment.
     */
    private function createAndSendMessageToAgent(DataIsolation $dataIsolation, TaskContext $taskContext): string
    {
        // Create sandbox container
        $sandboxId = $this->agentAppService->createSandbox((string) $taskContext->getProjectId(), $taskContext->getSandboxId());
        $taskContext->setSandboxId($sandboxId);

        // Initialize agent
        $this->agentAppService->initializeAgent($dataIsolation, $taskContext);

        // Wait for workspace to be ready
        $this->agentAppService->waitForWorkspaceReady($taskContext->getSandboxId());

        // Send message to agent
        $this->agentAppService->sendChatMessage($dataIsolation, $taskContext);

        // Send message to agent
        return $sandboxId;
    }

    /**
     * Save user information and corresponding attachments.
     */
    private function saveUserMessage(DataIsolation $dataIsolation, TaskEntity $taskEntity, string $agentUserId, string $attachmentsStr): void
    {
        $attachmentsArr = empty($attachmentsStr) ? [] : json_decode($attachmentsStr, true);
        $this->taskDomainService->recordUserMessage(
            (string) $taskEntity->getId(),
            $dataIsolation->getCurrentUserId(),
            $agentUserId,
            $taskEntity->getPrompt(),
            null,
            $taskEntity->getTopicId(),
            '',
            $attachmentsArr
        );
        // Process user uploaded attachments
        $this->fileProcessAppService->processInitialAttachments($attachmentsStr, $taskEntity, $dataIsolation);
    }
}
