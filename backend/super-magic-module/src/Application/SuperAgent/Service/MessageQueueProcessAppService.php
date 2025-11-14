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
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Carbon\Carbon;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageQueueStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\MessageQueueConsumedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageQueueDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Message Queue Process Application Service
 * Handles message queue processing after task completion and sends WebSocket notifications.
 */
class MessageQueueProcessAppService extends AbstractAppService
{
    // Lock strategy constants
    private const TOPIC_LOCK_EXPIRE = 300; // Topic lock expiration time (seconds)

    protected LoggerInterface $logger;

    public function __construct(
        private readonly MagicChatMessageAppService $chatMessageAppService,
        private readonly MessageQueueDomainService $messageQueueDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly MagicUserDomainService $userDomainService,
        private readonly EventDispatcherInterface $eventDispatcher,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Process single message - send to agent and notify client.
     * This method is called by API layer for manual consumption.
     *
     * @param int $messageId Message queue ID
     * @return array Result with success status and error message
     */
    public function processSingleMessage(int $messageId): array
    {
        // 1. Get message entity
        $message = $this->messageQueueDomainService->getMessageById($messageId);
        if (! $message) {
            $this->logger->warning('Message not found', ['message_id' => $messageId]);
            return [
                'success' => false,
                'error_message' => 'Message not found',
            ];
        }

        // 2. Get topic entity
        $topicEntity = $this->topicDomainService->getTopicById($message->getTopicId());
        if (! $topicEntity) {
            $this->logger->warning('Topic not found for message', [
                'message_id' => $messageId,
                'topic_id' => $message->getTopicId(),
            ]);
            return [
                'success' => false,
                'error_message' => 'Topic not found',
            ];
        }
        // Acquire topic lock
        $lockOwner = $this->messageQueueDomainService->acquireTopicLock($topicEntity->getId(), self::TOPIC_LOCK_EXPIRE);
        if ($lockOwner === null) {
            $this->logger->info('Unable to acquire topic lock, skip processing', ['topic_id' => $topicEntity->getId()]);
            return [
                'success' => false,
                'error_message' => 'Unable to acquire topic lock, skip processing',
            ];
        }
        try {
            // Send queued message to agent with status tracking
            $sendResult = $this->sendQueuedMessageToAgent($message, $topicEntity);
            $this->logger->info('Single message processed successfully', [
                'message_id' => $messageId,
                'success' => $sendResult['success'],
            ]);

            return $sendResult;
        } catch (Throwable $e) {
            $this->logger->error('Failed to process single message', [
                'message_id' => $messageId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'success' => false,
                'error_message' => $e->getMessage(),
            ];
        } finally {
            $this->messageQueueDomainService->releaseTopicLock($topicEntity->getId(), $lockOwner);
        }
    }

    /**
     * Process message queue for a specific topic after task completion.
     * @param int $topicId Topic ID
     */
    public function processTopicMessageQueue(int $topicId): void
    {
        // 1. Check if message queue feature is enabled
        $enabled = config('super-magic.user_message_queue.enabled', true);
        if (! $enabled) {
            $this->logger->debug('Message queue feature is disabled', ['topic_id' => $topicId]);
            return;
        }

        // 2. Acquire topic lock
        $lockOwner = $this->messageQueueDomainService->acquireTopicLock($topicId, self::TOPIC_LOCK_EXPIRE);

        if ($lockOwner === null) {
            $this->logger->info('Unable to acquire topic lock, skip processing', ['topic_id' => $topicId]);
            return;
        }

        try {
            // 3. Process topic messages
            $this->processTopicMessagesInternal($topicId);
        } finally {
            // 4. Always release the lock
            $this->messageQueueDomainService->releaseTopicLock($topicId, $lockOwner);
        }
    }

    /**
     * Internal processing logic for topic messages.
     */
    private function processTopicMessagesInternal(int $topicId): void
    {
        try {
            // 1. Get topic entity
            $topicEntity = $this->topicDomainService->getTopicById($topicId);
            if (! $topicEntity) {
                $this->logger->warning('Topic not found, skip processing', ['topic_id' => $topicId]);
                return;
            }

            // 2. Get earliest pending message
            $message = $this->messageQueueDomainService->getEarliestMessageByTopic($topicId);
            if (! $message) {
                $this->logger->debug('No pending messages for topic', ['topic_id' => $topicId]);
                return;
            }

            $this->logger->info('Processing message queue for topic', [
                'topic_id' => $topicId,
                'message_id' => $message->getId(),
            ]);

            // 3. Send queued message to agent with status tracking
            $sendResult = $this->sendQueuedMessageToAgent($message, $topicEntity);

            $this->logger->info('Message queue processed successfully', [
                'message_id' => $message->getId(),
                'topic_id' => $topicId,
                'success' => $sendResult['success'],
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to process topic messages', [
                'topic_id' => $topicId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Send queued message to agent with status tracking and notification.
     * This method handles the core message delivery workflow:
     * 1. Convert message content to chat format
     * 2. Update status to IN_PROGRESS
     * 3. Send message to agent
     * 4. Update final status (COMPLETED/FAILED)
     * 5. Push WebSocket notification (if success).
     *
     * @param MessageQueueEntity $message Message entity to process
     * @param TopicEntity $topicEntity Topic entity
     * @return array Result with success status and error message
     */
    private function sendQueuedMessageToAgent(
        MessageQueueEntity $message,
        TopicEntity $topicEntity
    ): array {
        // 1. Convert message content
        $chatMessageType = ChatMessageType::from($message->getMessageType());
        $messageStruct = MessageAssembler::getChatMessageStruct(
            $chatMessageType,
            $message->getMessageContentAsArray()
        );

        // 2. Update status to in progress
        $this->messageQueueDomainService->updateStatus(
            $message->getId(),
            MessageQueueStatus::IN_PROGRESS
        );

        // 3. Send message to agent
        $sendResult = $this->sendMessageToAgent(
            $topicEntity->getChatTopicId(),
            $message,
            $messageStruct
        );

        // 4. Update final status
        $finalStatus = $sendResult['success'] ? MessageQueueStatus::COMPLETED : MessageQueueStatus::FAILED;
        $this->messageQueueDomainService->updateStatus(
            $message->getId(),
            $finalStatus,
            $sendResult['error_message']
        );

        // 5. Dispatch MessageQueueConsumedEvent (subscriber will handle notification)
        $this->eventDispatcher->dispatch(
            new MessageQueueConsumedEvent(
                $message,
                $topicEntity,
                $sendResult['success']
            )
        );

        return $sendResult;
    }

    /**
     * Send message to agent using Chat service.
     * @param mixed $messageStruct
     */
    private function sendMessageToAgent(
        string $chatTopicId,
        MessageQueueEntity $message,
        $messageStruct
    ): array {
        try {
            // Create MagicSeqEntity based on message content
            $seqEntity = new MagicSeqEntity();
            $seqEntity->setContent($messageStruct);
            $seqEntity->setSeqType(ChatMessageType::from($message->getMessageType()));

            // Set topic ID in extra
            $seqExtra = new SeqExtra();
            $seqExtra->setTopicId($chatTopicId);
            $seqEntity->setExtra($seqExtra);

            // Generate unique app message ID for deduplication
            $appMessageId = IdGenerator::getUniqueId32();

            // Get agent user_id
            $dataIsolation = new DataIsolation();
            $dataIsolation->setCurrentOrganizationCode($message->getOrganizationCode());
            $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);

            if (empty($aiUserEntity)) {
                $this->logger->error('Agent user not found, skip processing', ['topic_id' => $message->getTopicId()]);
                return [
                    'success' => false,
                    'error_message' => 'Agent user not found for organization: ' . $message->getOrganizationCode(),
                    'result' => null,
                ];
            }

            // Call userSendMessageToAgent
            $result = $this->chatMessageAppService->userSendMessageToAgent(
                aiSeqDTO: $seqEntity,
                senderUserId: $message->getUserId(),
                receiverId: $aiUserEntity->getUserId(),
                appMessageId: $appMessageId,
                doNotParseReferMessageId: false,
                sendTime: new Carbon(),
                receiverType: ConversationType::Ai,
                topicId: $chatTopicId
            );

            return [
                'success' => ! empty($result),
                'error_message' => null,
                'result' => $result,
            ];
        } catch (Throwable $e) {
            $this->logger->error('Failed to send message to agent', [
                'message_id' => $message->getId(),
                'topic_id' => $message->getTopicId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error_message' => $e->getMessage(),
                'result' => null,
            ];
        }
    }
}
