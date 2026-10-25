<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAccessAppService;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Application\SuperMagic\File\Service\FileProcessAppService;
use App\Application\SuperMagic\Message\Assembler\UserMessageDTOAssembler;
use App\Application\SuperMagic\Message\DTO\TaskInitializationMessageDTO;
use App\Application\SuperMagic\Message\Event\Publish\TopicMessageProcessPublisher;
use App\Application\SuperMagic\Message\Service\ClientMessageAppService;
use App\Application\SuperMagic\Task\Event\Publish\TaskInitializationPublisher;
use App\Application\SuperMagic\Topic\Service\TopicAgentConfigResolver;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\MessageExtra;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\SuperAgentExtra;
use App\Domain\Chat\DTO\Message\MagicMessageStruct;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentMarketDomainService;
use App\Domain\SuperMagic\Agent\Service\UserAgentDomainService;
use App\Domain\SuperMagic\Common\Entity\ValueObject\AskUserStatus;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\Common\Entity\ValueObject\SuperMagicExecutionSource;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Message\Entity\MessageQueueEntity;
use App\Domain\SuperMagic\Message\Entity\TaskMessageEntity;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageType;
use App\Domain\SuperMagic\Message\Event\MessageQueueCreatedEvent;
use App\Domain\SuperMagic\Message\Event\TopicMessageProcessEvent;
use App\Domain\SuperMagic\Message\Repository\Model\TaskMessageModel;
use App\Domain\SuperMagic\Message\Service\MessageQueueDomainService;
use App\Domain\SuperMagic\Message\Service\TaskMessageDomainService;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Constant\AgentConstant;
use App\Domain\SuperMagic\Task\Constant\AgentEventEnum;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRootFileIds;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Event\FirstTaskCompletedEvent;
use App\Domain\SuperMagic\Task\Event\RunTaskAfterEvent;
use App\Domain\SuperMagic\Task\Event\RunTaskBeforeEvent;
use App\Domain\SuperMagic\Task\Event\RunTaskCallbackEvent;
use App\Domain\SuperMagic\Task\Event\TaskInitializationEvent;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\SandboxDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Task\Service\UsageCalculator\UsageCalculatorInterface;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\UserToolCallNotFoundException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\UserToolCallRecoveryException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use App\Infrastructure\SuperMagic\Utils\TaskStatusValidator;
use App\Infrastructure\SuperMagic\Utils\TaskTerminationUtil;
use App\Infrastructure\SuperMagic\Utils\ToolProcessor;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use App\Interfaces\SuperMagic\Message\DTO\Response\DeliverMessageResponseDTO;
use App\Interfaces\SuperMagic\Message\DTO\TopicTaskMessageDTO;
use App\Interfaces\SuperMagic\Task\DTO\Request\CreateOpenTaskRequestDTO;
use App\Interfaces\SuperMagic\Task\DTO\Request\CreateTaskRequestDTO;
use Carbon\Carbon;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\Amqp\Producer;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Message\Role;
use Hyperf\Redis\Redis;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;
use TypeError;
use ValueError;

