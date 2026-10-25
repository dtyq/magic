<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Message\Service;

use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Message\Entity\MessageQueueEntity;
use App\Domain\SuperMagic\Message\Event\MessageQueueCreatedEvent;
use App\Domain\SuperMagic\Message\Event\MessageQueueDeletedEvent;
use App\Domain\SuperMagic\Message\Event\MessageQueueUpdatedEvent;
use App\Domain\SuperMagic\Message\Service\MessageQueueDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Message\DTO\Request\ConsumeMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\CreateMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\MoveMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\QueryMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\RestoreMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\UpdateMessageQueueRequestDTO;
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
        private readonly ProjectDomainService $projectDomainService,
        private readonly MessageQueueProcessAppService $messageQueueProcessAppService,
        private readonly EventDispatcherInterface $eventDispatcher,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Create message queue.
     *
     * @return array{queue_id: string, status: int}
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

        // Validate topic status and ownership (only running topics can add messages) and get TopicEntity
        $topicEntity = $this->topicDomainService->validateTopicForMessageQueue(
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
        $writeResult = $this->messageQueueDomainService->createMessage(
            $dataIsolation,
            $projectId,
            $topicId,
            $requestDTO->getMessageContent(),
            $chatMessageType
        );

        $messageEntity = $writeResult->message;
        if (! $writeResult->changed) {
            return ['queue_id' => (string) $messageEntity->getId(), 'status' => $messageEntity->getStatus()->value];
        }

        // Dispatch MessageQueueCreatedEvent
        $this->eventDispatcher->dispatch(
            new MessageQueueCreatedEvent(
                $messageEntity,
                $topicEntity,
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            )
        );

        $this->logger->info('Message queue created successfully', [
            'message_id' => $messageEntity->getId(),
            'project_id' => $projectId,
            'topic_id' => $topicId,
        ]);

        if ($requestDTO->processImmediately) {
            $this->messageQueueProcessAppService->processTopicMessageQueue($topicId);
        }

        return [
            'queue_id' => (string) $messageEntity->getId(),
            'status' => $messageEntity->getStatus()->value,
        ];
    }

    /**
     * Update message queue.
     *
     * @return array{queue_id: string, status: int}
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

        // Validate topic and get TopicEntity
        $topicEntity = $this->topicDomainService->validateTopicForMessageQueue(
            $dataIsolation,
            $topicId
        );

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
                $topicEntity,
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
            'queue_id' => (string) $messageEntity->getId(),
            'status' => $messageEntity->getStatus()->value,
        ];
    }

    /**
     * Delete message queue.
     */
    public function deleteMessage(RequestContext $requestContext, int $messageId, ?string $expectedSyncId = null): array
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
            $dataIsolation->getCurrentUserId(),
            true
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

        // Validate topic and get TopicEntity (before deletion, for event)
        $topicEntity = $this->topicDomainService->validateTopicForMessageQueue(
            $dataIsolation,
            $existingMessage->getTopicId()
        );

        // Delete message queue
        $success = $this->messageQueueDomainService->deleteMessage($dataIsolation, $messageId, $expectedSyncId);

        // Dispatch MessageQueueDeletedEvent after successful deletion
        if ($success) {
            $this->eventDispatcher->dispatch(
                new MessageQueueDeletedEvent(
                    $existingMessage,
                    $topicEntity,
                    $userAuthorization->getId(),
                    $userAuthorization->getOrganizationCode()
                )
            );
        }

        $this->logger->info('Message queue deleted successfully', [
            'message_id' => $messageId,
            'project_id' => $existingMessage->getProjectId(),
            'success' => $success,
        ]);

        return [
            'rows' => $success ? 1 : 0,
            'removed' => true,
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
                'sort_order' => (string) $messageEntity->getSortOrder(),
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

    public function restoreMessage(RequestContext $requestContext, int $messageId, RestoreMessageQueueRequestDTO $dto): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $isolation = $this->createDataIsolation($authorization);
        $topic = $this->validateQueueScope($isolation, (int) $dto->projectId, (int) $dto->topicId);
        $type = ChatMessageType::tryFrom($dto->messageType);
        if ($type === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, trans('message_queue.invalid_message_type', ['type' => $dto->messageType]));
        }
        $result = $this->messageQueueDomainService->restoreMessage(
            $isolation,
            $messageId,
            (int) $dto->projectId,
            (int) $dto->topicId,
            $dto->messageContent,
            $type,
            $dto->beforeId === null ? null : (int) $dto->beforeId,
            $dto->afterId === null ? null : (int) $dto->afterId,
            $dto->originalIndex,
            $dto->expectedSyncId
        );
        if ($result === null) {
            return ['result' => 'original_unavailable'];
        }
        $message = $result->message;
        if ($result->changed) {
            $this->eventDispatcher->dispatch(new MessageQueueUpdatedEvent($message, $topic, $authorization->getId(), $authorization->getOrganizationCode()));
            $this->messageQueueProcessAppService->processTopicMessageQueue($topic->getId());
        }
        return ['result' => 'accepted', 'queue_id' => (string) $message->getId(), 'status' => $message->getStatus()->value];
    }

    public function moveMessage(RequestContext $requestContext, int $messageId, MoveMessageQueueRequestDTO $dto): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $isolation = $this->createDataIsolation($authorization);
        $existing = $this->messageQueueDomainService->getMessageForUser($messageId, $authorization->getId());
        $topic = $this->validateQueueScope($isolation, $existing->getProjectId(), $existing->getTopicId());
        $message = $this->messageQueueDomainService->moveMessage(
            $isolation,
            $messageId,
            $dto->beforeId === null ? null : (int) $dto->beforeId,
            $dto->afterId === null ? null : (int) $dto->afterId
        );
        $this->eventDispatcher->dispatch(new MessageQueueUpdatedEvent($message, $topic, $authorization->getId(), $authorization->getOrganizationCode()));
        return ['queue_id' => (string) $message->getId(), 'sort_order' => (string) $message->getSortOrder()];
    }

    public function getMessageQueueEntity(int $queueId, string $userId): ?MessageQueueEntity
    {
        return $this->messageQueueDomainService->getMessageForUser($queueId, $userId);
    }

    private function validateQueueScope(DataIsolation $isolation, int $projectId, int $topicId): TopicEntity
    {
        $topic = $this->topicDomainService->validateTopicForMessageQueue($isolation, $topicId);
        // 队列沿用话题归属鉴权；项目存在和归属一致不等于要求操作者是项目创建人。
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if ($topic->getProjectId() !== $projectId
            || $topic->getUserOrganizationCode() !== $isolation->getCurrentOrganizationCode()
            || $project->getUserOrganizationCode() !== $isolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.topic_access_denied');
        }
        return $topic;
    }
}
