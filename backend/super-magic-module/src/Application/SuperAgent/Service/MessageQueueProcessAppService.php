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
use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Carbon\Carbon;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageQueueStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageQueueDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Hyperf\Logger\LoggerFactory;
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
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
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

            // 3. Convert message content
            $chatMessageType = ChatMessageType::from($message->getMessageType());
            $messageStruct = MessageAssembler::getChatMessageStruct(
                $chatMessageType,
                $message->getMessageContentAsArray()
            );

            // 4. Update status to in progress
            $this->messageQueueDomainService->updateStatus(
                $message->getId(),
                MessageQueueStatus::IN_PROGRESS
            );

            // 5. Send message to agent
            $sendResult = $this->sendMessageToAgent(
                $topicEntity->getChatTopicId(),
                $message,
                $messageStruct
            );

            // 6. Update final status
            $finalStatus = $sendResult['success'] ? MessageQueueStatus::COMPLETED : MessageQueueStatus::FAILED;
            $this->messageQueueDomainService->updateStatus(
                $message->getId(),
                $finalStatus,
                $sendResult['error_message']
            );

            // 7. If success, push notification to client
            if ($sendResult['success']) {
                $this->pushMessageQueueNotification($topicEntity, $message);
            }

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

    /**
     * Push message queue consumption notification to client.
     */
    private function pushMessageQueueNotification(
        TopicEntity $topicEntity,
        MessageQueueEntity $message
    ): void {
        try {
            $pushData = $this->buildMessageQueuePushData($topicEntity, $message);
            $this->pushNotification($topicEntity->getUserId(), $pushData);
        } catch (Throwable $e) {
            $this->logger->error('Failed to push message queue notification', [
                'topic_id' => $topicEntity->getId(),
                'message_id' => $message->getId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Build push data structure for message queue consumption.
     */
    private function buildMessageQueuePushData(
        TopicEntity $topicEntity,
        MessageQueueEntity $message
    ): array {
        return [
            'type' => 'super_magic_message_queue_consumed',
            'project_id' => (string) $topicEntity->getProjectId(),
            'topic_id' => (string) $topicEntity->getId(),
            'chat_topic_id' => $topicEntity->getChatTopicId(),
            'message_id' => (string) $message->getId(),
            'timestamp' => date('c'),
        ];
    }

    /**
     * Push notification via WebSocket.
     */
    private function pushNotification(string $userId, array $pushData): void
    {
        $magicId = $this->getMagicIdByUserId($userId);

        if (empty($magicId)) {
            $this->logger->warning('Cannot get magicId for user', ['user_id' => $userId]);
            return;
        }

        $this->logger->info('Pushing message queue notification', [
            'magic_id' => $magicId,
            'topic_id' => $pushData['topic_id'],
            'message_id' => $pushData['message_id'],
        ]);

        // Push via WebSocket
        SocketIOUtil::sendIntermediate(
            SocketEventType::Intermediate,
            $magicId,
            $pushData
        );
    }

    /**
     * Get magicId by userId.
     */
    private function getMagicIdByUserId(string $userId): string
    {
        try {
            $userEntity = $this->userDomainService->getUserById($userId);
            return $userEntity?->getMagicId() ?? '';
        } catch (Throwable $e) {
            $this->logger->error('Failed to get magicId by userId', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return '';
        }
    }
}
