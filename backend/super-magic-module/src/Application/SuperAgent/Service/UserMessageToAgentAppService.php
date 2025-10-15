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
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageQueueDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * User Message To Agent Application Service
 * Responsible for sending user messages to agent with intelligent routing.
 * Routes messages based on topic status: queues if RUNNING, sends directly otherwise.
 */
class UserMessageToAgentAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly MagicChatMessageAppService $chatMessageAppService,
        private readonly MessageQueueDomainService $messageQueueDomainService,
        private readonly MagicUserDomainService $userDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Send message to agent with intelligent routing.
     * Automatically determines whether to send directly or queue based on topic status.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param TopicEntity $topicEntity Topic entity
     * @param string $messageType ChatMessageType value
     * @param array $messageContent Message content array
     * @return array Unified response format
     */
    public function sendMessageWithQueueSupport(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        string $messageType,
        array $messageContent
    ): array {
        // If topic status is RUNNING, queue the message
        if ($topicEntity->getCurrentTaskStatus() === TaskStatus::RUNNING) {
            $this->logger->info('Topic is RUNNING, routing message to queue', [
                'topic_id' => $topicEntity->getId(),
                'message_type' => $messageType,
            ]);

            return $this->queueMessage($dataIsolation, $topicEntity, $messageType, $messageContent);
        }

        // Otherwise, send message directly
        $this->logger->info('Topic is not RUNNING, sending message directly', [
            'topic_id' => $topicEntity->getId(),
            'message_type' => $messageType,
        ]);

        return $this->sendMessageDirectly($dataIsolation, $topicEntity, $messageType, $messageContent);
    }

    /**
     * Force send message directly to agent (skip queue check).
     * Use this when you need guaranteed immediate delivery.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param TopicEntity $topicEntity Topic entity
     * @param string $messageType ChatMessageType value
     * @param array $messageContent Message content array
     * @return array Unified response format with send_method='direct'
     */
    public function sendMessageDirectly(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        string $messageType,
        array $messageContent
    ): array {
        try {
            // Convert message content
            $chatMessageType = ChatMessageType::from($messageType);
            $messageStruct = MessageAssembler::getChatMessageStruct(
                $chatMessageType,
                $messageContent
            );

            // Create MagicSeqEntity
            $seqEntity = $this->createSeqEntity($chatMessageType, $messageStruct, $topicEntity->getChatTopicId());

            // Generate unique app message ID for deduplication
            $appMessageId = IdGenerator::getUniqueId32();

            // Get agent user entity
            $aiUserEntity = $this->getAgentUserEntity($dataIsolation);

            if (empty($aiUserEntity)) {
                return [
                    'success' => false,
                    'send_method' => 'direct',
                    'data' => [
                        'message_id' => null,
                        'message_queue_id' => null,
                        'result' => null,
                    ],
                    'error_message' => 'Agent user not found for organization: ' . $dataIsolation->getCurrentOrganizationCode(),
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

            $this->logger->info('Message sent directly to agent', [
                'topic_id' => $topicEntity->getId(),
                'app_message_id' => $appMessageId,
                'message_type' => $messageType,
            ]);

            return [
                'success' => ! empty($result),
                'send_method' => 'direct',
                'data' => [
                    'message_id' => $appMessageId,
                    'message_queue_id' => null,
                    'result' => $result,
                ],
                'error_message' => null,
            ];
        } catch (Throwable $e) {
            $this->logger->error('Failed to send message directly to agent', [
                'topic_id' => $topicEntity->getId(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return [
                'success' => false,
                'send_method' => 'direct',
                'data' => [
                    'message_id' => null,
                    'message_queue_id' => null,
                    'result' => null,
                ],
                'error_message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Force queue message (skip direct send).
     * Use this when you want to defer message processing.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param TopicEntity $topicEntity Topic entity
     * @param string $messageType ChatMessageType value
     * @param array $messageContent Message content array
     * @return array Unified response format with send_method='queued'
     */
    public function queueMessage(
        DataIsolation $dataIsolation,
        TopicEntity $topicEntity,
        string $messageType,
        array $messageContent
    ): array {
        try {
            // Validate message type
            ChatMessageType::from($messageType);

            // Create message queue entity
            // Note: MessageQueueDomainService::createMessage() expects string type for $messageType parameter
            $messageQueueEntity = $this->messageQueueDomainService->createMessage(
                $dataIsolation,
                $topicEntity->getProjectId(),
                $topicEntity->getId(),
                $messageContent,
                $messageType
            );

            $this->logger->info('Message inserted into queue', [
                'topic_id' => $topicEntity->getId(),
                'message_queue_id' => $messageQueueEntity->getId(),
                'project_id' => $topicEntity->getProjectId(),
                'message_type' => $messageType,
            ]);

            return [
                'success' => true,
                'send_method' => 'queued',
                'data' => [
                    'message_id' => null,
                    'message_queue_id' => $messageQueueEntity->getId(),
                    'result' => [
                        'message_queue_id' => $messageQueueEntity->getId(),
                        'status' => 'queued',
                    ],
                ],
                'error_message' => null,
            ];
        } catch (Throwable $e) {
            $this->logger->error('Failed to insert message into queue', [
                'topic_id' => $topicEntity->getId(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return [
                'success' => false,
                'send_method' => 'queued',
                'data' => [
                    'message_id' => null,
                    'message_queue_id' => null,
                    'result' => null,
                ],
                'error_message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Create MagicSeqEntity based on message content.
     */
    private function createSeqEntity(
        ChatMessageType $messageType,
        mixed $messageStruct,
        string $chatTopicId
    ): MagicSeqEntity {
        $seqEntity = new MagicSeqEntity();
        $seqEntity->setContent($messageStruct);
        $seqEntity->setSeqType($messageType);

        // Set topic ID in extra
        $seqExtra = new SeqExtra();
        $seqExtra->setTopicId($chatTopicId);
        $seqEntity->setExtra($seqExtra);

        return $seqEntity;
    }

    /**
     * Get agent user entity by AI code.
     */
    private function getAgentUserEntity(DataIsolation $dataIsolation): mixed
    {
        $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);

        if (empty($aiUserEntity)) {
            $this->logger->error('Agent user not found, skip processing', [
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            ]);
        }

        return $aiUserEntity;
    }
}
