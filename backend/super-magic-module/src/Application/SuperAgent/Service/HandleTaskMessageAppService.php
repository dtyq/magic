<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\SuperAgentExtra;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\LongTermMemory\Service\LongTermMemoryDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\TaskMessageDTO;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\UserMessageDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ScriptTaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\CreationSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskBeforeEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateScriptTaskRequestDTO;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Message\Role;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Handle User Message Application Service
 * Responsible for handling the complete business process of users sending messages to agents.
 */
class HandleTaskMessageAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly MagicDepartmentUserDomainService $departmentUserDomainService,
        private readonly TopicTaskAppService $topicTaskAppService,
        private readonly FileProcessAppService $fileProcessAppService,
        private readonly AgentDomainService $agentDomainService,
        private readonly AccessTokenDomainService $accessTokenDomainService,
        private readonly MagicUserDomainService $userDomainService,
        private readonly LongTermMemoryDomainService $longTermMemoryDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ChatAppService $chatAppService,
        private readonly ModelGatewayMapper $modelGatewayMapper,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    public function initSandbox(DataIsolation $dataIsolation, UserMessageDTO $userMessageDTO): array
    {
        $topicId = 0;
        $taskId = '';
        try {
            // Get topic information
            $topicEntity = $this->topicDomainService->getTopicById($userMessageDTO->getTopicId());
            if (is_null($topicEntity)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
            }
            $topicId = $topicEntity->getId();

            // Resolve the correct agentUserId and chatConversationId for this topic.
            // The initSandbox path is invoked via API (not IM), so the caller does not supply these.
            // agentUserId is the Super Magic system AI user for the current organisation.
            // chatConversationId must be the AI agent's conversation (owner = AI, receiver = human)
            // because aiSendMessage() validates that the conversation owner is an AI user.
            // The value stored on the topic entity is the human's conversation (owner = human), which
            // would cause aiSendMessage() to throw USER_NOT_EXIST.
            $agentUserId = $this->chatAppService->getSuperMagicAgentUserId($dataIsolation);
            $chatConversationId = $this->chatAppService->getSuperMagicAgentConversationId($dataIsolation);

            // Pre-generate task ID so that RunTaskBeforeEvent subscribers (e.g. image_model_versions,
            // ai_abilities) can register dynamic configs keyed by this ID before sendChatMessage reads them.
            $taskId = (string) IdGenerator::getSnowId();

            // Check message before task starts
            $this->beforeHandleChatMessage($dataIsolation, $userMessageDTO->getInstruction(), $topicEntity, $userMessageDTO->getLanguage(), $userMessageDTO->getModelId(), $taskId, $userMessageDTO->getPrompt(), $userMessageDTO->getMentions());

            // Get task mode from DTO, fallback to topic's task mode if empty
            $taskMode = $userMessageDTO->getTaskMode();
            if ($taskMode === '') {
                $taskMode = $topicEntity->getTaskMode();
            }

            $data = [
                'id' => (int) $taskId,
                'user_id' => $dataIsolation->getCurrentUserId(),
                'workspace_id' => $topicEntity->getWorkspaceId(),
                'project_id' => $topicEntity->getProjectId(),
                'topic_id' => $topicId,
                'task_id' => '', // Initially empty, this is agent's task id
                'task_mode' => $taskMode,
                'topic_mode' => $userMessageDTO->getTopicMode(),
                'sandbox_id' => $topicEntity->getSandboxId(), // Current task prioritizes reusing previous topic's sandbox id
                'prompt' => $userMessageDTO->getPrompt(),
                'attachments' => $userMessageDTO->getAttachments(),
                'mentions' => $userMessageDTO->getMentions(),
                'model_id' => $userMessageDTO->getModelId(),
                'task_status' => TaskStatus::WAITING->value,
                'work_dir' => $topicEntity->getWorkDir() ?? '',
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            $taskEntity = TaskEntity::fromArray($data);
            // Initialize task
            $taskEntity = $this->taskDomainService->initTopicTask(
                dataIsolation: $dataIsolation,
                topicEntity: $topicEntity,
                taskEntity: $taskEntity
            );

            $taskId = (string) $taskEntity->getId();

            // Save user information
            $this->saveUserMessage($dataIsolation, $taskEntity, $userMessageDTO, $agentUserId);

            // Check if this is the first task for the topic
            // If topic source is COPY, it's not the first task
            $isFirstTask = (empty($topicEntity->getCurrentTaskId()) || empty($topicEntity->getSandboxId()))
                && CreationSource::fromValue($topicEntity->getSource()) !== CreationSource::COPY;

            // Resolve image model: use the caller-supplied ID or fall back to first available model.
            $extra = $this->buildExtraWithImageModel($dataIsolation, $userMessageDTO->getImageModelId());

            // Send message to agent
            $taskContext = new TaskContext(
                task: $taskEntity,
                dataIsolation: $dataIsolation,
                chatConversationId: $chatConversationId,
                chatTopicId: $userMessageDTO->getChatTopicId(),
                agentUserId: $agentUserId,
                sandboxId: $topicEntity->getSandboxId(),
                taskId: (string) $taskEntity->getId(),
                instruction: ChatInstruction::FollowUp,
                agentMode: $userMessageDTO->getTopicMode(),
                modelId: $userMessageDTO->getModelId(),
                isFirstTask: $isFirstTask,
                extra: $extra,
            );
            $taskContext = $this->appendVideoModelDynamicConfig($taskContext, $userMessageDTO->getExtra());
            $sandboxID = $this->createAgent($dataIsolation, $taskContext, $topicEntity);
            $taskEntity->setSandboxId($sandboxID);

            // Update task status
            $this->topicTaskAppService->updateTaskStatus(
                dataIsolation: $dataIsolation,
                task: $taskEntity,
                status: TaskStatus::RUNNING
            );

            return ['sandbox_id' => $sandboxID, 'task_id' => $taskId];
        } catch (EventException $e) {
            $this->logger->error(sprintf(
                'Initialize task, event processing failed: %s',
                $e->getMessage()
            ));
            // Send error message directly to client
            // $this->clientMessageAppService->sendErrorMessageToClient(
            //     topicId: $topicId,
            //     taskId: $taskId,
            //     chatTopicId: $userMessageDTO->getChatTopicId(),
            //     chatConversationId: $userMessageDTO->getChatConversationId(),
            //     errorMessage: $e->getMessage()
            // );
            throw new BusinessException('Initialize task, event processing failed:' . $e->getMessage(), 500);
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'handleChatMessage Error: %s, User: %s file: %s line: %s trace: %s',
                $e->getMessage(),
                $dataIsolation->getCurrentUserId(),
                $e->getFile(),
                $e->getLine(),
                $e->getTraceAsString()
            ));
            // Send error message directly to client
            // $this->clientMessageAppService->sendErrorMessageToClient(
            //     topicId: $topicId,
            //     taskId: $taskId,
            //     chatTopicId: $userMessageDTO->getChatTopicId(),
            //     chatConversationId: $userMessageDTO->getChatConversationId(),
            //     errorMessage: trans('agent.initialize_error')
            // );
            throw new BusinessException('Initialize task failed:' . $e->getMessage(), 500);
        }
    }

    public function sendChatMessage(DataIsolation $dataIsolation, UserMessageDTO $userMessageDTO): TaskEntity
    {
        $topicEntity = $this->topicDomainService->getTopicByChatTopicId($dataIsolation, $userMessageDTO->getChatTopicId());
        if (is_null($topicEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        // Resolve the correct agentUserId and chatConversationId for this topic.
        // Callers that come through the API (not IM) may not supply these correctly.
        // chatConversationId must be the AI agent's conversation (owner = AI, receiver = human)
        // because aiSendMessage() validates that the conversation owner is an AI user.
        $agentUserId = $this->chatAppService->getSuperMagicAgentUserId($dataIsolation);
        $chatConversationId = $this->chatAppService->getSuperMagicAgentConversationId($dataIsolation);

        $data = [
            'user_id' => $dataIsolation->getCurrentUserId(),
            'workspace_id' => $topicEntity->getWorkspaceId(),
            'project_id' => $topicEntity->getProjectId(),
            'topic_id' => $topicEntity->getId(),
            'task_id' => '', // Initially empty, this is agent's task id
            'task_mode' => $topicEntity->getTaskMode(),
            'sandbox_id' => $topicEntity->getSandboxId(), // Current task prioritizes reusing previous topic's sandbox id
            'prompt' => $userMessageDTO->getPrompt(),
            'attachments' => $userMessageDTO->getAttachments(),
            'mentions' => $userMessageDTO->getMentions(),
            'task_status' => TaskStatus::WAITING->value,
            'work_dir' => $topicEntity->getWorkDir() ?? '',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        $taskEntity = TaskEntity::fromArray($data);
        // Initialize task
        $taskEntity = $this->taskDomainService->initTopicTask(
            dataIsolation: $dataIsolation,
            topicEntity: $topicEntity,
            taskEntity: $taskEntity
        );

        // Check if this is the first task for the topic
        // If topic source is COPY, it's not the first task
        $isFirstTask = (empty($topicEntity->getCurrentTaskId()) || empty($topicEntity->getSandboxId()))
            && CreationSource::fromValue($topicEntity->getSource()) !== CreationSource::COPY;

        // Send message to agent
        $taskContext = new TaskContext(
            task: $taskEntity,
            dataIsolation: $dataIsolation,
            chatConversationId: $chatConversationId,
            chatTopicId: $userMessageDTO->getChatTopicId(),
            agentUserId: $agentUserId,
            sandboxId: $topicEntity->getSandboxId(),
            taskId: (string) $taskEntity->getId(),
            instruction: ChatInstruction::FollowUp,
            agentMode: $userMessageDTO->getTopicMode(),
            modelId: $userMessageDTO->getModelId(),
            isFirstTask: $isFirstTask,
            extra: $userMessageDTO->getExtra(),
        );
        $taskContext = $this->appendVideoModelDynamicConfig($taskContext, $userMessageDTO->getExtra());
        $this->agentDomainService->sendChatMessage($dataIsolation, $taskContext);
        $taskEntity->setTaskId((string) $taskEntity->getId());
        return $taskEntity;
    }

    /**
     * Summary of getUserAuthorization.
     */
    public function getUserAuthorization(string $apiKey, string $uid = ''): ?MagicUserEntity
    {
        $accessToken = $this->accessTokenDomainService->getByAccessToken($apiKey);
        if (empty($accessToken)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::ACCESS_TOKEN_NOT_FOUND, 'Access token not found');
        }

        if (empty($uid)) {
            if ($accessToken->getType() !== AccessTokenType::Application->value) {
                $uid = $accessToken->getCreator();
            }
        }

        return $this->userDomainService->getByUserId(uid: $uid);
    }

    public function getTask(int $taskId): TaskEntity
    {
        $taskEntity = $this->taskDomainService->getTaskById($taskId);

        if (empty($taskEntity)) {
            // 抛异常，任务不存在
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'task.task_not_found');
        }
        return $taskEntity;
    }

    public function getTaskBySandboxId(string $sandboxId): TaskEntity
    {
        return $this->taskDomainService->getTaskBySandboxId($sandboxId);
    }

    public function executeScriptTask(CreateScriptTaskRequestDTO $requestDTO): void
    {
        $scriptTaskEntity = new ScriptTaskEntity();
        $scriptTaskEntity->setSandboxId($requestDTO->getSandboxId());
        $scriptTaskEntity->setTaskId($requestDTO->getTaskId());
        $scriptTaskEntity->setScriptName($requestDTO->getScriptName());
        $scriptTaskEntity->setArguments($requestDTO->getArguments());
        $this->taskDomainService->executeScriptTask($scriptTaskEntity);
    }

    /**
     * Pre-task detection.
     */
    private function beforeHandleChatMessage(DataIsolation $dataIsolation, ChatInstruction $instruction, TopicEntity $topicEntity, string $language, string $modelId = '', string $taskId = '', string $prompt = '', ?string $mentions = null): void
    {
        // Get running topic IDs and calculate current task run count
        $runningTopicIds = $this->pullUserTopicStatus($dataIsolation);
        $currentTaskRunCount = count($runningTopicIds);
        $taskRound = $this->taskDomainService->getTaskNumByTopicId($topicEntity->getId());
        // get department ids
        $departmentIds = [];
        $departmentUserEntities = $this->departmentUserDomainService->getDepartmentUsersByUserIds([$dataIsolation->getCurrentUserId()], $dataIsolation);
        foreach ($departmentUserEntities as $departmentUserEntity) {
            $departmentIds[] = $departmentUserEntity->getDepartmentId();
        }
        AsyncEventUtil::dispatch(new RunTaskBeforeEvent($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId(), $topicEntity->getId(), $taskRound, $currentTaskRunCount, $runningTopicIds, $departmentIds, $language, $modelId, $taskId, $prompt, $mentions ?? ''));
        $this->logger->info(sprintf('Dispatched task start event, topic id: %s, task id: %s, round: %d, currentTaskRunCount: %d (after real status check)', $topicEntity->getId(), $taskId, $taskRound, $currentTaskRunCount));
    }

    /**
     * Update topics and tasks by pulling sandbox status.
     *
     * @return int[] Running topic IDs
     */
    private function pullUserTopicStatus(DataIsolation $dataIsolation): array
    {
        // Get user's running tasks
        $topicEntities = $this->topicDomainService->getUserRunningTopics($dataIsolation);
        // Get sandbox IDs and build sandboxId to topicId mapping
        $sandboxIds = [];
        $sandboxIdToTopicId = [];
        foreach ($topicEntities as $topicEntityItem) {
            $sandboxId = $topicEntityItem->getSandboxId();
            if ($sandboxId === '') {
                continue;
            }
            $sandboxIds[] = $sandboxId;
            $sandboxIdToTopicId[$sandboxId] = $topicEntityItem->getId();
        }
        if (count($sandboxIds) === 0) {
            return [];
        }
        // Batch query status
        $result = $this->agentDomainService->getBatchSandboxStatus($sandboxIds);

        // Get running sandbox IDs from remote result
        $runningSandboxIds = $result->getRunningSandboxIds();

        // Find sandbox IDs that are not running (including missing ones)
        $updateSandboxIds = array_diff($sandboxIds, $runningSandboxIds);
        // Update topic status
        $this->topicDomainService->updateTopicStatusBySandboxIds($updateSandboxIds, TaskStatus::Suspended);
        // Update task status
        $this->taskDomainService->updateTaskStatusBySandboxIds($updateSandboxIds, TaskStatus::Suspended, 'Synchronize sandbox status');

        // Collect running topic IDs
        $runningTopicIds = [];
        foreach ($runningSandboxIds as $sandboxId) {
            if (isset($sandboxIdToTopicId[$sandboxId])) {
                $runningTopicIds[] = $sandboxIdToTopicId[$sandboxId];
            }
        }
        return $runningTopicIds;
    }

    /**
     * Initialize agent environment.
     */
    private function createAgent(DataIsolation $dataIsolation, TaskContext $taskContext, TopicEntity $topicEntity): string
    {
        $projectEntity = $this->projectDomainService->getProjectNotUserId($taskContext->getTask()->getProjectId());
        if ($projectEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND);
        }

        $memories = $this->longTermMemoryDomainService->getEffectiveMemoriesForSandbox(
            $dataIsolation->getCurrentOrganizationCode(),
            AppCodeEnum::SUPER_MAGIC->value,
            $dataIsolation->getCurrentUserId(),
            (string) $taskContext->getProjectId(),
        );

        $agentContext = $this->agentDomainService->buildInitAgentContext(
            dataIsolation: $dataIsolation,
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            taskEntity: $taskContext->getTask(),
            sandboxId: (string) $topicEntity->getId(),
            memories: $memories
        );

        $sandboxId = $this->agentDomainService->ensureSandboxInitialized($dataIsolation, $agentContext);

        $this->topicDomainService->updateTopicSandboxId($dataIsolation, $taskContext->getTopicId(), $sandboxId);
        $this->taskDomainService->updateTaskSandboxId($dataIsolation, $taskContext->getTask()->getId(), $sandboxId);
        $taskContext->setSandboxId($sandboxId);

        $this->agentDomainService->sendChatMessage($dataIsolation, $taskContext);

        return $sandboxId;
    }

    /**
     * Save user information and corresponding attachments.
     */
    private function saveUserMessage(DataIsolation $dataIsolation, TaskEntity $taskEntity, UserMessageDTO $userMessageDTO, string $agentUserId = ''): void
    {
        // Convert mentions string to array if not null
        $mentionsArray = $userMessageDTO->getMentions() !== null ? json_decode($userMessageDTO->getMentions(), true) : null;

        // Convert attachments string to array if not null
        $attachmentsArray = $userMessageDTO->getAttachments() !== null ? json_decode($userMessageDTO->getAttachments(), true) : null;

        // Use the explicitly resolved agentUserId when provided; fall back to the DTO value for other callers.
        $receiverUid = $agentUserId !== '' ? $agentUserId : $userMessageDTO->getAgentUserId();

        // Create TaskMessageDTO for user message
        $taskMessageDTO = new TaskMessageDTO(
            taskId: (string) $taskEntity->getId(),
            role: Role::User->value,
            senderUid: $dataIsolation->getCurrentUserId(),
            receiverUid: $receiverUid,
            messageType: 'chat',
            content: $taskEntity->getPrompt(),
            status: null,
            steps: null,
            tool: null,
            topicId: $taskEntity->getTopicId(),
            event: '',
            attachments: $attachmentsArray,
            mentions: $mentionsArray,
            showInUi: true,
            messageId: null
        );

        $taskMessageEntity = TaskMessageEntity::taskMessageDTOToTaskMessageEntity($taskMessageDTO);

        $this->taskDomainService->recordTaskMessage($taskMessageEntity);

        // Process user uploaded attachments
        $attachmentsStr = $userMessageDTO->getAttachments();
        $this->fileProcessAppService->processInitialAttachments($attachmentsStr, $taskEntity, $dataIsolation);
    }

    /**
     * Build SuperAgentExtra with image model.
     * Uses the provided imageModelId, or falls back to the first available model for the organisation.
     */
    private function buildExtraWithImageModel(DataIsolation $dataIsolation, string $imageModelId): SuperAgentExtra
    {
        if (empty($imageModelId)) {
            $gatewayIsolation = ModelGatewayDataIsolation::createByOrganizationCodeWithoutSubscription(
                $dataIsolation->getCurrentOrganizationCode()
            );
            $imageModels = $this->modelGatewayMapper->getImageModels($gatewayIsolation);
            if (! empty($imageModels)) {
                $imageModelId = $imageModels[0]->getKey();
            }
        }

        $extra = new SuperAgentExtra([]);
        if (! empty($imageModelId)) {
            $extra->setImageModel(['model_id' => $imageModelId]);
        }
        return $extra;
    }
}
