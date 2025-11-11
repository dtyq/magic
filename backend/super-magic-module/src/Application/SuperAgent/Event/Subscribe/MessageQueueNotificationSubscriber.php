<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\MessageQueueConsumedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\MessageQueueCreatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\MessageQueueDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\MessageQueueUpdatedEvent;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Message Queue Notification Subscriber.
 * Handles message queue events and sends WebSocket notifications to clients.
 */
#[AsyncListener]
#[Listener]
class MessageQueueNotificationSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly MagicUserDomainService $userDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * List of events to listen to.
     */
    public function listen(): array
    {
        return [
            MessageQueueCreatedEvent::class,
            MessageQueueUpdatedEvent::class,
            MessageQueueDeletedEvent::class,
            MessageQueueConsumedEvent::class,
        ];
    }

    /**
     * Process event.
     */
    public function process(object $event): void
    {
        // Log received event
        $this->logger->info('MessageQueueNotificationSubscriber received event', [
            'event_class' => get_class($event),
        ]);

        try {
            $this->pushMessageQueueNotification(
                $event->getTopicEntity(),
                $event->getMessageQueueEntity()
            );
        } catch (Throwable $e) {
            $this->logger->error('Failed to process message queue event', [
                'event_class' => get_class($event),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
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

            $this->logger->info('Message queue notification pushed successfully', [
                'topic_id' => $topicEntity->getId(),
                'message_id' => $message->getId(),
                'user_id' => $topicEntity->getUserId(),
            ]);
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
            'type' => 'seq',
            'seq' => [
                'magic_id' => '',
                'seq_id' => '',
                'message_id' => '',
                'refer_message_id' => '',
                'sender_message_id' => '',
                'conversation_id' => $topicEntity->getChatConversationId(),
                'organization_code' => $topicEntity->getUserOrganizationCode(),
                'message' => [
                    'type' => 'super_magic_message_queue_consumed',
                    'project_id' => (string) $topicEntity->getProjectId(),
                    'topic_id' => (string) $topicEntity->getId(),
                    'chat_topic_id' => $topicEntity->getChatTopicId(),
                    'message_id' => (string) $message->getId(),
                ],
            ],
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
            'topic_id' => $pushData['seq']['message']['topic_id'],
            'message_id' => $pushData['seq']['message']['message_id'],
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
