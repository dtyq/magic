<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\MessageQueueCreatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\MessageQueueDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\MessageQueueUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageQueueDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ConsumeMessageQueueRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateMessageQueueRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\QueryMessageQueueRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateMessageQueueRequestDTO;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;

use function Hyperf\Translation\trans;

/**
 * Message queue application service.
 */
class MessageQueueAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly MessageQueueDomainService $messageQueueDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly EventDispatcherInterface $eventDispatcher,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Create message queue.
     */
    public function createMessage(RequestContext $requestContext, CreateMessageQueueRequestDTO $requestDTO): array
    {
        $this->logger->info('Creating message queue', [
            'project_id' => $requestDTO->getProjectId(),
            'topic_id' => $requestDTO->getTopicId(),
        ]);

        // Create data isolation object
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Convert string IDs to integers
        $projectId = (int) $requestDTO->getProjectId();
        $topicId = (int) $requestDTO->getTopicId();

        // Validate topic status and ownership (only running topics can add messages)
        $this->topicDomainService->validateTopicForMessageQueue(
            $dataIsolation,
            $topicId
        );

        // Validate message type against ChatMessageType enum
        $chatMessageType = ChatMessageType::tryFrom($requestDTO->getMessageType());
        if ($chatMessageType === null) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::VALIDATE_FAILED,
                trans('message_queue.invalid_message_type', ['type' => $requestDTO->getMessageType()])
            );
        }

        // Create message queue
        $messageEntity = $this->messageQueueDomainService->createMessage(
            $dataIsolation,
            $projectId,
            $topicId,
            $requestDTO->getMessageContent(),
            $chatMessageType
        );

        // Dispatch MessageQueueCreatedEvent
        $this->eventDispatcher->dispatch(
            new MessageQueueCreatedEvent(
                $messageEntity,
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            )
        );

        $this->logger->info('Message queue created successfully', [
            'message_id' => $messageEntity->getId(),
            'project_id' => $projectId,
            'topic_id' => $topicId,
        ]);

        return [
            'queue_id' => $messageEntity->getId(),
            'status' => $messageEntity->getStatus()->value,
        ];
    }

    /**
     * Update message queue.
     */
    public function updateMessage(RequestContext $requestContext, int $messageId, UpdateMessageQueueRequestDTO $requestDTO): array
    {
        $this->logger->info('Updating message queue', [
            'message_id' => $messageId,
            'project_id' => $requestDTO->getProjectId(),
            'topic_id' => $requestDTO->getTopicId(),
        ]);

        // Create data isolation object
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Convert string IDs to integers
        $projectId = (int) $requestDTO->getProjectId();
        $topicId = (int) $requestDTO->getTopicId();

        // Get message and check permissions and status
        $existingMessage = $this->messageQueueDomainService->getMessageForUser(
            $messageId,
            $dataIsolation->getCurrentUserId()
        );

        // Validate ownership
        if ($existingMessage->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.topic_access_denied');
        }

        // Validate message type against ChatMessageType enum
        $chatMessageType = ChatMessageType::tryFrom($requestDTO->getMessageType());
        if ($chatMessageType === null) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::VALIDATE_FAILED,
                trans('message_queue.invalid_message_type', ['type' => $requestDTO->getMessageType()])
            );
        }

        // Update message queue
        $messageEntity = $this->messageQueueDomainService->updateMessage(
            $dataIsolation,
            $messageId,
            $projectId,
            $topicId,
            $requestDTO->getMessageContent(),
            $requestDTO->getMessageType()
        );

        // Dispatch MessageQueueUpdatedEvent
        $this->eventDispatcher->dispatch(
            new MessageQueueUpdatedEvent(
                $messageEntity,
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            )
        );

        $this->logger->info('Message queue updated successfully', [
            'message_id' => $messageId,
            'project_id' => $projectId,
            'topic_id' => $topicId,
        ]);

        return [
            'queue_id' => $messageEntity->getId(),
            'status' => $messageEntity->getStatus()->value,
        ];
    }

    /**
     * Delete message queue.
     */
    public function deleteMessage(RequestContext $requestContext, int $messageId): array
    {
        $this->logger->info('Deleting message queue', [
            'message_id' => $messageId,
        ]);

        // Create data isolation object
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Get message and check permissions and status
        $existingMessage = $this->messageQueueDomainService->getMessageForUser(
            $messageId,
            $dataIsolation->getCurrentUserId()
        );

        // Validate ownership
        if ($existingMessage->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.topic_access_denied');
        }

        // Check if message can be deleted (same rule as modification)
        if (! $existingMessage->canBeModified()) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::MESSAGE_STATUS_NOT_MODIFIABLE,
                trans('message_queue.status_not_modifiable')
            );
        }

        // Dispatch MessageQueueDeletedEvent before deletion
        $this->eventDispatcher->dispatch(
            new MessageQueueDeletedEvent(
                $existingMessage,
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            )
        );

        // Delete message queue
        $success = $this->messageQueueDomainService->deleteMessage($dataIsolation, $messageId);

        $this->logger->info('Message queue deleted successfully', [
            'message_id' => $messageId,
            'project_id' => $existingMessage->getProjectId(),
            'success' => $success,
        ]);

        return [
            'rows' => $success ? 1 : 0,
        ];
    }

    /**
     * Query message queues.
     */
    public function queryMessages(RequestContext $requestContext, QueryMessageQueueRequestDTO $requestDTO): array
    {
        $this->logger->info('Querying message queues', [
            'project_id' => $requestDTO->getProjectId(),
            'topic_id' => $requestDTO->getTopicId(),
            'page' => $requestDTO->getPage(),
            'page_size' => $requestDTO->getPageSize(),
        ]);

        // Create data isolation object
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Build query conditions
        $conditions = [];

        if ($requestDTO->hasProjectFilter()) {
            $conditions['project_id'] = (int) $requestDTO->getProjectId();
        }

        if ($requestDTO->hasTopicFilter()) {
            $conditions['topic_id'] = (int) $requestDTO->getTopicId();
        }

        if ($requestDTO->hasMessageTypeFilter()) {
            // Validate message type against ChatMessageType enum
            $chatMessageType = ChatMessageType::tryFrom($requestDTO->getMessageType());
            if ($chatMessageType === null) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::VALIDATE_FAILED,
                    trans('message_queue.invalid_message_type', ['type' => $requestDTO->getMessageType()])
                );
            }
            $conditions['message_type'] = $requestDTO->getMessageType();
        }

        // Query messages
        $result = $this->messageQueueDomainService->queryMessages(
            $dataIsolation,
            $conditions,
            $requestDTO->getPage(),
            $requestDTO->getPageSize()
        );

        // Format response
        $list = [];
        foreach ($result['list'] as $messageEntity) {
            /* @var MessageQueueEntity $messageEntity */
            $list[] = [
                'queue_id' => (string) $messageEntity->getId(),
                'message_content' => $messageEntity->getMessageContentAsArray(),
                'message_type' => $messageEntity->getMessageType(),
                'status' => $messageEntity->getStatus()->value,
                'execute_time' => $messageEntity->getExecuteTime(),
                'err_message' => $messageEntity->getErrMessage(),
                'created_at' => $messageEntity->getCreatedAt(),
            ];
        }

        $this->logger->info('Message queues queried successfully', [
            'total' => $result['total'],
            'count' => count($list),
        ]);

        return [
            'list' => $list,
            'total' => $result['total'],
        ];
    }

    /**
     * Consume message queue.
     */
    public function consumeMessage(RequestContext $requestContext, int $messageId, ConsumeMessageQueueRequestDTO $requestDTO): array
    {
        $this->logger->info('Consuming message queue', [
            'message_id' => $messageId,
            'force' => $requestDTO->isForce(),
        ]);

        // Create data isolation object
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // Get message and check permissions and status
        $existingMessage = $this->messageQueueDomainService->getMessageForUser(
            $messageId,
            $dataIsolation->getCurrentUserId()
        );
        // Validate ownership
        if ($existingMessage->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.topic_access_denied');
        }

        // Consume message
        $messageEntity = $this->messageQueueDomainService->consumeMessage($dataIsolation, $messageId);

        $this->logger->info('Message queue consumed successfully', [
            'message_id' => $messageId,
            'status' => $messageEntity->getStatus()->value,
        ]);

        return [
            'status' => $messageEntity->getStatus()->value,
        ];
    }

    public function getMessageQueueEntity(int $queueId, string $userId): ?MessageQueueEntity
    {
        return $this->messageQueueDomainService->getMessageForUser($queueId, $userId);
    }
}
