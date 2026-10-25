<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Event\Subscribe;

use App\Application\SuperMagic\Message\DTO\TaskInitializationMessageDTO;
use App\Application\SuperMagic\Message\DTO\UserMessageDTO;
use App\Application\SuperMagic\Message\Service\ClientMessageAppService;
use App\Application\SuperMagic\Message\Service\HandleUserMessageAppService;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\SuperMagic\Utils\TaskEventUtil;
use App\Infrastructure\SuperMagic\Utils\TaskTerminationUtil;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Task initialization consumer with interrupt support at any time.
 *
 * Thin consumer: it reconstructs the DataIsolation and UserMessageDTO from the queue
 * payload and delegates to the unified HandleUserMessageAppService::handleChatMessage,
 * passing the already-created task id so task creation / user message persistence are
 * skipped. All redundant sandbox initialization logic now lives in the core service.
 */
#[Consumer(
    exchange: 'super-magic',
    routingKey: 'task.initialization',
    queue: 'task.initialization',
    nums: 1
)]
class TaskInitializationConsumer extends ConsumerMessage
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly HandleUserMessageAppService $handleUserMessageAppService,
        private readonly ClientMessageAppService $clientMessageAppService,
        private readonly MagicConversationDomainService $magicConversationDomainService,
        private readonly Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    public function consumeMessage($data, AMQPMessage $message): Result
    {
        $messageDTO = null;
        try {
            $this->logger->info('Received task initialization message', [
                'data' => $data,
            ]);

            // Parse message DTO
            $messageDTO = TaskInitializationMessageDTO::fromArray($data);

            // [Checkpoint 1] Check termination flag first (support interrupt at any time)
            if (TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $messageDTO->getTaskId())) {
                $this->logger->info('[Checkpoint 1] Task already terminated, skip processing', [
                    'task_id' => $messageDTO->getTaskId(),
                ]);
                return Result::ACK;
            }

            // Rebuild data isolation
            $dataIsolation = DataIsolation::create(
                $messageDTO->getOrganizationCode(),
                $messageDTO->getUserId()
            );
            $dataIsolation->setLanguage($messageDTO->getLanguage());

            // Rebuild UserMessageDTO from the serialized payload. Resolve the agent
            // conversation id here when the producer did not carry it (chatConversationId
            // is readonly, so inject it into the array before reconstructing).
            $userMessageArray = $messageDTO->getUserMessage();
            if (($userMessageArray['chat_conversation_id'] ?? '') === '') {
                $agentConversationId = $this->getAgentConversationId($dataIsolation, $messageDTO->getAgentUserId());
                if ($agentConversationId !== '') {
                    $userMessageArray['chat_conversation_id'] = $agentConversationId;
                }
            }
            $userMessageDTO = UserMessageDTO::fromArray($userMessageArray);

            // Reuse the unified core: task already created and user message already persisted,
            // so pass the task id to skip task creation / message persistence.
            $this->handleUserMessageAppService->handleMessage(
                $dataIsolation,
                $userMessageDTO,
                existingTaskId: $messageDTO->getTaskId()
            );

            $this->logger->info('Task initialization completed', [
                'task_id' => $messageDTO->getTaskId(),
            ]);

            return Result::ACK;
        } catch (EventException $e) {
            $this->logger->warning('Task initialization event processing failed', [
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);

            if ($messageDTO !== null) {
                $this->sendReminderNotificationToClient($messageDTO, $e);
            }

            return Result::ACK;
        } catch (BusinessException $e) {
            $this->logger->warning('Task initialization business processing failed', [
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);

            if ($messageDTO !== null) {
                $this->sendErrorNotificationToClient($messageDTO, $e->getMessage());
            }

            return Result::ACK;
        } catch (Throwable $e) {
            $this->logger->error('Failed to process task initialization message', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Send error message to client if we have the necessary information
            if ($messageDTO !== null) {
                $this->sendErrorNotificationToClient($messageDTO);
            }

            // Return ACK to avoid infinite retry
            return Result::ACK;
        }
    }

    /**
     * Send error notification to client when initialization fails.
     */
    private function sendErrorNotificationToClient(
        TaskInitializationMessageDTO $messageDTO,
        string $errorMessage = ''
    ): void {
        try {
            // Only send notification if we have chat topic ID and agent user ID
            if (empty($messageDTO->getChatTopicId()) || empty($messageDTO->getAgentUserId())) {
                $this->logger->warning('Cannot send error notification: missing required IDs', [
                    'task_id' => $messageDTO->getTaskId(),
                    'chat_topic_id' => $messageDTO->getChatTopicId(),
                    'agent_user_id' => $messageDTO->getAgentUserId(),
                ]);
                return;
            }

            // Create data isolation for query
            $dataIsolation = DataIsolation::create(
                $messageDTO->getOrganizationCode(),
                $messageDTO->getUserId()
            );

            // Get AI Agent's conversation ID using unique index
            $agentConversationId = $this->getAgentConversationId(
                $dataIsolation,
                $messageDTO->getAgentUserId()
            );

            if (empty($agentConversationId)) {
                $this->logger->warning('Cannot send error notification: agent conversation not found', [
                    'task_id' => $messageDTO->getTaskId(),
                ]);
                return;
            }

            $this->clientMessageAppService->sendErrorMessageToClient(
                topicId: $messageDTO->getTopicId(),
                taskId: (string) $messageDTO->getTaskId(),
                chatTopicId: $messageDTO->getChatTopicId(),
                chatConversationId: $agentConversationId,
                errorMessage: trim($errorMessage) !== '' ? $errorMessage : trans('task.initialize_error'), // @phpstan-ignore-line function.notFound
                dynamicParams: $messageDTO->getUserMessage()['dynamic_params'] ?? null,
            );

            $this->logger->info('Error notification sent to client', [
                'task_id' => $messageDTO->getTaskId(),
                'chat_topic_id' => $messageDTO->getChatTopicId(),
            ]);
        } catch (Throwable $notificationError) {
            $this->logger->error('Failed to send error notification to client', [
                'task_id' => $messageDTO->getTaskId(),
                'error' => $notificationError->getMessage(),
            ]);
        }
    }

    /**
     * Send reminder notification to client for event-level failures.
     */
    private function sendReminderNotificationToClient(
        TaskInitializationMessageDTO $messageDTO,
        EventException $exception
    ): void {
        try {
            if (empty($messageDTO->getChatTopicId()) || empty($messageDTO->getAgentUserId())) {
                $this->logger->warning('Cannot send reminder notification: missing required IDs', [
                    'task_id' => $messageDTO->getTaskId(),
                    'chat_topic_id' => $messageDTO->getChatTopicId(),
                    'agent_user_id' => $messageDTO->getAgentUserId(),
                ]);
                return;
            }

            $dataIsolation = DataIsolation::create(
                $messageDTO->getOrganizationCode(),
                $messageDTO->getUserId()
            );
            $agentConversationId = $this->getAgentConversationId(
                $dataIsolation,
                $messageDTO->getAgentUserId()
            );
            if (empty($agentConversationId)) {
                $this->logger->warning('Cannot send reminder notification: agent conversation not found', [
                    'task_id' => $messageDTO->getTaskId(),
                ]);
                return;
            }

            $this->clientMessageAppService->sendReminderMessageToClient(
                topicId: $messageDTO->getTopicId(),
                taskId: (string) $messageDTO->getTaskId(),
                chatTopicId: $messageDTO->getChatTopicId(),
                chatConversationId: $agentConversationId,
                remind: $exception->getMessage(),
                remindEvent: TaskEventUtil::getRemindTaskEventByCode($exception->getCode()),
                data: $exception->getData(),
            );
        } catch (Throwable $notificationError) {
            $this->logger->error('Failed to send reminder notification to client', [
                'task_id' => $messageDTO->getTaskId(),
                'error' => $notificationError->getMessage(),
            ]);
        }
    }

    /**
     * Get AI Agent's conversation ID using unique index for optimal query performance.
     *
     * This constructs a query that uses the unique index:
     * (user_id, receive_id, receive_type, user_organization_code, receive_organization_code)
     *
     * @param DataIsolation $dataIsolation Contains organization code and human user ID
     * @param string $agentUserId AI Agent's user ID
     * @return string The conversation ID for AI Agent's conversation window
     */
    private function getAgentConversationId(DataIsolation $dataIsolation, string $agentUserId): string
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $humanUserId = $dataIsolation->getCurrentUserId();

        // Build conversation entity with all unique index fields
        $conversationDTO = new MagicConversationEntity();
        $conversationDTO->setUserId($agentUserId);                          // AI Agent as owner
        $conversationDTO->setReceiveId($humanUserId);                       // Human user as receiver
        $conversationDTO->setReceiveType(ConversationType::User);           // AI sends to human = User type
        $conversationDTO->setUserOrganizationCode($organizationCode);       // Same organization
        $conversationDTO->setReceiveOrganizationCode($organizationCode);    // Same organization

        // Query using unique index for optimal performance
        $conversationEntity = $this->magicConversationDomainService->getConversationByUserIdAndReceiveId($conversationDTO);

        if ($conversationEntity === null) {
            $this->logger->error('Agent conversation not found', [
                'agent_user_id' => $agentUserId,
                'human_user_id' => $humanUserId,
                'organization_code' => $organizationCode,
            ]);
            return '';
        }

        return $conversationEntity->getId();
    }
}