class TopicTaskAppService extends AbstractAppService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly FileProcessAppService $fileProcessAppService,
        private readonly ClientMessageAppService $clientMessageAppService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskNotificationLabelResolver $taskNotificationLabelResolver,
        private readonly TaskDomainService $taskDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly TaskMessageDomainService $taskMessageDomainService,
        private readonly MessageQueueDomainService $messageQueueDomainService,
        private readonly SandboxDomainService $sandboxDomainService,
        private readonly AgentDomainService $agentDomainService,
        private readonly MagicChatMessageAppService $chatMessageAppService,
        private readonly EventDispatcherInterface $eventDispatcher,
        protected MagicUserDomainService $userDomainService,
        protected MagicDepartmentUserDomainService $departmentUserDomainService,
        protected LockerInterface $locker,
        protected LoggerFactory $loggerFactory,
        protected TranslatorInterface $translator,
        protected UsageCalculatorInterface $usageCalculator,
        protected Redis $redis,
        protected Producer $producer,
        private readonly SuperMagicAgentAccessAppService $superMagicAgentAccessAppService,
        private readonly TopicAgentConfigResolver $topicAgentConfigResolver,
        private readonly UserAgentDomainService $userAgentDomainService,
        private readonly SuperMagicAgentMarketDomainService $superMagicAgentMarketDomainService,
        private readonly SuperMagicAgentDomainService $superMagicAgentDomainService,
        private readonly ResourceVisibilityDomainService $resourceVisibilityDomainService,
    ) {
        $this->logger = $this->loggerFactory->get(get_class($this));
    }

    /**
     * Deliver topic task message.
     *
     * @return array Operation result
     */
    public function deliverTopicTaskMessage(DataIsolation $dataIsolation, TopicTaskMessageDTO $messageDTO): array
    {
        [$taskEntity, $topicEntity] = $this->getAuthorizedTaskAndTopic($dataIsolation, $messageDTO);
        $taskId = (string) $taskEntity->getId();
        $sandboxId = $taskEntity->getSandboxId() ?: $topicEntity->getSandboxId();
        $metadata = $messageDTO->getMetadata();
        $language = $this->translator->getLocale();
        $metadata->setLanguage($language);
        $messageDTO->setMetadata($metadata);
        $messageId = $messageDTO->getPayload()->getMessageId();
        $seqId = $messageDTO->getPayload()->getSeqId();

        $this->logger->debug('开始处理话题任务消息投递', [
            'sandbox_id' => $sandboxId,
            'message_id' => $messageDTO->getPayload()?->getMessageId(),
        ]);

        $lockKey = 'deliver_sandbox_message_lock:' . $sandboxId;
        $lockOwner = IdGenerator::getUniqueId32(); // Use unique ID as lock holder identifier
        $lockExpireSeconds = 10; // Lock expiration time (seconds) to prevent deadlock
        $lockAcquired = false;

        try {
            // Attempt to acquire distributed mutex lock
            $lockAcquired = $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);
            if ($lockAcquired) {
                // 判断 seq_id 是否是期望的值
                $exceptedSeqId = $this->taskMessageDomainService->getNextSeqId($topicEntity->getId(), $taskEntity->getId());
                if ($seqId !== $exceptedSeqId) {
                    $this->logger->error('seq_id 不是期望的值', ['seq_id' => $seqId, 'expected_seq_id' => $exceptedSeqId]);
                }

                $topicId = $topicEntity->getId();
                // 2. 在应用层完成DTO到实体的转换
                // Get message ID (prefer message ID from payload, generate new one if none)
                $messageId = $messageDTO->getPayload()?->getMessageId() ?: IdGenerator::getSnowId();
                $dataIsolation = $this->createContactDataIsolationByUser($topicEntity->getUserOrganizationCode(), $topicEntity->getUserId());
                $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);
                $messageEntity = $messageDTO->toTaskMessageEntity($topicId, $aiUserEntity->getUserId(), $topicEntity->getUserId());

                // 3. 存储消息到数据库（调用领域层服务）
                $this->taskMessageDomainService->storeTopicTaskMessage($messageEntity, $messageDTO->toArray());

                // 4. 发布轻量级的处理事件
                $processEvent = new TopicMessageProcessEvent($topicId, $taskEntity->getId());
                $processPublisher = new TopicMessageProcessPublisher($processEvent);

                $producer = di(Producer::class);
                $result = $producer->produce($processPublisher);

                if (! $result) {
                    $this->logger->error('发布消息处理事件失败', [
                        'topic_id' => $topicId,
                        'sandbox_id' => $sandboxId,
                        'message_id' => $messageDTO->getPayload()?->getMessageId(),
                    ]);
                    ExceptionBuilder::throw(GenericErrorCode::SystemError, 'message_process_event_publish_failed');
                }

                $this->logger->debug('话题任务消息投递完成', [
                    'topic_id' => $topicId,
                    'sandbox_id' => $sandboxId,
                    'message_id' => $messageDTO->getPayload()?->getMessageId(),
                ]);
            }
        } catch (Throwable $e) {
            $this->logger->error('话题任务消息投递失败', [
                'sandbox_id' => $sandboxId,
                'message_id' => $messageDTO->getPayload()?->getMessageId(),
                'error' => $e->getMessage(),
            ]);
            throw $e;
        } finally {
            if ($lockAcquired) {
                if ($this->locker->release($lockKey, $lockOwner)) {
                    $this->logger->debug(sprintf('Lock released for sandbox %s by %s', $sandboxId, $lockOwner));
                } else {
                    // Log lock release failure, may require manual intervention
                    $this->logger->error(sprintf('Failed to release lock for sandbox %s held by %s. Manual intervention may be required.', $sandboxId, $lockOwner));
                }
            }
        }

        return DeliverMessageResponseDTO::fromResult(true, $messageId)->toArray();
    }

    public function handleTopicTaskMessage(DataIsolation $dataIsolation, TopicTaskMessageDTO $messageDTO): array
    {
        [$taskEntity, $topicEntity] = $this->getAuthorizedTaskAndTopic($dataIsolation, $messageDTO);
        $taskId = (string) $taskEntity->getId();
        $metadata = $messageDTO->getMetadata();
        $language = $this->translator->getLocale();
        $metadata->setLanguage($language);
        $messageDTO->setMetadata($metadata);
        $messageId = $messageDTO->getPayload()->getMessageId();
        $topicId = $topicEntity->getId();

        $this->logger->debug('开始处理话题任务消息', [
            'topic_id' => $topicId,
            'task_id' => $taskId,
            'message_id' => $messageId,
        ]);

        // 获取话题级别的锁
        $lockKey = 'handle_topic_message_lock:' . $topicId;
        $lockOwner = IdGenerator::getUniqueId32();
        $lockExpireSeconds = 15; // 锁过期时间
        $lockAcquired = false;

        try {
            // 尝试获取分布式锁
            $lockAcquired = $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);
            if (! $lockAcquired) {
                $this->logger->warning('无法获取话题锁，消息处理跳过', [
                    'topic_id' => $topicId,
                    'message_id' => $messageId,
                ]);
                ExceptionBuilder::throw(GenericErrorCode::SystemError, 'unable_to_acquire_topic_lock');
            }

            $status = $messageDTO->getPayload()->getStatus();
            $taskStatus = TaskStatus::tryFrom($status) ?? TaskStatus::ERROR;

            // 先落库等待状态，再保存和发布提问消息。这样定时检查或容器回收看到的
            // 都是 WAITING_FOR_USER，不会在提问卡已经出现后把任务误判成 RUNNING。
            if ($this->isWaitingForUserMessage($messageDTO)
                && $taskEntity->getStatus() !== TaskStatus::WAITING_FOR_USER
            ) {
                $this->updateTaskStatus(
                    dataIsolation: $dataIsolation,
                    task: $taskEntity,
                    status: TaskStatus::WAITING_FOR_USER,
                );
                $taskEntity->setStatus(TaskStatus::WAITING_FOR_USER);
            }

            $usage = [];
            if ($taskStatus->isFinal()) {
                // Calculate usage information when task is finished
                $usage = $this->usageCalculator->calculateUsage((int) $taskId);
            }

            // 2，存储消息
            $messageEntity = $this->taskMessageDomainService->findByTopicIdAndMessageId($topicId, $messageId);
            if (is_null($messageEntity)) {
                // Create new message
                $messageEntity = $this->parseMessageContent($messageDTO);
                $messageEntity->setTopicId($topicId);
                $tool = $messageEntity->getTool();
                $this->fileProcessAppService->processToolDetailFileReference($tool, $taskEntity, $dataIsolation);
                $messageEntity->setTool($tool);
                // Special status handling: generate output content tool when task is finished
                if ($messageEntity->getStatus() === TaskStatus::FINISHED->value) {
                    $outputTool = ToolProcessor::generateOutputContentTool($messageEntity->getAttachments());
                    if ($outputTool !== null) {
                        $messageEntity->setTool($outputTool);
                    }
                }
                $this->processToolContent($dataIsolation, $taskEntity, $messageEntity);
                // Set usage if task is finished
                if (! empty($usage)) {
                    $messageEntity->setUsage($usage);
                }
                $this->taskMessageDomainService->storeTopicTaskMessage($messageEntity, [], TaskMessageModel::PROCESSING_STATUS_COMPLETED);
            }

            // 3. 推送消息给客户端（异步处理）
            if ($messageEntity->getShowInUi()) {
                $this->clientMessageAppService->sendMessageToClient(
                    messageId: $messageEntity->getId(),
                    topicId: $topicId,
                    taskId: (string) $taskEntity->getId(),
                    chatTopicId: $metadata->getChatTopicId(),
                    chatConversationId: $metadata->getChatConversationId(),
                    content: $messageEntity->getContent(),
                    messageType: $messageEntity->getType(),
                    status: $messageEntity->getStatus(),
                    event: $messageEntity->getEvent(),
                    steps: $messageEntity->getSteps() ?? [],
                    tool: $messageEntity->getTool() ?? [],
                    attachments: $messageEntity->getAttachments() ?? [],
                    correlationId: $messageDTO->getPayload()->getCorrelationId() ?? null,
                    parentCorrelationId: $messageDTO->getPayload()->getParentCorrelationId() ?? null,
                    contentType: $messageDTO->getPayload()->getContentType() ?? null,
                    usage: ! empty($usage) ? $usage : null,
                    rawContent: $messageEntity->getRawContent(),
                );
            }

            // 3.5 user tool call Human-in-the-Loop（见 tryEarlyDeliverResponseForUserToolCall）
            if (($earlyDeliverResponse = $this->tryEarlyDeliverResponseForUserToolCall($messageDTO, $dataIsolation, $taskEntity, $messageId)) !== null) {
                return $earlyDeliverResponse;
            }

            // 3.6 super_magic_message + after_main_agent_run + waiting_for_user 状态适配
            if (($earlyDeliverResponse = $this->tryHandleWaitingForUserOnMainAgentRun($messageDTO, $dataIsolation, $taskEntity, $messageId)) !== null) {
                return $earlyDeliverResponse;
            }

            // 4. 更新话题状态
            if ($taskStatus->isFinal() && TaskStatus::tryFrom($status)) {
                $this->updateTopicTokenUsedOnTaskFinal($messageDTO, $topicId);
                $this->updateTaskStatus(
                    dataIsolation: $dataIsolation,
                    task: $taskEntity,
                    status: $taskStatus,
                    errMsg: ''
                );
                // 5. 派发回调事件 - 仅在任务完成或失败时触发，不包括 Stopped 状态
                $this->dispatchCallbackEvent($messageDTO, $dataIsolation, $topicId, $taskEntity, $topicEntity);
            }

            $this->logger->debug('话题任务消息处理完成', [
                'topic_id' => $topicId,
                'task_id' => $taskId,
                'message_id' => $messageId,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('话题任务消息处理失败', [
                'topic_id' => $topicId,
                'task_id' => $taskId,
                'message_id' => $messageId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        } finally {
            if ($lockAcquired) {
                if ($this->locker->release($lockKey, $lockOwner)) {
                    $this->logger->debug(sprintf('已释放话题锁 topic_id: %d, owner: %s', $topicId, $lockOwner));
                } else {
                    $this->logger->error(sprintf('释放话题锁失败 topic_id: %d, owner: %s，可能需要人工干预', $topicId, $lockOwner));
                }
            }
        }

        return DeliverMessageResponseDTO::fromResult(true, $messageId)->toArray();
    }

    /**
     * Update task status.
     */
    public function updateTaskStatus(DataIsolation $dataIsolation, TaskEntity $task, TaskStatus $status, string $errMsg = ''): void
    {
        $taskId = (string) $task?->getId();
        try {
            // Get current task status for validation
            $currentStatus = $task?->getStatus();
            // Use utility class to validate status transition
            if (! TaskStatusValidator::isTransitionAllowed($currentStatus, $status)) {
                $reason = TaskStatusValidator::getRejectReason($currentStatus, $status);
                $this->logger->debug('Rejected status update', [
                    'task_id' => $taskId,
                    'current_status' => $currentStatus->value ?? 'null',
                    'new_status' => $status->value,
                    'reason' => $reason,
                    'error_msg' => $errMsg,
                ]);
                return; // Silently reject update
            }

            // Execute status update
            $this->taskDomainService->updateTaskStatus(
                $status,
                $task->getId(),
                $taskId,
                $task->getSandboxId(),
                $errMsg
            );
            // 任务行里的 sandbox_id 是【建任务那一刻】抄下的话题绑定快照；任务
            // 结束时，下面会把它写回话题。任务的"结束"由终态消息何时到达决定，
            // 与沙箱生死完全解耦——任务可能比沙箱活得久（长时间挂起、终态消息
            // 靠补偿补投），期间话题可能已被换绑多次：
            //
            //   时间   话题指针 topics.sandbox_id           pod 状态
            //   ----   -----------------------------       ------------------
            //   t0     W0  (建任务, 抄下快照 W0)          W0*
            //   t1     W1  (预热池 mount 换绑)            W0x W1*
            //   t2     W2  (又一次换绑)                   W0x W1* W2*
            //   t3     W0  (任务结束, 无条件写回快照)     W0x W1* W2*
            //              ^^ 回滚! 指针指向早已销毁的沙箱
            //   t4     W3  (下个请求探测 W0 失败,再绑)    W0x W1* W2* W3*
            //
            //   t3 的回滚 + t4 的"自愈"，让 W1、W2 相继脱离指针视野——每绕开
            //   一个活 pod 就泄漏一个（*=活, x=死），同 topic-id 的重复沙箱
            //   就这样跨天滚雪球。因此仅当话题绑定仍是本任务快照指向的沙箱时
            //   才写回，否则只更新任务状态，不碰 sandbox_id。
            $currentTopic = $this->topicDomainService->getTopicById($task->getTopicId());
            if ($currentTopic !== null && $currentTopic->getSandboxId() === $task->getSandboxId()) {
                $this->topicDomainService->updateTopicStatusAndSandboxId($task->getTopicId(), $task->getId(), $status, $task->getSandboxId());
            } else {
                $this->logger->info('Skip writing back stale task sandbox_id to topic', [
                    'task_id' => $taskId,
                    'topic_id' => $task->getTopicId(),
                    'task_sandbox_id' => $task->getSandboxId(),
                    'topic_sandbox_id' => $currentTopic?->getSandboxId() ?? '',
                ]);
                $this->topicDomainService->updateTopicStatus($task->getTopicId(), $task->getId(), $status);
            }

            $this->projectDomainService->updateProjectStatus($task->getProjectId(), $task->getTopicId(), $status);

            // 首次成功完成任务：派发事件供 OpenPanel 属性与事件同步（是否首次由幂等写入保证）
            if ($status === TaskStatus::FINISHED) {
                $this->logger->info('派发首次完成任务埋点事件', [
                    'user_id' => $dataIsolation->getCurrentUserId(),
                    'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                    'task_id' => $task->getId(),
                ]);

                AsyncEventUtil::dispatch(new FirstTaskCompletedEvent(
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode(),
                    (int) $task->getId(),
                    date('Y-m-d H:i:s'),
                    (string) $task->getTaskMode(),
                    $this->resolveTaskDurationSeconds($task)
                ));
            }

            // Log success
            $this->logger->debug('Task status update completed', [
                'task_id' => $taskId,
                'sandbox_id' => $task->getSandboxId(),
                'previous_status' => $currentStatus->value ?? 'null',
                'new_status' => $status->value,
                'error_msg' => $errMsg,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to update task status', [
                'task_id' => $taskId,
                'sandbox_id' => $task->getSandboxId(),
                'status' => $status->value,
                'error' => $e->getMessage(),
                'error_msg' => $errMsg,
            ]);
            throw $e;
        }
    }

    /**
     * 处理用户工具调用的答复（Human-in-the-Loop 回调入口）.
     *
     * @param DataIsolation $dataIsolation 数据隔离上下文（来自 WebSocket 认证用户）
     * @param string $chatTopicId 会话 topic ID，用于定位当前任务
     * @param string $name 工具名称（如 ask_user、plan）
     * @param string $toolCallId 工具调用ID（tool_call_id），对应沙盒下发的调用标识
     * @param array $detail 工具特定的回复数据，结构由各工具自行约定，直接透传给沙盒
     */
    public function handleUserToolCallReply(
        DataIsolation $dataIsolation,
        string $chatTopicId,
        string $name,
        string $toolCallId,
        array $detail
    ): void {
        $topicEntity = $this->topicDomainService->getTopicByChatTopicId($dataIsolation, $chatTopicId);
        $taskId = (string) $topicEntity->getCurrentTaskId();
        $task = $this->taskDomainService->getTaskById((int) $taskId);
        if (! $task) {
            $this->logger->error('HandleUserToolCallReplyTaskNotFound', ['task_id' => $taskId]);
            throw new RuntimeException('Task not found: ' . $taskId);
        }

        $detailTaskId = is_string($detail['task_id'] ?? null) ? trim($detail['task_id']) : '';
        if ($detailTaskId !== '' && $detailTaskId !== $taskId) {
            $this->logger->warning('HandleUserToolCallReplyStaleTask', [
                'topic_id' => $chatTopicId,
                'current_task_id' => $taskId,
                'detail_task_id' => $detailTaskId,
                'tool_call_id' => $toolCallId,
                'idempotency_result' => 'stale_task_ignored',
            ]);
            return;
        }

        $organizationCode = $dataIsolation->getCurrentOrganizationCode() ?: $topicEntity->getUserOrganizationCode();
        $lockKey = sprintf('user_tool_call_reply:%s:%s:%s', $organizationCode, $chatTopicId, $toolCallId);
        $lockOwner = IdGenerator::getUniqueId32();
        $lockAcquired = $this->locker->mutexLock($lockKey, $lockOwner, 86400);
        if (! $lockAcquired) {
            $this->logger->info('HandleUserToolCallReplyAlreadyProcessed', [
                'topic_id' => $chatTopicId,
                'current_task_id' => $taskId,
                'detail_task_id' => $detailTaskId,
                'tool_call_id' => $toolCallId,
                'idempotency_result' => 'already_processed',
            ]);
            return;
        }

        $forwardedToSandbox = false;
        try {
            // 先投递到当前绑定的执行环境。
            $this->agentDomainService->sendUserToolCallFeedback(
                $dataIsolation,
                $task->getSandboxId(),
                $name,
                $toolCallId,
                $detail
            );
            $forwardedToSandbox = true;

            // 更新任务状态为运行中
            $this->updateTaskStatus(
                dataIsolation: $dataIsolation,
                task: $task,
                status: TaskStatus::RUNNING,
            );

            $this->logger->info('HandleUserToolCallReplyCompleted', [
                'topic_id' => $chatTopicId,
                'task_id' => $taskId,
                'detail_task_id' => $detailTaskId,
                'name' => $name,
                'tool_call_id' => $toolCallId,
                'idempotency_result' => 'forwarded',
            ]);
        } catch (UserToolCallNotFoundException $e) {
            // 沙盒已经消费或超时：保留幂等占位，后续旧回执不能再次触达沙盒。
            $this->logger->warning('HandleUserToolCallReplyExpired', [
                'topic_id' => $chatTopicId,
                'current_task_id' => $taskId,
                'detail_task_id' => $detailTaskId,
                'tool_call_id' => $toolCallId,
                'idempotency_result' => 'expired',
            ]);
            throw $e;
        } catch (SandboxOperationException $e) {
            if ($task->getStatus() !== TaskStatus::WAITING_FOR_USER) {
                $this->locker->release($lockKey, $lockOwner);
                throw new UserToolCallNotFoundException(
                    'The user tool call is no longer waiting for an answer.'
                );
            }

            if (! $this->shouldRecoverTaskSandbox($task, $e)) {
                $this->locker->release($lockKey, $lockOwner);
                throw $e;
            }

            try {
                // 原执行环境退出后，恢复原任务的 Agent 上下文，再用同一个 tool_call_id
                // 投递同一份回答。不能调用会新建任务的通用启动入口，否则会改变话题当前任务。
                $recoveredSandboxId = $this->recoverTaskSandbox(
                    dataIsolation: $dataIsolation,
                    topicEntity: $topicEntity,
                    task: $task,
                );
                $this->agentDomainService->sendUserToolCallFeedback(
                    $dataIsolation,
                    $recoveredSandboxId,
                    $name,
                    $toolCallId,
                    $detail
                );
                $forwardedToSandbox = true;

                $this->updateTaskStatus(
                    dataIsolation: $dataIsolation,
                    task: $task,
                    status: TaskStatus::RUNNING,
                );

                $this->logger->info('HandleUserToolCallReplyRecoveredAndForwarded', [
                    'topic_id' => $chatTopicId,
                    'task_id' => $taskId,
                    'tool_call_id' => $toolCallId,
                    'sandbox_id' => $recoveredSandboxId,
                    'idempotency_result' => 'recovered_and_forwarded',
                ]);
            } catch (UserToolCallNotFoundException $recoveredNotFound) {
                // 第一次请求可能已经被旧执行环境接收，只是响应未返回；重投得到 4100
                // 时按已处理收口，避免用户看到技术错误。
                throw $recoveredNotFound;
            } catch (Throwable $recoveryError) {
                $this->logger->error('HandleUserToolCallReplyRecoveryFailed', [
                    'topic_id' => $chatTopicId,
                    'task_id' => $taskId,
                    'tool_call_id' => $toolCallId,
                    'initial_error' => $e->getMessage(),
                    'recovery_error' => $recoveryError->getMessage(),
                ]);
                $this->locker->release($lockKey, $lockOwner);
                throw new UserToolCallRecoveryException(
                    'Failed to continue the submitted answer after recovering the execution environment.',
                    $recoveryError
                );
            }
        } catch (Throwable $e) {
            // 仅释放真正的传输/沙盒故障，允许用户在网络恢复后有意重试。
            if (! $forwardedToSandbox) {
                $this->locker->release($lockKey, $lockOwner);
            }
            throw $e;
        }
    }

    public function handleUserToolCallCancelled(
        DataIsolation $dataIsolation,
        TaskEntity $task,
        string $errMsg = ''
    ): void {
        $this->updateTaskStatus(
            dataIsolation: $dataIsolation,
            task: $task,
            status: TaskStatus::Suspended,
            errMsg: $errMsg,
        );

        $this->logger->info('HandleUserToolCallCancelledCompleted', [
            'task_id' => (string) $task->getId(),
            'topic_id' => $task->getTopicId(),
            'status' => TaskStatus::Suspended->value,
        ]);
    }

    public function updateTaskStatusFromSandbox(TopicEntity $topicEntity): TaskStatus
    {
        $this->logger->debug(sprintf('开始检查任务状态: topic_id=%s', $topicEntity->getId()));
        $sandboxId = ! empty($topicEntity->getSandboxId()) ? $topicEntity->getSandboxId() : (string) $topicEntity->getId();

        // 调用SandboxService的getStatus接口获取容器状态
        $result = $this->sandboxDomainService->getSandboxStatus($sandboxId);

        // 如果沙箱存在且状态为 running，直接返回该沙箱
        if ($result->getStatus() === SandboxStatus::RUNNING) {
            $this->logger->debug(sprintf('沙箱状态正常(running): sandboxId=%s', $topicEntity->getSandboxId()));
            return TaskStatus::RUNNING;
        }

        $errMsg = $result->getStatus();

        // 获取当前任务
        $taskId = $topicEntity->getCurrentTaskId();
        if ($taskId) {
            // 更新任务状态
            $this->taskDomainService->updateTaskStatusByTaskId($taskId, TaskStatus::ERROR, $errMsg);
        }

        // 更新话题状态
        $this->topicDomainService->updateTopicStatus($topicEntity->getId(), $taskId, TaskStatus::ERROR);

        // 触发完成事件
        AsyncEventUtil::dispatch(new RunTaskAfterEvent(
            $topicEntity->getUserOrganizationCode(),
            $topicEntity->getUserId(),
            $topicEntity->getId(),
            $taskId,
            TaskStatus::ERROR->value,
            null
        ));

        $this->logger->debug(sprintf('结束检查任务状态: topic_id=%s, status=%s, error_msg=%s', $topicEntity->getId(), TaskStatus::ERROR->value, $errMsg));

        return TaskStatus::ERROR;
    }

    public function processMessageAttachment(DataIsolation $dataIsolation, TaskEntity $task, TaskMessageEntity $message): void
    {
        $fileKeys = [];
        $fileInfoMap = [];
        // 获取消息附件
        if (! empty($message->getAttachments())) {
            foreach ($message->getAttachments() as $attachment) {
                if (! empty($attachment['file_key'])) {
                    $fileKeys[] = $attachment['file_key'];
                    $fileInfoMap[$attachment['file_key']] = $attachment;
                }
            }
        }
        // 获取消息里，工具的附件
        if (! empty($message->getTool()) && ! empty($message->getTool()['attachments'])) {
            foreach ($message->getTool()['attachments'] as $attachment) {
                if (! empty($attachment['file_key'])) {
                    $fileKeys[] = $attachment['file_key'];
                    $fileInfoMap[$attachment['file_key']] = $attachment;
                }
            }
        }
        if (empty($fileKeys)) {
            return;
        }
        // 通过 file_key 查找文件 id
        $fileEntities = $this->taskFileDomainService->getByFileKeys($fileKeys);
        $fileIdMap = [];
        foreach ($fileEntities as $fileEntity) {
            $fileIdMap[$fileEntity->getFileKey()] = $fileEntity->getFileId();
        }

        // Handle missing file_keys: find which file_keys don't have corresponding records
        $missingFileKeys = array_diff($fileKeys, array_keys($fileIdMap));
        if (! empty($missingFileKeys)) {
            $projectEntity = $this->projectDomainService->getProjectNotUserId($task->getProjectId());
            if ($projectEntity) {
                // Process each missing file with file-level locking for better concurrency
                foreach ($missingFileKeys as $missingFileKey) {
                    if (! isset($fileInfoMap[$missingFileKey])) {
                        $this->logger->error(sprintf('Missing file_key: %s', $missingFileKey));
                        continue;
                    }

                    // Setup file-level lock to prevent concurrent processing of the same file
                    $lockKey = WorkDirectoryUtil::getFileLockerKey($missingFileKey, 'topic_message_attachment');
                    $lockOwner = IdGenerator::getUniqueId32();
                    $lockExpireSeconds = 2;
                    $lockAcquired = false;

                    try {
                        // Attempt to acquire distributed file-level lock
                        $lockAcquired = $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);
                        if (! $lockAcquired) {
                            $this->logger->warning(sprintf(
                                'Failed to acquire file lock for missing file processing, file_key: %s, task_id: %s',
                                $missingFileKey,
                                $task->getTaskId()
                            ));
                            continue;
                        }

                        // Re-check file existence after acquiring lock to avoid duplicate creation
                        $existingFile = $this->taskFileDomainService->getByFileKey($missingFileKey);
                        if ($existingFile !== null) {
                            $fileIdMap[$missingFileKey] = $existingFile->getFileId();
                            $this->logger->debug(sprintf(
                                'File already created by another process, file_key: %s, file_id: %d',
                                $missingFileKey,
                                $existingFile->getFileId()
                            ));
                            continue;
                        }

                        // Create file record
                        $storageType = StorageType::fromValue(
                            (string) ($fileInfoMap[$missingFileKey]['storage_type'] ?? '')
                        )->value;
                        $fileInfoMap[$missingFileKey]['storage_type'] = $storageType;
                        $fallbackFileEntity = $this->taskFileDomainService->convertMessageAttachmentToTaskFileEntity($fileInfoMap[$missingFileKey], $task);
                        $this->logger->debug(sprintf(
                            'Attachment not found in database, creating file record, task_id: %s, file_key: %s',
                            $task->getTaskId(),
                            $missingFileKey
                        ));
                        $savedEntity = $this->taskFileDomainService->saveProjectFile(
                            $dataIsolation,
                            $projectEntity,
                            $fallbackFileEntity,
                            $storageType
                        );
                        $fileIdMap[$missingFileKey] = $savedEntity->getFileId();

                        $this->logger->debug(sprintf(
                            'Missing file processed successfully with file lock, file_key: %s, file_id: %d, task_id: %s',
                            $missingFileKey,
                            $savedEntity->getFileId(),
                            $task->getTaskId()
                        ));
                    } catch (Throwable $e) {
                        $this->logger->error(sprintf(
                            'Exception processing missing file with lock protection, file_key: %s, task_id: %s, error: %s',
                            $missingFileKey,
                            $task->getTaskId(),
                            $e->getMessage()
                        ));
                        // Continue processing other files instead of throwing
                    } finally {
                        // Ensure file-level lock is always released
                        if ($lockAcquired) {
                            if (! $this->locker->release($lockKey, $lockOwner)) {
                                $this->logger->error(sprintf(
                                    'Failed to release file lock for missing file processing, file_key: %s, task_id: %s',
                                    $missingFileKey,
                                    $task->getTaskId()
                                ));
                            }
                        }
                    }
                }
            } else {
                $this->logger->error(sprintf('Project not found, project_id: %s', $task->getProjectId()));
            }
        }

        // 将 file_id 赋值到 消息的附件和消息工具的附件里
        if (! empty($fileIdMap)) {
            // 处理消息附件
            $attachments = $message->getAttachments();
            if (! empty($attachments)) {
                foreach ($attachments as &$attachment) {
                    if (! empty($attachment['file_key']) && isset($fileIdMap[$attachment['file_key']])) {
                        $attachment['file_id'] = (string) $fileIdMap[$attachment['file_key']];
                    }
                }
                $message->setAttachments($attachments);
            }
            // 处理工具附件
            $tool = $message->getTool();
            if (! empty($tool) && ! empty($tool['attachments'])) {
                foreach ($tool['attachments'] as &$attachment) {
                    if (! empty($attachment['file_key']) && isset($fileIdMap[$attachment['file_key']])) {
                        $attachment['file_id'] = (string) $fileIdMap[$attachment['file_key']];
                    }
                }
                $message->setTool($tool);
            }
        }

        // Special status handling: generate output content tool when task is finished
        if ($message->getStatus() === TaskStatus::FINISHED->value) {
            $outputTool = ToolProcessor::generateOutputContentTool($message->getAttachments());
            if ($outputTool !== null) {
                $message->setTool($outputTool);
            }
        }
    }

    /**
     * Create task and send message to agent.
     *
     * @param RequestContext $requestContext Request context
     * @param CreateTaskRequestDTO $requestDTO Request DTO
     * @return array Task creation result
     */
    public function createTask(
        RequestContext $requestContext,
        CreateTaskRequestDTO $requestDTO,
        SuperMagicExecutionSource $executionSource = SuperMagicExecutionSource::HumanChat
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createContactDataIsolationByUser(
            $userAuthorization->getOrganizationCode(),
            $userAuthorization->getId()
        );
        $result = $this->createTaskByDataIsolation(
            $dataIsolation,
            $requestDTO,
            executionSource: $executionSource
        );

        return $this->buildCreateTaskResponse($result);
    }

    /**
     * Create a task from a standard message prepared by the interface layer.
     * Open API options are passed separately to the shared creation flow.
     */
    public function createTaskFromOpenApi(
        RequestContext $requestContext,
        CreateOpenTaskRequestDTO $requestDTO,
        CreateTaskRequestDTO $internalDTO,
        SuperMagicExecutionSource $executionSource = SuperMagicExecutionSource::OpenApi
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createContactDataIsolationByUser(
            $userAuthorization->getOrganizationCode(),
            $userAuthorization->getId()
        );

        $result = $this->createTaskByDataIsolation(
            $dataIsolation,
            $internalDTO,
            executionSource: $executionSource,
            messageSubscriptionConfig: $requestDTO->getMessageSubscriptionConfig(),
            autoHireAgent: $requestDTO->isAutoHireAgent()
        );

        return $this->buildCreateTaskResponse($result);
    }

    /**
     * Ingest a third-party user message through the shared task creation flow.
     * Only persists the message and pushes it to IM; does NOT deliver to the agent queue.
     */
    public function ingestThirdPartyMessage(
        DataIsolation $dataIsolation,
        CreateTaskRequestDTO $requestDTO,
        array $source
    ): array {
        return $this->createTaskByDataIsolation(
            $dataIsolation,
            $requestDTO,
            $source,
            deliverToAgent: false,
            executionSource: $this->resolveIngestExecutionSource($source)
        );
    }

    /**
     * Cancel task.
     *
     * @param RequestContext $requestContext Request context
     * @param string $taskId Task ID
     * @return array Cancel result
     */
    public function cancelTask(RequestContext $requestContext, string $taskId): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createContactDataIsolationByUser(
            $userAuthorization->getOrganizationCode(),
            $userAuthorization->getId()
        );

        try {
            // Step 1: Get task entity and check permission
            $taskEntity = $this->checkTaskPermission($dataIsolation, (int) $taskId);

            // Step 2: Update task status to suspended
            $this->updateTaskStatus(
                dataIsolation: $dataIsolation,
                task: $taskEntity,
                status: TaskStatus::Suspended,
                errMsg: 'User manually cancelled task'
            );

            // Step 3: Set termination flag in Redis
            TaskTerminationUtil::setTerminationFlag(
                $this->redis,
                $this->logger,
                $taskEntity->getId()
            );

            // Step 4: Send interrupt message to sandbox (if running)
            $this->sendInterruptToSandbox($dataIsolation, $taskEntity);

            return [
                'task_id' => (string) $taskEntity->getId(),
            ];
        } catch (Throwable $e) {
            $this->logger->error('Failed to cancel task', [
                'task_id' => $taskId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * Get task status by ID (lightweight query for polling).
     * Returns only essential fields: id, task_status, err_msg, updated_at.
     *
     * @param RequestContext $requestContext Request context
     * @param int $taskId Task ID
     * @return array Task status information
     */
    public function getTaskStatusById(RequestContext $requestContext, int $taskId): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createContactDataIsolationByUser(
            $userAuthorization->getOrganizationCode(),
            $userAuthorization->getId()
        );

        // Check task permission (validates ownership)
        $taskEntity = $this->checkTaskPermission($dataIsolation, $taskId);

        $result = [
            'id' => (string) $taskEntity->getId(),
            'task_status' => $taskEntity->getTaskStatus(),
            'err_msg' => $taskEntity->getErrMsg(),
            'updated_at' => $taskEntity->getUpdatedAt(),
        ];

        if ($taskEntity->getTaskStatus() === TaskStatus::FINISHED->value) {
            $result['result'] = $this->buildTaskResult(
                (int) $taskEntity->getTopicId(),
                (int) $taskEntity->getId(),
            );
        }

        return $result;
    }

    /**
     * 计算任务从开始到成功完成的耗时（秒）.
     */
    private function resolveTaskDurationSeconds(TaskEntity $task): int
    {
        $startedAt = $task->getStartedAt();
        if (empty($startedAt)) {
            return 0;
        }

        $startedTimestamp = strtotime($startedAt);
        if ($startedTimestamp === false) {
            return 0;
        }

        return max(0, time() - $startedTimestamp);
    }

    /**
     * 恢复当前等待任务绑定的执行环境，不创建新的任务记录。
     */
    private function recoverTaskSandbox(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        TaskEntity $task,
    ): string {
        $projectEntity = $this->projectDomainService->getProjectNotUserId($topicEntity->getProjectId());
        if ($projectEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND);
        }

        $agentContext = $this->agentDomainService->buildInitAgentContext(
            dataIsolation: $dataIsolation,
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            taskEntity: $task,
            // 传入当前绑定的 sandbox_id，由 Domain 负责判断旧环境是否还能复用；
            // 不传 topic_id，避免跳过预热池的正常路径。
            sandboxId: (string) $topicEntity->getSandboxId(),
            skipInitMessage: true,
        );

        $sandboxId = $this->agentDomainService->ensureSandboxInitialized(
            dataIsolation: $dataIsolation,
            agentContext: $agentContext,
            rootFileIds: new SandboxRootFileIds(
                (string) $this->taskFileDomainService->getProjectRootFileId($projectEntity->getId()),
                (string) $this->taskFileDomainService->findOrCreateUserRootDirectory(
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode()
                ),
                (string) $this->taskFileDomainService->findOrCreateTopicRootDirectory(
                    $projectEntity->getId(),
                    $topicEntity->getId(),
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode(),
                    $projectEntity->getUserOrganizationCode()
                )
            )
        );

        $this->topicDomainService->updateTopicSandboxId($dataIsolation, $topicEntity->getId(), $sandboxId);
        $this->taskDomainService->updateTaskSandboxId($dataIsolation, $task->getId(), $sandboxId);
        $task->setSandboxId($sandboxId);

        return $sandboxId;
    }

    /**
     * 只有旧执行环境已经退出或找不到时，才允许自动恢复。
     */
    private function shouldRecoverTaskSandbox(TaskEntity $task, SandboxOperationException $initialError): bool
    {
        $sandboxId = trim($task->getSandboxId());
        if ($sandboxId === '') {
            return true;
        }

        try {
            $status = $this->agentDomainService->getSandboxStatus($sandboxId)->getStatus();
            $recoverable = in_array($status, [
                SandboxStatus::EXITED,
                SandboxStatus::NOT_FOUND,
                SandboxStatus::UNKNOWN,
            ], true);

            $this->logger->info('CheckUserToolCallRecoverySandboxStatus', [
                'task_id' => $task->getId(),
                'sandbox_id' => $sandboxId,
                'sandbox_status' => $status,
                'recoverable' => $recoverable,
                'initial_error' => $initialError->getMessage(),
            ]);

            return $recoverable;
        } catch (Throwable $statusError) {
            $this->logger->warning('Failed to check sandbox status before user tool call recovery', [
                'task_id' => $task->getId(),
                'sandbox_id' => $sandboxId,
                'initial_error' => $initialError->getMessage(),
                'status_error' => $statusError->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Build the compact result returned by the task status polling API.
     * The first message for each event is used when duplicate records exist.
     *
     * @return array{content: string, attachments: array}
     */
    private function buildTaskResult(int $topicId, int $taskId): array
    {
        $messages = $this->taskMessageDomainService->findCompletedResultMessages($topicId, $taskId);
        $content = '';
        $attachments = [];
        $contentMessageFound = false;
        $attachmentsMessageFound = false;

        foreach ($messages as $message) {
            if ($message->getEvent() === 'after_agent_reply' && ! $contentMessageFound) {
                $contentMessageFound = true;
                $rawContent = $message->getRawContent();
                if ($rawContent !== '' && json_validate($rawContent)) {
                    $decoded = json_decode($rawContent, true);
                    $content = (string) ($decoded['super_magic_message']['content'] ?? '');
                }
            }

            if ($message->getEvent() === 'after_main_agent_run' && ! $attachmentsMessageFound) {
                $attachmentsMessageFound = true;
                $attachments = $message->getAttachments() ?? [];
            }
        }

        return [
            'content' => $content,
            'attachments' => $attachments,
        ];
    }

    /**
     * @return array{TaskEntity, TopicEntity}
     */
    private function getAuthorizedTaskAndTopic(
        DataIsolation $dataIsolation,
        TopicTaskMessageDTO $messageDTO
    ): array {
        $taskId = (int) $messageDTO->getMetadata()->getSuperMagicTaskId();
        $taskEntity = $this->taskDomainService->getTaskById($taskId);
        if (! $taskEntity || $taskEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_ACCESS_DENIED, 'task.access_denied');
        }

        $topicEntity = $this->topicDomainService->getTopicById($taskEntity->getTopicId());
        if (! $topicEntity || $topicEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_ACCESS_DENIED, 'task.access_denied');
        }

        return [$taskEntity, $topicEntity];
    }

    /**
     * user tool call Human-in-the-Loop：在消息已存储/推送后，补充任务状态并在必要时提前结束 deliver 流程。
     *
     * 消息存储和推送由步骤 2、3 完成；此处只补充本路径泛型步骤 4 未覆盖的状态（终态仍走步骤 4）。
     * 路由信息（task_id）由前端回答时直接携带，无需 Redis 路由键。
     * user tool call 超时收口沿用 AFTER_TOOL_CALL 消息，不再走额外同步 API。
     *
     * @return null|array<string, mixed> 已处理并应跳过后续终态逻辑时返回响应体，否则 null
     */
    private function tryEarlyDeliverResponseForUserToolCall(
        TopicTaskMessageDTO $messageDTO,
        DataIsolation $dataIsolation,
        TaskEntity $taskEntity,
        string $messageId,
    ): ?array {
        $payload = $messageDTO->getPayload();
        if ($payload->getType() !== MessageType::ToolCall->value) {
            return null;
        }

        $tool = $payload->getTool();
        if (! is_array($tool) || ! in_array($tool['name'] ?? '', ['ask_user', 'plan'], true)) {
            return null;
        }

        if ($payload->getEvent() === AgentEventEnum::BEFORE_TOOL_CALL->value) {
            $this->updateTaskStatus(
                dataIsolation: $dataIsolation,
                task: $taskEntity,
                status: TaskStatus::WAITING_FOR_USER,
            );

            return DeliverMessageResponseDTO::fromResult(true, $messageId)->toArray();
        }

        if ($payload->getEvent() === AgentEventEnum::AFTER_TOOL_CALL->value
            && (($tool['detail']['data']['status'] ?? '') === AskUserStatus::Timeout->value)
        ) {
            $this->updateTaskStatus(
                dataIsolation: $dataIsolation,
                task: $taskEntity,
                status: TaskStatus::RUNNING,
            );

            return DeliverMessageResponseDTO::fromResult(true, $messageId)->toArray();
        }

        return null;
    }

    private function isWaitingForUserMessage(TopicTaskMessageDTO $messageDTO): bool
    {
        $payload = $messageDTO->getPayload();
        if ($payload->getType() === MessageType::ToolCall->value) {
            $tool = $payload->getTool();
            return is_array($tool)
                && in_array($tool['name'] ?? '', ['ask_user', 'plan'], true)
                && $payload->getEvent() === AgentEventEnum::BEFORE_TOOL_CALL->value;
        }

        return $payload->getType() === MessageType::SuperMagicMessage->value
            && $payload->getEvent() === AgentEventEnum::AFTER_MAIN_AGENT_RUN->value
            && $payload->getStatus() === TaskStatus::WAITING_FOR_USER->value;
    }

    /**
     * 适配 super_magic_message + after_main_agent_run + waiting_for_user 格式的状态更新。
     *
     * 沙盒在用户工具调用前通过此格式下发通知，此时需要将任务状态更新为 waiting_for_user。
     * 因 waiting_for_user 不是终态，步骤 4 的 updateTaskStatus 不会被触发，需在此处单独处理。
     *
     * @return null|array<string, mixed> 已处理时返回响应体，否则返回 null
     */
    private function tryHandleWaitingForUserOnMainAgentRun(
        TopicTaskMessageDTO $messageDTO,
        DataIsolation $dataIsolation,
        TaskEntity $taskEntity,
        string $messageId,
    ): ?array {
        $payload = $messageDTO->getPayload();

        if ($payload->getType() !== MessageType::SuperMagicMessage->value) {
            return null;
        }

        if ($payload->getEvent() !== AgentEventEnum::AFTER_MAIN_AGENT_RUN->value) {
            return null;
        }

        if ($payload->getStatus() !== TaskStatus::WAITING_FOR_USER->value) {
            return null;
        }

        $this->updateTaskStatus(
            dataIsolation: $dataIsolation,
            task: $taskEntity,
            status: TaskStatus::WAITING_FOR_USER,
        );

        return DeliverMessageResponseDTO::fromResult(true, $messageId)->toArray();
    }

    /**
     * Ensure the task employee is hired through domain services before task side effects.
     */
    private function ensureAgentHired(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): void
    {
        if ($this->userAgentDomainService->findUserAgentOwnershipByCode($dataIsolation, $agentCode) !== null) {
            return;
        }

        Db::beginTransaction();
        try {
            $permissionIsolation = new PermissionDataIsolation();
            $permissionIsolation->extends($dataIsolation);
            $marketEntity = $this->superMagicAgentMarketDomainService->getPublishedByAgentCodeForUpdate(
                $dataIsolation->getCurrentOrganizationCode(),
                $agentCode
            );
            if ($marketEntity === null) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $agentCode]);
            }

            // The market lock serializes concurrent hires; recheck before installing.
            if ($this->userAgentDomainService->findUserAgentOwnershipByCode($dataIsolation, $agentCode) !== null) {
                Db::commit();
                return;
            }
            if (! $this->superMagicAgentMarketDomainService->isMarketDiscoverableForUser(
                $permissionIsolation,
                $marketEntity,
                $dataIsolation->getCurrentUserId()
            )) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $agentCode]);
            }

            $employee = $this->superMagicAgentDomainService->hireAgent($dataIsolation, $agentCode);
            $this->resourceVisibilityDomainService->addResourceVisibilityByPrincipalsIfMissing(
                $permissionIsolation,
                ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
                $employee->getCode(),
                PrincipalType::USER,
                [$dataIsolation->getCurrentUserId()]
            );
            Db::commit();
        } catch (Throwable $exception) {
            Db::rollBack();
            throw $exception;
        }
    }

    /**
     * Shared task creation flow for both first-party and third-party user messages.
     *
     * @return array{task_id: string, message_id: string, im_seq_id: ?string, deduplicated: bool}
     */
    private function createTaskByDataIsolation(
        DataIsolation $dataIsolation,
        CreateTaskRequestDTO $requestDTO,
        ?array $source = null,
        bool $deliverToAgent = true,
        ?SuperMagicExecutionSource $executionSource = null,
        ?array $messageSubscriptionConfig = null,
        bool $autoHireAgent = false
    ): array {
        $preparedRequestDTO = $this->createTaskRequestDTOWithSource($requestDTO, $source);
        if ($executionSource !== null) {
            $preparedRequestDTO = $this->createTaskRequestDTOWithExecutionSource($preparedRequestDTO, $executionSource);
        }

        $topicId = 0;
        $taskId = '';
        $businessMessageId = '';

        try {
            $contentStruct = $this->validateAndParseMessage($preparedRequestDTO);
            $parsedMessage = UserMessageDTOAssembler::parseMessageContent($contentStruct, $executionSource ?? SuperMagicExecutionSource::HumanChat);
            if (strlen($parsedMessage['prompt']) > 65000) {
                ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'Message content exceeds maximum length');
            }
            UserMessageDTOAssembler::assertTaskCreationMessage($contentStruct, $parsedMessage);

            $topicEntity = $this->checkTopicPermission(
                $dataIsolation,
                (int) $preparedRequestDTO->getTopicId()
            );
            $topicId = $topicEntity->getId();

            if ($topicEntity->getProjectId() !== (int) $preparedRequestDTO->getProjectId()) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::VALIDATE_FAILED,
                    'Project ID does not match topic'
                );
            }

            // @phpstan-ignore-next-line method.notFound - MagicMessageStruct implements TextContentInterface and has getExtra()
            $superAgentExtra = $contentStruct->getExtra()?->getSuperAgent();
            // 请求参数优先，未传时回退 Topic，得到本次真正执行的模式与 code。
            $topicAgentConfig = $this->topicAgentConfigResolver->resolve(
                topicEntity: $topicEntity,
                extra: $superAgentExtra,
            );
            $topicPattern = $topicAgentConfig->topicMode;
            $agentCode = $topicAgentConfig->agentCode;
            $agentDataIsolation = SuperMagicAgentDataIsolation::create(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            );
            [$allowed, $errorMessage] = $this->superMagicAgentAccessAppService->checkAgentAccess(
                $agentDataIsolation,
                $topicPattern,
                $agentCode
            );
            if (! $allowed && $autoHireAgent && $topicPattern === ProjectMode::CUSTOM_AGENT->value && $agentCode !== '') {
                try {
                    $this->ensureAgentHired($agentDataIsolation, $agentCode);
                } catch (Throwable $exception) {
                    $this->logger->warning('Failed to automatically hire task employee', [
                        'agent_code' => $agentCode,
                        'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                        'user_id' => $dataIsolation->getCurrentUserId(),
                        'error_code' => $exception->getCode(),
                        'error' => $exception->getMessage(),
                    ]);
                    ExceptionBuilder::throw(SuperMagicErrorCode::AutoHireAgentFailed, throwable: $exception);
                }

                [$allowed, $errorMessage] = $this->superMagicAgentAccessAppService->checkAgentAccess(
                    $agentDataIsolation,
                    $topicPattern,
                    $agentCode
                );
            }
            if (! $allowed) {
                ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, $errorMessage);
            }

            $businessMessageId = $this->resolveUserMessageId($source);
            if ($businessMessageId !== '') {
                $existingMessage = $this->taskMessageDomainService->findByTopicIdAndMessageId($topicEntity->getId(), $businessMessageId);
                if ($existingMessage !== null) {
                    return [
                        'task_id' => $existingMessage->getTaskId(),
                        'message_id' => $existingMessage->getMessageId(),
                        'im_seq_id' => $existingMessage->getImSeqId() !== null ? (string) $existingMessage->getImSeqId() : null,
                        'deduplicated' => true,
                    ];
                }
            }

            // A normal user message waits for the currently active task. A forced message
            // interrupts it and starts immediately instead.
            if ($deliverToAgent && $this->shouldEnqueueToUserMessageQueue($topicEntity, $preparedRequestDTO->isForceInterrupt())) {
                $queueEntity = $this->enqueueUserMessage($dataIsolation, $topicEntity, $preparedRequestDTO);
                $this->logger->info('Topic is active, message enqueued to user message queue', [
                    'topic_id' => $topicEntity->getId(),
                    'queue_id' => $queueEntity->getId(),
                ]);
                return [
                    'task_id' => '',
                    'queue_id' => (string) $queueEntity->getId(),
                    'message_id' => $businessMessageId,
                    'im_seq_id' => null,
                    'deduplicated' => false,
                ];
            }

            if ($deliverToAgent && $preparedRequestDTO->isForceInterrupt()) {
                $this->interruptCurrentTask($dataIsolation, $topicEntity);
            }

            $taskId = (string) IdGenerator::getSnowId();

            $this->dispatchPreCheckEvent($dataIsolation, $topicEntity, $contentStruct, $taskId);

            $taskEntity = $this->initializeTask($dataIsolation, $topicEntity, $preparedRequestDTO, $taskId, $contentStruct, $parsedMessage);

            $recordId = (int) IdGenerator::getSnowId();
            $businessMessageId = $businessMessageId !== '' ? $businessMessageId : (string) $recordId;
            $persistResult = $this->persistAndPushUserMessage(
                $dataIsolation,
                $topicEntity,
                $taskEntity,
                $preparedRequestDTO,
                $contentStruct,
                $recordId,
                $businessMessageId,
                $parsedMessage,
                $source
            );

            if ($deliverToAgent) {
                $this->deliverMessageToQueue(
                    $dataIsolation,
                    $topicEntity,
                    $taskEntity,
                    $contentStruct,
                    $preparedRequestDTO->getMessageType(),
                    $persistResult['agentUserId'],
                    $businessMessageId,
                    $persistResult['imSeqId'],
                    $executionSource ?? SuperMagicExecutionSource::HumanChat,
                    $messageSubscriptionConfig,
                    $parsedMessage
                );
            }

            return [
                'task_id' => (string) $taskEntity->getId(),
                'message_id' => $businessMessageId,
                'im_seq_id' => $persistResult['imSeqId'] !== null ? (string) $persistResult['imSeqId'] : null,
                'deduplicated' => false,
            ];
        } catch (Throwable $e) {
            $this->logger->error('Failed to create task', [
                'topic_id' => $topicId,
                'task_id' => $taskId,
                'message_id' => $businessMessageId,
                'source' => $source,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    /**
     * Update topic token usage snapshot when task reaches final status.
     */
    private function updateTopicTokenUsedOnTaskFinal(TopicTaskMessageDTO $messageDTO, int $topicId): void
    {
        if ($messageDTO->getPayload()->getEvent() !== AgentEventEnum::AFTER_MAIN_AGENT_RUN->value) {
            return;
        }

        $this->topicDomainService->updateTopicTokenUsed(
            $topicId,
            $messageDTO->getPayload()->getTokenUsed()
        );
    }

    private function parseMessageContent(TopicTaskMessageDTO $messageDTO): TaskMessageEntity
    {
        $payload = $messageDTO->getPayload();
        $metadata = $messageDTO->getMetadata();

        // Create TaskMessageEntity with messageId
        $taskMessageEntity = new TaskMessageEntity([
            'message_id' => $payload->getMessageId(),
        ]);

        // Set basic message information
        $messageType = $payload->getType() ?: 'unknown';
        $taskMessageEntity->setType($messageType);
        $taskMessageEntity->setContent($payload->getContent() ?? '');
        $taskMessageEntity->setStatus($payload->getStatus() ?: TaskStatus::RUNNING->value);
        $taskMessageEntity->setEvent($payload->getEvent() ?? '');
        $taskMessageEntity->setShowInUi($payload->getShowInUi() ?? true);

        // Set array fields
        $taskMessageEntity->setSteps($payload->getSteps() ?? []);
        $taskMessageEntity->setTool($payload->getTool() ?? []);
        $taskMessageEntity->setAttachments($payload->getAttachments() ?? []);

        // Set task and topic information
        $taskMessageEntity->setTaskId($payload->getTaskId() ?? '');

        // Set sender/receiver information (will be set properly when we have task context)
        $taskMessageEntity->setSenderType('assistant');
        $taskMessageEntity->setSenderUid($metadata->getAgentUserId() ?? '');
        $taskMessageEntity->setReceiverUid($metadata->getUserId() ?? '');
        $taskMessageEntity->setSeqId($messageDTO->getPayload()->getSeqId());
        $taskMessageEntity->setCorrelationId($payload->getCorrelationId());
        $taskMessageEntity->setParentCorrelationId($payload->getParentCorrelationId());
        $taskMessageEntity->setContentType($payload->getContentType());
        $taskMessageEntity->setRawContent($payload->getRawContent());

        // Validate message type
        if (! MessageType::isValid($messageType)) {
            $this->logger->warning(sprintf(
                'Received unknown message type: %s, task_id: %s',
                $messageType,
                $payload->getTaskId()
            ));
        }

        return $taskMessageEntity;
    }

    private function processToolContent(DataIsolation $dataIsolation, TaskEntity $taskEntity, TaskMessageEntity $taskMessageEntity): void
    {
        // 根据类型处理
        $tool = $taskMessageEntity->getTool();
        if (empty($tool) && ! empty($taskMessageEntity->getRawContent())) {
            if ($rawContent = json_decode($taskMessageEntity->getRawContent(), true)) {
                $tool = $rawContent['super_magic_message']['tool'] ?? [];
                $taskMessageEntity->setTool($tool);
            }
        }
        $detailType = $tool['detail']['type'] ?? '';
        switch ($detailType) {
            case 'image':
                // 处理图片
                $this->processToolContentImage($taskMessageEntity);
                break;
            default:
                // 默认处理文本
                $this->processToolContentStorage($dataIsolation, $taskEntity, $taskMessageEntity);
                break;
        }

        // 将处理后的 tool（内容已清空或已替换为 file_id）同步回 rawContent，
        // 避免 raw_content 字段保留原始大内容导致数据库字段超长
        $this->syncToolToRawContent($taskMessageEntity);
    }

    /**
     * 将 taskMessageEntity 上最新的 tool 数据同步写回 rawContent 中的 super_magic_message.tool，
     * 保证存入数据库的 raw_content 与 tool 字段保持一致。
     */
    private function syncToolToRawContent(TaskMessageEntity $taskMessageEntity): void
    {
        $rawContentStr = $taskMessageEntity->getRawContent();
        if (empty($rawContentStr)) {
            return;
        }
        $rawContentArr = json_decode($rawContentStr, true);
        if (! is_array($rawContentArr) || ! isset($rawContentArr['super_magic_message'])) {
            return;
        }
        $rawContentArr['super_magic_message']['tool'] = $taskMessageEntity->getTool() ?: null;
        $taskMessageEntity->setRawContent(json_encode($rawContentArr, JSON_UNESCAPED_UNICODE));
    }

    private function processToolContentImage(TaskMessageEntity $taskMessageEntity): void
    {
        $tool = $taskMessageEntity->getTool();

        // 获取文件名称
        $fileName = $tool['detail']['data']['file_name'] ?? '';
        if (empty($fileName)) {
            return;
        }

        $fileId = '';
        $attachments = $tool['attachments'] ?? [];
        foreach ($attachments as $attachment) {
            if ($attachment['filename'] === $fileName) {
                $fileId = $attachment['file_id'];
                break; // Exit loop once found
            }
        }

        if (empty($fileId)) {
            return;
        }

        $taskFileEntity = $this->taskFileDomainService->getById((int) $fileId);
        if ($taskFileEntity === null) {
            return;
        }

        // Extract source_file_id using the helper method
        $sourceFileId = $this->extractSourceFileIdFromAttachments(
            $attachments,
            $fileName,
            false // Image files typically don't have .diff suffix
        );

        $tool['detail']['data']['file_id'] = (string) $taskFileEntity->getFileId();
        $tool['detail']['data']['file_extension'] = pathinfo($fileName, PATHINFO_EXTENSION);

        // Add source_file_id if found
        if (! empty($sourceFileId)) {
            $tool['detail']['data']['source_file_id'] = $sourceFileId;
        }

        $taskMessageEntity->setTool($tool);
    }

    private function processToolContentStorage(DataIsolation $dataIsolation, TaskEntity $taskEntity, TaskMessageEntity $taskMessageEntity): void
    {
        // 检查是否启用对象存储
        $objectStorageEnabled = config('super-magic.task.tool_message.object_storage_enabled', true);
        if (! $objectStorageEnabled) {
            return;
        }

        // 检查工具内容
        $tool = $taskMessageEntity->getTool();
        if (! ToolProcessor::shouldPersistToolMessageContent($tool)) {
            return;
        }

        $content = $tool['detail']['data']['content'] ?? '';
        $fileName = $tool['detail']['data']['file_name'] ?? 'tool_content.txt';

        // Extract source_file_id from attachments (regardless of content)
        $sourceFileId = $this->extractSourceFileIdFromAttachments(
            $tool['attachments'] ?? [],
            $fileName,
            true // Remove .diff suffix for matching
        );

        // Set source_file_id if available
        if (! empty($sourceFileId) && ! isset($tool['detail']['data']['source_file_id'])) {
            $tool['detail']['data']['source_file_id'] = $sourceFileId;
            $taskMessageEntity->setTool($tool);
        }

        // super-magic may already have persisted the detail on the topic
        // volume.  A file_id is authoritative; never upload the same tool
        // detail again even if an older/newer producer accidentally retained
        // inline content alongside it.
        if (! empty($tool['detail']['data']['file_id'])) {
            return;
        }

        // If content is empty, return early
        if (empty($content)) {
            return;
        }

        // 检查内容长度是否达到阈值
        $minContentLength = config('super-magic.task.tool_message.min_content_length', 1024);
        if (strlen($content) < $minContentLength) {
            return;
        }

        $this->logger->debug(sprintf(
            '开始处理工具内容存储，工具ID: %s，内容长度: %d',
            $tool['id'] ?? 'unknown',
            strlen($content)
        ));

        try {
            // 构建参数
            $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION) ?: 'txt';
            $fileKey = ($tool['id'] ?? 'unknown') . '.' . $fileExtension;
            $workDir = WorkDirectoryUtil::getTopicMessageDir($taskEntity->getUserId(), $taskEntity->getProjectId(), $taskEntity->getTopicId());

            // 调用FileProcessAppService保存内容
            $fileId = $this->fileProcessAppService->saveToolMessageContent(
                fileName: $fileName,
                workDir: $workDir,
                fileKey: $fileKey,
                content: $content,
                dataIsolation: $dataIsolation,
                projectId: $taskEntity->getProjectId(),
                topicId: $taskEntity->getTopicId(),
                taskId: (int) $taskEntity->getId()
            );

            // 修改工具数据结构
            $tool['detail']['data']['file_id'] = (string) $fileId;
            $tool['detail']['data']['storage_type'] = StorageType::TOPIC->value;
            $tool['detail']['data']['content'] = ''; // 清空内容
            if (! empty($sourceFileId)) {
                $tool['detail']['data']['source_file_id'] = $sourceFileId;
            }

            $taskMessageEntity->setTool($tool);

            $this->logger->debug(sprintf(
                '工具内容存储完成，工具ID: %s，文件ID: %d，原内容长度: %d，source_file_id: %s',
                $tool['id'] ?? 'unknown',
                $fileId,
                strlen($content),
                $sourceFileId ?: 'null'
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '工具内容存储失败: %s，工具ID: %s，内容长度: %d',
                $e->getMessage(),
                $tool['id'] ?? 'unknown',
                strlen($content)
            ));
            // 存储失败不影响主流程，只记录错误
        }
    }

    /**
     * 派发回调事件.
     */
    private function dispatchCallbackEvent(
        TopicTaskMessageDTO $messageDTO,
        DataIsolation $dataIsolation,
        int $topicId,
        TaskEntity $taskEntity,
        TopicEntity $topicEntity,
    ): void {
        $this->logger->debug('派发 RunTaskCallbackEvent 事件', [
            'topic_id' => $topicId,
            'task_id' => $taskEntity->getId(),
            'message_id' => $messageDTO->getPayload()->getMessageId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
        ]);
        // 派发 RunTaskCallbackEvent
        $labels = $this->taskNotificationLabelResolver->resolve(
            task: $taskEntity,
            topic: $topicEntity,
        );
        AsyncEventUtil::dispatch(new RunTaskCallbackEvent(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            $topicId,
            '', // 话题名称传空字符串
            $taskEntity->getId(),
            $messageDTO,
            $messageDTO->getMetadata()->getLanguage(),
            $labels['project_id'],
            $labels['project_name'],
            $labels['workspace_id'],
            $labels['workspace_name']
        ));
    }

    /**
     * Extract source_file_id from attachments by matching filename.
     *
     * @param array $attachments Tool attachments array
     * @param string $fileName File name to match
     * @param bool $removeDiffSuffix Whether to remove .diff suffix for matching (default: true)
     * @return string Returns source_file_id if found, empty string otherwise
     */
    private function extractSourceFileIdFromAttachments(
        array $attachments,
        string $fileName,
        bool $removeDiffSuffix = true
    ): string {
        if (empty($attachments) || empty($fileName)) {
            return '';
        }

        // Prepare match filename
        $matchFileName = $fileName;
        if ($removeDiffSuffix && str_ends_with($fileName, '.diff')) {
            $matchFileName = substr($fileName, 0, -5); // Remove '.diff' suffix
        }

        // Find matching attachment
        foreach ($attachments as $attachment) {
            if (isset($attachment['filename']) && $attachment['filename'] === $matchFileName) {
                return $attachment['file_id'] ?? '';
            }
        }

        return '';
    }

    /**
     * Validate and parse message structure.
     *
     * @throws BusinessException When validation fails or message type is not supported
     */
    private function validateAndParseMessage(CreateTaskRequestDTO $requestDTO): MagicMessageStruct&TextContentInterface
    {
        try {
            $chatMessageType = ChatMessageType::from($requestDTO->getMessageType());
            $messageStruct = MessageAssembler::getChatMessageStruct($chatMessageType, $requestDTO->getMessageContent());
            if (! $messageStruct instanceof MagicMessageStruct || ! $messageStruct instanceof TextContentInterface) {
                ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'Unsupported message content type');
            }
            UserMessageDTOAssembler::prepareMessageContent($messageStruct);
            return $messageStruct;
        } catch (TypeError|ValueError $exception) {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'Unsupported message content type');
        }
    }

    /**
     * Check topic permission.
     */
    private function checkTopicPermission(
        DataIsolation $dataIsolation,
        int $topicId
    ): TopicEntity {
        $topicEntity = $this->topicDomainService->getTopicById($topicId);

        if (is_null($topicEntity)) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::TOPIC_NOT_FOUND,
                'Topic not found'
            );
        }

        // Check if topic belongs to current user
        if ($topicEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::TOPIC_ACCESS_DENIED,
                'Topic does not belong to current user'
            );
        }

        return $topicEntity;
    }

    /**
     * Dispatch pre-check event.
     */
    private function dispatchPreCheckEvent(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        TextContentInterface $contentStruct,
        string $taskId
    ): void {
        // Extract prompt from content structure
        $prompt = $contentStruct->getTextContent();

        // Get running topics count
        $runningTopicIds = $this->pullUserTopicStatus($dataIsolation);
        $currentTaskRunCount = count($runningTopicIds);

        // Get task round
        $taskRound = $this->taskDomainService->getTaskNumByTopicId($topicEntity->getId());

        // Dispatch event
        AsyncEventUtil::dispatch(new RunTaskBeforeEvent(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            $topicEntity->getId(),
            $taskRound,
            $currentTaskRunCount,
            $runningTopicIds,
            [],
            $dataIsolation->getLanguage() ?? 'en_US',
            '', // model_id
            $taskId,
            $prompt,
            '' // mentions
        ));
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

        return array_map(function (TopicEntity $topicEntity) {
            return $topicEntity->getId();
        }, $topicEntities);
    }

    /**
     * Initialize task entity.
     */
    private function initializeTask(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        CreateTaskRequestDTO $requestDTO,
        string $taskId,
        TextContentInterface $contentStruct,
        array $parsedMessage
    ): TaskEntity {
        $prompt = $parsedMessage['prompt'];
        $attachmentsJson = $parsedMessage['attachments'];
        $mentionsJson = $parsedMessage['mentions'];

        $data = [
            'id' => (int) $taskId,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'workspace_id' => $topicEntity->getWorkspaceId(),
            'project_id' => $topicEntity->getProjectId(),
            'topic_id' => $topicEntity->getId(),
            'task_id' => '',
            'task_mode' => $topicEntity->getTaskMode(),
            'sandbox_id' => $topicEntity->getSandboxId(),
            'prompt' => $prompt,
            'attachments' => $attachmentsJson,
            'mentions' => $mentionsJson,
            'task_status' => TaskStatus::WAITING->value,
            'work_dir' => $topicEntity->getWorkDir() ?? '',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        $taskEntity = TaskEntity::fromArray($data);

        return $this->taskDomainService->initTopicTask(
            dataIsolation: $dataIsolation,
            topicEntity: $topicEntity,
            taskEntity: $taskEntity
        );
    }

    /**
     * Persist user message and push to IM immediately.
     *
     * @return array{taskMessageEntity: TaskMessageEntity, agentUserId: string, extraData: ?array, imSeqId: ?int}
     */
    private function persistAndPushUserMessage(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        TaskEntity $taskEntity,
        CreateTaskRequestDTO $requestDTO,
        TextContentInterface $contentStruct,
        int $recordId,
        string $messageId,
        array $parsedMessage,
        ?array $source = null
    ): array {
        // 1. Get agent user
        $aiUserEntity = $this->userDomainService->getByAiCode(
            $dataIsolation,
            AgentConstant::SUPER_MAGIC_CODE
        );

        // 2. Extract data from content structure (no parsing needed, use reference)
        $prompt = $parsedMessage['prompt'];
        $attachments = json_decode($parsedMessage['attachments'] ?: '[]', true, flags: JSON_THROW_ON_ERROR);
        // @phpstan-ignore-next-line method.notFound - MagicMessageStruct implements TextContentInterface and has getExtra()
        $superAgentExtra = $contentStruct->getExtra()?->getSuperAgent();
        $mentions = json_decode($parsedMessage['mentions'] ?? 'null', true, flags: JSON_THROW_ON_ERROR);

        // Extract extra data for TaskContext
        $extraData = null;
        if ($superAgentExtra !== null) {
            $extraData = [];
            $imageModel = $superAgentExtra->getImageModel();
            $model = $superAgentExtra->getModel();
            if ($imageModel !== null && isset($imageModel['model_id'])) {
                $extraData['image_model_id'] = $imageModel['model_id'];
            }
            if ($model !== null && isset($model['model_id'])) {
                $extraData['model_id'] = $model['model_id'];
            }
            $extraData = $this->appendVideoModelExtraData($extraData, $superAgentExtra, $dataIsolation);

            // Only keep extraData if it has values
            if (empty($extraData)) {
                $extraData = null;
            }
        }

        // 3. Build rawContent
        $rawContent = [
            'type' => $requestDTO->getMessageType(),
            $requestDTO->getMessageType() => $requestDTO->getMessageContent() ?? [],
        ];

        // 4. Create and populate task message entity
        $taskMessageEntity = new TaskMessageEntity();
        $taskMessageEntity->setId($recordId);
        $taskMessageEntity->setMessageId($messageId);
        $taskMessageEntity->setTaskId((string) $taskEntity->getId());
        $taskMessageEntity->setTopicId($taskEntity->getTopicId());

        // Sender/Receiver
        $taskMessageEntity->setSenderType(Role::User->value);
        $taskMessageEntity->setSenderUid($dataIsolation->getCurrentUserId());
        $taskMessageEntity->setReceiverUid($aiUserEntity->getUserId());

        // Message content
        $taskMessageEntity->setType($requestDTO->getMessageType());
        $taskMessageEntity->setContent($prompt);
        $taskMessageEntity->setRawContent(json_encode($rawContent, JSON_UNESCAPED_UNICODE));

        // Attachments and mentions
        if (! empty($attachments)) {
            $taskMessageEntity->setAttachments($attachments);
        }
        if (! empty($mentions)) {
            $taskMessageEntity->setMentions($mentions);
        }
        if (! empty($source)) {
            $taskMessageEntity->setSource($source);
        }

        // Status
        $taskMessageEntity->setShowInUi(true);
        $taskMessageEntity->setProcessingStatus(TaskMessageEntity::PROCESSING_STATUS_COMPLETED);

        // 5. Save to database first
        $this->taskDomainService->recordTaskMessage($taskMessageEntity);

        // 6. Push to IM and get complete result
        $imResult = $this->pushMessageToIM(
            chatTopicId: $topicEntity->getChatTopicId(),
            senderUserId: $dataIsolation->getCurrentUserId(),
            receiverUserId: $aiUserEntity->getUserId(),
            messageType: $requestDTO->getMessageType(),
            messageContent: $requestDTO->getMessageContent(),
            appMessageId: (string) $messageId
        );

        // 7. Extract seq_id from IM result
        if ($imResult !== null) {
            $seqId = $imResult['seq']['seq_id'] ?? null;
            if ($seqId !== null) {
                $taskMessageEntity->setImSeqId((int) $seqId);
                $this->taskMessageDomainService->updateMessageSeqId($taskMessageEntity->getId(), (int) $seqId);
            }
        }

        return [
            'taskMessageEntity' => $taskMessageEntity,
            'agentUserId' => $aiUserEntity->getUserId(),
            'extraData' => $extraData,
            'imSeqId' => $taskMessageEntity->getImSeqId(),
        ];
    }

    private function createTaskRequestDTOWithSource(CreateTaskRequestDTO $requestDTO, ?array $source = null): CreateTaskRequestDTO
    {
        if (empty($source)) {
            return $requestDTO;
        }

        $messageContent = $requestDTO->getMessageContent();
        if (! isset($messageContent['extra']) || ! is_array($messageContent['extra'])) {
            $messageContent['extra'] = [];
        }
        if (! isset($messageContent['extra']['super_agent']) || ! is_array($messageContent['extra']['super_agent'])) {
            $messageContent['extra']['super_agent'] = [];
        }
        $messageContent['extra']['super_agent']['source'] = $source;

        return new CreateTaskRequestDTO([
            'project_id' => $requestDTO->getProjectId(),
            'topic_id' => $requestDTO->getTopicId(),
            'message_type' => $requestDTO->getMessageType(),
            'force_interrupt' => $requestDTO->isForceInterrupt(),
            'message_content' => $messageContent,
        ]);
    }

    private function createTaskRequestDTOWithExecutionSource(
        CreateTaskRequestDTO $requestDTO,
        SuperMagicExecutionSource $executionSource
    ): CreateTaskRequestDTO {
        return new CreateTaskRequestDTO([
            'project_id' => $requestDTO->getProjectId(),
            'topic_id' => $requestDTO->getTopicId(),
            'message_type' => $requestDTO->getMessageType(),
            'force_interrupt' => $requestDTO->isForceInterrupt(),
            'message_content' => SuperMagicExecutionSource::stampMessageContent(
                $requestDTO->getMessageContent(),
                $executionSource
            ),
        ]);
    }

    private function resolveIngestExecutionSource(array $source): SuperMagicExecutionSource
    {
        $channel = strtolower(trim((string) ($source['channel'] ?? '')));
        if (in_array($channel, ['webhook', 'web_hook'], true)) {
            return SuperMagicExecutionSource::Webhook;
        }

        return SuperMagicExecutionSource::ThirdPartyIm;
    }

    private function resolveUserMessageId(?array $source = null): string
    {
        if (empty($source)) {
            return '';
        }

        $channel = (string) ($source['channel'] ?? '');
        $messageId = (string) ($source['message_id'] ?? '');
        if ($channel === '' || $messageId === '') {
            return '';
        }

        return sprintf('tp:%s:%s', $channel, $messageId);
    }

    /**
     * Push message to IM system (reusable).
     *
     * @param string $chatTopicId Chat topic ID
     * @param string $senderUserId Sender user ID
     * @param string $receiverUserId Receiver user ID (agent)
     * @param string $messageType Message type (e.g., 'rich_text')
     * @param array $messageContent Message content
     * @param string $appMessageId App message ID (use message_id for consistency)
     * @return null|array Complete result from IM, null if failed
     */
    private function pushMessageToIM(
        string $chatTopicId,
        string $senderUserId,
        string $receiverUserId,
        string $messageType,
        array $messageContent,
        string $appMessageId
    ): ?array {
        try {
            // project_file attachments belong to the Super Magic workspace and are not
            // records in magic_chat_file. Keep them in the persisted task message and
            // Tiptap mentions, but do not send them through the legacy IM file checker.
            $messageContent = $this->removeProjectFileAttachmentsForIM($messageContent);

            // Create MagicSeqEntity
            $seqEntity = new MagicSeqEntity();
            $chatMessageType = ChatMessageType::from($messageType);
            $messageStruct = MessageAssembler::getChatMessageStruct(
                $chatMessageType,
                $messageContent
            );

            // Mark message as processed by HTTP API
            // This prevents duplicate processing by SuperAgentMessageSubscriberV2
            /** @var MagicMessageStruct $messageStruct */
            $messageExtra = $messageStruct->getExtra();
            if ($messageExtra === null) {
                $messageExtra = new MessageExtra();
            }

            $superAgentExtra = $messageExtra->getSuperAgent();
            if ($superAgentExtra === null) {
                $superAgentExtra = new SuperAgentExtra();
            }
            $source = $messageContent['extra']['super_agent']['source'] ?? null;
            if (is_array($source) && ! empty($source)) {
                $superAgentExtra->setSource($source);
            }
            $superAgentExtra->setProcessedByApi(true);
            $messageExtra->setSuperAgent($superAgentExtra);
            $messageStruct->setExtra($messageExtra);

            $seqEntity->setContent($messageStruct);
            $seqEntity->setSeqType($chatMessageType);

            // Set topic ID in extra
            $seqExtra = new SeqExtra();
            $seqExtra->setTopicId($chatTopicId);
            $seqEntity->setExtra($seqExtra);

            // Call userSendMessageToAgent with custom app_message_id
            return $this->chatMessageAppService->userSendMessageToAgent(
                aiSeqDTO: $seqEntity,
                senderUserId: $senderUserId,
                receiverId: $receiverUserId,
                appMessageId: $appMessageId,
                doNotParseReferMessageId: false,
                sendTime: new Carbon(),
                receiverType: ConversationType::Ai,
                topicId: $chatTopicId
            );
        } catch (Throwable $e) {
            $this->logger->error('Failed to push message to IM', [
                'chat_topic_id' => $chatTopicId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return null;
        }
    }

    private function removeProjectFileAttachmentsForIM(array $messageContent): array
    {
        $attachments = $messageContent['attachments'] ?? null;
        if (! is_array($attachments)) {
            return $messageContent;
        }

        $chatAttachments = array_values(array_filter(
            $attachments,
            static fn (mixed $attachment): bool => ! is_array($attachment)
                || ($attachment['type'] ?? '') !== 'project_file'
        ));

        if ($chatAttachments === []) {
            unset($messageContent['attachments']);
        } else {
            $messageContent['attachments'] = $chatAttachments;
        }

        return $messageContent;
    }

    /**
     * Deliver message to the task initialization queue for async processing.
     *
     * Builds a UserMessageDTO via the shared assembler and serializes it into the queue
     * payload alongside the synchronously created task id, so the consumer can converge
     * on HandleUserMessageAppService::handleChatMessage without rebuilding context.
     */
    private function deliverMessageToQueue(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        TaskEntity $taskEntity,
        TextContentInterface $contentStruct,
        string $messageType,
        string $agentUserId,
        string $messageId,
        ?int $imSeqId,
        SuperMagicExecutionSource $executionSource,
        ?array $messageSubscriptionConfig = null,
        ?array $parsedMessage = null
    ): void {
        $language = $this->translator->getLocale() ?? 'en_US';

        if (! $contentStruct instanceof MagicMessageStruct) {
            throw new RuntimeException('Unsupported message content');
        }
        $parsedMessage ??= UserMessageDTOAssembler::parseMessageContent($contentStruct, $executionSource);
        // chatConversationId is resolved later by the consumer.
        $userMessageDTO = UserMessageDTOAssembler::fromParsedMessage($parsedMessage, [
            'agent_user_id' => $agentUserId,
            'chat_topic_id' => $topicEntity->getChatTopicId(),
            'topic_id' => $topicEntity->getId(),
            'chat_message_type' => $messageType,
            'message_id' => $messageId,
            'message_seq_id' => $imSeqId !== null ? (string) $imSeqId : '',
            'language' => $language,
            'message_subscription_config' => $messageSubscriptionConfig,
        ]);

        // Create queue message DTO carrying the serialized UserMessageDTO and task id
        $queueMessageDTO = new TaskInitializationMessageDTO(
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
            userId: $dataIsolation->getCurrentUserId(),
            projectId: $topicEntity->getProjectId(),
            topicId: $topicEntity->getId(),
            taskId: $taskEntity->getId(),
            userMessage: $userMessageDTO->toArray(),
            language: $language,
            chatTopicId: $topicEntity->getChatTopicId(),
            agentUserId: $agentUserId,
        );

        // Publish to queue
        $event = new TaskInitializationEvent($queueMessageDTO);
        $publisher = new TaskInitializationPublisher($event);

        $result = $this->producer->produce($publisher);

        if (! $result) {
            $this->logger->error('Failed to publish task initialization event', [
                'task_id' => $taskEntity->getId(),
            ]);
            ExceptionBuilder::throw(
                GenericErrorCode::SystemError,
                'Failed to deliver message to queue'
            );
        }

        $this->logger->info('Task initialization message delivered to queue', [
            'task_id' => $taskEntity->getId(),
            'topic_id' => $topicEntity->getId(),
        ]);
    }

    /**
     * Build the unified create-task response array.
     *
     * Passes through task_id when a new task was created, or queue_id when the
     * topic was active and the message was enqueued for serial processing.
     */
    private function buildCreateTaskResponse(array $result): array
    {
        $response = ['task_id' => $result['task_id'] ?? ''];
        if (! empty($result['queue_id'])) {
            $response['queue_id'] = $result['queue_id'];
        }
        return $response;
    }

    /**
     * Whether the incoming HTTP message should be enqueued into the user message queue
     * instead of starting a task immediately.
     *
     * True when a non-interrupting message arrives while a task is active.
     */
    private function shouldEnqueueToUserMessageQueue(TopicEntity $topicEntity, bool $forceInterrupt): bool
    {
        return ! $forceInterrupt && $topicEntity->getCurrentTaskStatus()?->isActive() === true;
    }

    /**
     * Stop the active topic task before immediately starting a forced message.
     */
    private function interruptCurrentTask(DataIsolation $dataIsolation, TopicEntity $topicEntity): void
    {
        $currentTaskId = $topicEntity->getCurrentTaskId();
        if ($currentTaskId === null || ! $topicEntity->getCurrentTaskStatus()?->isActive()) {
            return;
        }

        $taskEntity = $this->checkTaskPermission($dataIsolation, $currentTaskId);
        $this->updateTaskStatus(
            dataIsolation: $dataIsolation,
            task: $taskEntity,
            status: TaskStatus::Suspended,
            errMsg: 'User force interrupted task'
        );
        TaskTerminationUtil::setTerminationFlag($this->redis, $this->logger, $taskEntity->getId());
        $this->sendInterruptToSandbox($dataIsolation, $taskEntity);
    }

    /**
     * Enqueue the incoming message into the user message queue and notify subscribers.
     */
    private function enqueueUserMessage(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        CreateTaskRequestDTO $requestDTO
    ): MessageQueueEntity {
        $chatMessageType = ChatMessageType::tryFrom($requestDTO->getMessageType());
        if ($chatMessageType === null) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::VALIDATE_FAILED,
                $this->translator->trans('message_queue.invalid_message_type', ['type' => $requestDTO->getMessageType()])
            );
        }

        $messageEntity = $this->messageQueueDomainService->createMessage(
            $dataIsolation,
            $topicEntity->getProjectId(),
            $topicEntity->getId(),
            $requestDTO->getMessageContent(),
            $chatMessageType
        )->message;

        $this->eventDispatcher->dispatch(
            new MessageQueueCreatedEvent(
                $messageEntity,
                $topicEntity,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            )
        );

        return $messageEntity;
    }

    /**
     * Check task permission.
     */
    private function checkTaskPermission(DataIsolation $dataIsolation, int $taskId): TaskEntity
    {
        $taskEntity = $this->taskDomainService->getTaskById($taskId);

        if (is_null($taskEntity)) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::TASK_NOT_FOUND,
                'Task not found'
            );
        }

        // Check if task belongs to current user
        if ($taskEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::TASK_ACCESS_DENIED,
                'Task does not belong to current user'
            );
        }

        return $taskEntity;
    }

    /**
     * Send interrupt message to sandbox.
     */
    private function sendInterruptToSandbox(
        DataIsolation $dataIsolation,
        TaskEntity $taskEntity
    ): void {
        // Get sandbox status
        $result = $this->agentDomainService->getSandboxStatus($taskEntity->getSandboxId());

        if ($result->getStatus() === SandboxStatus::RUNNING) {
            $this->agentDomainService->sendInterruptMessage(
                $dataIsolation,
                $taskEntity->getSandboxId(),
                (string) $taskEntity->getId(),
                ''
            );
        } else {
            // Send interrupt message directly to client
            $topicEntity = $this->topicDomainService->getTopicById($taskEntity->getTopicId());

            if ($topicEntity) {
                $this->clientMessageAppService->sendInterruptMessageToClient(
                    topicId: $topicEntity->getId(),
                    taskId: (string) $taskEntity->getId(),
                    chatTopicId: '',
                    chatConversationId: '',
                    interruptReason: $this->translator->trans('task.agent_stopped')
                );
            }
        }
    }
}
