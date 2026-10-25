<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Message\Event\Subscribe;

use App\Application\Chat\Service\MagicAgentEventAppService;
use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Application\SuperMagic\Message\Assembler\UserMessageDTOAssembler;
use App\Application\SuperMagic\Message\DTO\UserMessageDTO;
use App\Application\SuperMagic\Message\Service\ClientMessageAppService;
use App\Application\SuperMagic\Message\Service\HandleUserMessageAppService;
use App\Domain\Chat\DTO\Message\MagicMessageStruct;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Event\Agent\UserCallAgentEvent;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Common\Entity\ValueObject\SuperMagicExecutionSource;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\EventErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\SuperMagic\Utils\TaskEventUtil;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Super Agent Service.
 *
 * Responsible for publishing agent messages based on AI code processing
 */
class SuperAgentMessageSubscriberV2 extends MagicAgentEventAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected readonly HandleUserMessageAppService $handleUserMessageAppService,
        protected readonly MagicChatMessageAppService $magicChatMessageAppService,
        protected readonly ClientMessageAppService $clientMessageAppService,
        protected readonly TopicDomainService $topicDomainService,
        protected readonly LoggerFactory $loggerFactory,
        MagicConversationDomainService $magicConversationDomainService,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));

        parent::__construct($magicConversationDomainService);
    }

    public function agentExecEvent(UserCallAgentEvent $userCallAgentEvent)
    {
        // Determine if Super Magic needs to be called
        if ($userCallAgentEvent->agentAccountEntity->getAiCode() === AppCodeEnum::SUPER_MAGIC->value) {
            // Check if message has been processed by HTTP API
            // If yes, skip processing to avoid duplicate handling
            /** @var ?MagicMessageStruct $messageStruct */
            $messageStruct = $userCallAgentEvent->messageEntity?->getContent();
            $superAgentExtra = $messageStruct?->getExtra()?->getSuperAgent();

            if ($superAgentExtra !== null && $superAgentExtra->isProcessedByApi()) {
                $this->logger->info('Message already processed by HTTP API, skip event processing', [
                    'seq_id' => $userCallAgentEvent->seqEntity->getSeqId(),
                    'message_id' => $userCallAgentEvent->seqEntity->getMessageId(),
                    'magic_message_id' => $userCallAgentEvent->messageEntity?->getMagicMessageId(),
                ]);
                return;
            }

            // Process through original IM flow
            $this->handlerSuperMagicMessage($userCallAgentEvent);
        } else {
            // Process messages through normal agent handling
            parent::agentExecEvent($userCallAgentEvent);
        }
    }

    private function handlerSuperMagicMessage(UserCallAgentEvent $userCallAgentEvent): void
    {
        // Notification context, populated as soon as it is parsed so the single catch
        // below can always try to notify the client (even on parsing failures).
        $dataIsolation = null;
        $userMessageDTO = null;
        try {
            // 将本次链路（含下游沙箱创建/网关请求）的 request_id 统一到聊天消息的 app_message_id，
            // 便于通过同一个 id 在日志中串起 聊天 → Agent 处理 → 沙箱创建 全链路。
            // 与 MagicChatWebSocketApi::relationAppMsgIdAndRequestId、AbstractSeqConsumer::setRequestId 保持一致。
            $appMessageId = $userCallAgentEvent->seqEntity->getAppMessageId();
            if (! empty($appMessageId)) {
                CoContext::setRequestId($appMessageId);
            }

            $this->logger->info('Received super agent message', [
                'app_message_id' => $userCallAgentEvent->seqEntity->getAppMessageId(),
                'seq_id' => $userCallAgentEvent->seqEntity->getId(),
                'conversation_id' => $userCallAgentEvent->seqEntity->getConversationId(),
                'topic_id' => $userCallAgentEvent->seqEntity->getExtra()?->getTopicId(),
                'organization_code' => $userCallAgentEvent->senderUserEntity->getOrganizationCode() ?? '',
                'user_id' => $userCallAgentEvent->senderUserEntity->getUserId() ?? '',
                'agent_user_id' => $userCallAgentEvent->agentUserEntity->getUserId() ?? '',
                'message_id' => $userCallAgentEvent->messageEntity?->getId(),
                'message_type' => $userCallAgentEvent->messageEntity?->getMessageType()?->value,
            ]);
            /** @var null|MagicMessageStruct $messageStruct */
            $messageStruct = $userCallAgentEvent->messageEntity?->getContent();
            if (! $messageStruct instanceof MagicMessageStruct) {
                $this->logger->warning('Unsupported super agent message content');
                return;
            }
            $chatMessageType = $userCallAgentEvent->messageEntity?->getMessageType()->value ?? ChatMessageType::Text->value;
            // Extract necessary information
            $conversationId = $userCallAgentEvent->seqEntity->getConversationId() ?? '';
            $chatTopicId = $userCallAgentEvent->seqEntity->getExtra()?->getTopicId() ?? '';
            $organizationCode = $userCallAgentEvent->senderUserEntity->getOrganizationCode() ?? '';
            $userId = $userCallAgentEvent->senderUserEntity->getUserId() ?? '';
            $agentUserId = $userCallAgentEvent->agentUserEntity->getUserId() ?? '';
            $language = $userCallAgentEvent->messageEntity?->getLanguage() ?? '';

            // Get User Seq id
            $useSeqEntity = $this->magicChatMessageAppService->getMagicSeqEntity($userCallAgentEvent->seqEntity->getMagicMessageId(), ConversationType::User);
            if ($useSeqEntity) {
                $messageId = $messageSeqId = $useSeqEntity->getId();
            } else {
                $messageId = $messageSeqId = (string) IdGenerator::getSnowId();
            }
            // Parameter validation
            if (empty($conversationId) || empty($chatTopicId) || empty($organizationCode)
                || empty($userId) || empty($agentUserId)) {
                $this->logger->error(sprintf(
                    'Incomplete message parameters, conversation_id: %s, topic_id: %s, organization_code: %s, user_id: %s, agent_user_id: %s',
                    $conversationId,
                    $chatTopicId,
                    $organizationCode,
                    $userId,
                    $agentUserId
                ));
                return;
            }

            // Create data isolation object
            $dataIsolation = DataIsolation::create($organizationCode, $userId);
            $dataIsolation->initDataIsolationEnv();
            $dataIsolation->setLanguage($language);

            $fields = UserMessageDTOAssembler::parseMessageContent($messageStruct, SuperMagicExecutionSource::HumanChat);
            $userMessageDTO = UserMessageDTOAssembler::fromParsedMessage($fields, [
                'agent_user_id' => $agentUserId,
                'chat_conversation_id' => $conversationId,
                'chat_topic_id' => $chatTopicId,
                'topic_id' => (int) $chatTopicId,
                'message_id' => $messageId,
                'message_seq_id' => $messageSeqId,
                'chat_message_type' => $chatMessageType,
                'language' => $language,
                'raw_content' => $this->getRawContent($userCallAgentEvent),
            ]);
            $toolReply = UserMessageDTOAssembler::resolveUserToolCallMessage($messageStruct, $fields['dynamic_params']);

            // The transport owns notifications; classification and execution are shared.
            $notification = $this->handleUserMessageAppService->handleMessage($dataIsolation, $userMessageDTO, $toolReply);
            if ($notification !== null) {
                $this->clientMessageAppService->sendInterruptMessageToClient(
                    topicId: $notification->topicId,
                    taskId: $notification->taskId,
                    chatTopicId: $userMessageDTO->getChatTopicId(),
                    chatConversationId: $userMessageDTO->getChatConversationId(),
                    interruptReason: $notification->reason,
                );
            }
            $this->logger->info('Super agent message processing completed');
            return;
        } catch (EventException $e) {
            // Business-level failure (e.g. validation / pre-check): send a reminder to the client.
            $this->logger->warning(sprintf('Handle super agent message, event processing failed: %s', $e->getMessage()));
            $this->sendFailureReminderToClient($dataIsolation, $userMessageDTO, $e);
            // Acknowledge message even on error to avoid message accumulation
        } catch (BusinessException $e) {
            // Business exceptions contain translated, client-safe messages.
            $this->logger->warning(sprintf('Handle super agent message, business processing failed: %s', $e->getMessage()));
            $this->sendFailureErrorToClient($dataIsolation, $userMessageDTO, $e->getMessage());
            // Acknowledge message even on error to avoid message accumulation
        } catch (Throwable $e) {
            // Unexpected failure (parsing / dispatch / infrastructure): log full context
            // and surface a generic error to the client so the request is never left silent.
            $trace = $e->getTraceAsString();
            if (strlen($trace) > 2000) {
                $trace = substr($trace, 0, 2000) . ' ...(truncated)';
            }
            $this->logger->error('Failed to process super agent message', [
                'error_message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'app_message_id' => $userCallAgentEvent->seqEntity->getAppMessageId(),
                'seq_id' => $userCallAgentEvent->seqEntity->getId(),
                'conversation_id' => $userCallAgentEvent->seqEntity->getConversationId(),
                'topic_id' => $userCallAgentEvent->seqEntity->getExtra()?->getTopicId(),
                'organization_code' => $userCallAgentEvent->senderUserEntity->getOrganizationCode() ?? '',
                'user_id' => $userCallAgentEvent->senderUserEntity->getUserId() ?? '',
                'agent_user_id' => $userCallAgentEvent->agentUserEntity->getUserId() ?? '',
                'message_id' => $userCallAgentEvent->messageEntity?->getId(),
                'message_type' => $userCallAgentEvent->messageEntity?->getMessageType()?->value,
                'trace' => $trace,
            ]);
            $this->sendFailureErrorToClient($dataIsolation, $userMessageDTO);
            // Acknowledge message even on error to avoid message accumulation
        }
    }

    /**
     * Send a business reminder (EventException) to the client.
     *
     * Defensive: no-ops when notification context is not yet available (early parsing
     * failure) and never throws, so a notification failure cannot break message ACK.
     */
    private function sendFailureReminderToClient(
        ?DataIsolation $dataIsolation,
        ?UserMessageDTO $userMessageDTO,
        EventException $e
    ): void {
        // 过期回答是可预期的竞态结果，前端已经用 Tip 告知用户；不要再写入消息列表。
        if ($e->getCode() === EventErrorCode::EVENT_USER_TOOL_CALL_EXPIRED->value) {
            $this->logger->info('Skip reminder for expired user tool call answer', [
                'error_code' => $e->getCode(),
            ]);
            return;
        }
        if ($dataIsolation === null || $userMessageDTO === null) {
            return;
        }
        try {
            if ($e->getCode() === EventErrorCode::EVENT_USER_TOOL_CALL_RECOVERY_FAILED->value) {
                $this->clientMessageAppService->sendUserToolCallRecoveryTipToClient(
                    topicId: $this->resolveTopicId($dataIsolation, $userMessageDTO),
                    taskId: '',
                    chatTopicId: $userMessageDTO->getChatTopicId(),
                    chatConversationId: $userMessageDTO->getChatConversationId(),
                    toolCallId: (string) ($e->getData()['tool_call_id'] ?? ''),
                );
                return;
            }
            $this->clientMessageAppService->sendReminderMessageToClient(
                topicId: $this->resolveTopicId($dataIsolation, $userMessageDTO),
                taskId: '',
                chatTopicId: $userMessageDTO->getChatTopicId(),
                chatConversationId: $userMessageDTO->getChatConversationId(),
                remind: $e->getMessage(),
                remindEvent: TaskEventUtil::getRemindTaskEventByCode($e->getCode()),
                dynamicParams: $userMessageDTO->getDynamicParams(),
                data: $e->getData(),
            );
        } catch (Throwable $notifyError) {
            $this->logger->error('Failed to send reminder message to client', [
                'error' => $notifyError->getMessage(),
            ]);
        }
    }

    /**
     * Send a generic error message to the client.
     *
     * Defensive: no-ops when notification context is not yet available (early parsing
     * failure) and never throws, so a notification failure cannot break message ACK.
     */
    private function sendFailureErrorToClient(
        ?DataIsolation $dataIsolation,
        ?UserMessageDTO $userMessageDTO,
        string $errorMessage = ''
    ): void {
        if ($dataIsolation === null || $userMessageDTO === null) {
            return;
        }
        try {
            $this->clientMessageAppService->sendErrorMessageToClient(
                topicId: $this->resolveTopicId($dataIsolation, $userMessageDTO),
                taskId: '',
                chatTopicId: $userMessageDTO->getChatTopicId(),
                chatConversationId: $userMessageDTO->getChatConversationId(),
                errorMessage: trim($errorMessage) !== '' ? $errorMessage : trans('task.initialize_error'),
                dynamicParams: $userMessageDTO->getDynamicParams(),
            );
        } catch (Throwable $notifyError) {
            $this->logger->error('Failed to send error message to client', [
                'error' => $notifyError->getMessage(),
            ]);
        }
    }

    /**
     * Resolve the topic id for client notifications.
     * Returns 0 when the topic cannot be resolved so notifications can still be attempted.
     */
    private function resolveTopicId(DataIsolation $dataIsolation, UserMessageDTO $userMessageDTO): int
    {
        try {
            $topicEntity = $this->topicDomainService->getTopicByChatTopicId($dataIsolation, $userMessageDTO->getChatTopicId());
            return $topicEntity?->getId() ?? 0;
        } catch (Throwable) {
            return 0;
        }
    }

    private function getRawContent(UserCallAgentEvent $userCallAgentEvent): string
    {
        $seqObject = SeqAssembler::getClientSeqStruct($userCallAgentEvent->seqEntity, $userCallAgentEvent->messageEntity);
        try {
            $type = $seqObject->getSeq()->getMessage()->getType() ?? 'undefined';
            $data = [
                'type' => $type, $type => $seqObject->getSeq()->getMessage()->getContent(),
            ];
            return json_encode($data, JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            return '';
        }
    }
}
