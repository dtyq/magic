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
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\SuperAgentTool;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\SuperAgentMessage;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Client Message Application Service
 * Responsible for building messages and pushing them to clients.
 */
class ClientMessageAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly MagicChatMessageAppService $chatMessageAppService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Send SuperAgent message to client
     * Directly use SuperAgentMessage object to reduce parameter conversion.
     */
    public function sendSuperAgentMessage(
        SuperAgentMessage $message,
        string $chatTopicId,
        string $chatConversationId
    ): void {
        try {
            $this->doSendMessage($message, $chatTopicId, $chatConversationId);

            $this->logger->info(sprintf(
                'SuperAgent message sent to client, Task ID: %s, Message type: %s',
                $message->getTaskId(),
                $message->getType()
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to send SuperAgent message to client: %s, Task ID: %s',
                $e->getMessage(),
                $message->getTaskId()
            ));
            // Do not throw exception to avoid affecting main process
        }
    }

    /**
     * Send normal message to client
     * Build message using basic parameters.
     */
    public function sendMessageToClient(
        int $messageId,
        int $topicId,
        string $taskId,
        string $chatTopicId,
        string $chatConversationId,
        string $content,
        string $messageType,
        string $status,
        string $event = '',
        array $steps = [],
        ?array $tool = null,
        ?array $attachments = null,
        ?string $correlationId = null,
        ?array $usage = null,
    ): string {
        try {
            $message = $this->createSuperAgentMessage(
                $messageId,
                $topicId,
                $taskId,
                $content,
                $messageType,
                $status,
                $event,
                $steps,
                $tool,
                $attachments,
                $correlationId,
                $usage
            );

            $seqId = $this->doSendMessage($message, $chatTopicId, $chatConversationId);

            $this->logger->info(sprintf(
                'Normal message sent to client, Task ID: %s, Message type: %s',
                $taskId,
                $messageType
            ));
            return $seqId;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to send message to client: %s, Task ID: %s',
                $e->getMessage(),
                $taskId
            ));
            // Do not throw exception to avoid affecting main process
            return '';
        }
    }

    /**
     * Send error message to client
     * Simplified error message sending interface.
     */
    public function sendErrorMessageToClient(
        int $topicId,
        string $taskId,
        string $chatTopicId,
        string $chatConversationId,
        string $errorMessage
    ): void {
        try {
            $messageId = IdGenerator::getSnowId();
            $message = $this->createSuperAgentMessage(
                $messageId,
                $topicId,
                $taskId,
                $errorMessage,
                MessageType::Error->value,
                TaskStatus::ERROR->value,
                '',
                [],
                null,
                null
            );

            $this->doSendMessage($message, $chatTopicId, $chatConversationId);

            $this->logger->info(sprintf(
                'Error message sent to client, Task ID: %s, Error: %s',
                $taskId,
                $errorMessage
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to send error message to client: %s, Task ID: %s',
                $e->getMessage(),
                $taskId
            ));
        }
    }

    /**
     * Send interrupt message to client
     * Reference TaskAppService interrupt logic, send task interrupt notification.
     */
    public function sendInterruptMessageToClient(
        int $topicId,
        string $taskId,
        string $chatTopicId,
        string $chatConversationId,
        string $interruptReason = 'Task terminated'
    ): void {
        try {
            $messageId = IdGenerator::getSnowId();
            $message = $this->createSuperAgentMessage(
                $messageId,
                $topicId,
                $taskId,
                $interruptReason,
                MessageType::Finished->value,
                TaskStatus::Suspended->value,
                '',
                [],
                null,
                null
            );

            $this->doSendMessage($message, $chatTopicId, $chatConversationId);

            $this->logger->info(sprintf(
                'Interrupt message sent to client, Task ID: %s, Reason: %s',
                $taskId,
                $interruptReason
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to send interrupt message to client: %s, Task ID: %s',
                $e->getMessage(),
                $taskId
            ));
        }
    }

    public function sendReminderMessageToClient(
        int $topicId,
        string $taskId,
        string $chatTopicId,
        string $chatConversationId,
        string $remind = '',
        string $remindEvent = ''
    ): void {
        try {
            $messageId = IdGenerator::getSnowId();
            $message = $this->createSuperAgentMessage(
                $messageId,
                $topicId,
                $taskId,
                $remind,
                MessageType::Reminder->value,
                TaskStatus::Suspended->value,
                $remindEvent,
                [],
                null,
                null
            );

            $this->doSendMessage($message, $chatTopicId, $chatConversationId);

            $this->logger->info(sprintf(
                'Reminder message sent to client, Task ID: %s, Reminder Reason: %s , Event: %s',
                $taskId,
                $remind,
                $remindEvent
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to send Reminder message to client: %s, Task ID: %s',
                $e->getMessage(),
                $taskId
            ));
        }
    }

    /**
     * @return string seq_id
     */
    private function doSendMessage(
        SuperAgentMessage $message,
        string $chatTopicId,
        string $chatConversationId
    ): string {
        // Create sequence entity
        $seqDTO = new MagicSeqEntity();
        $seqDTO->setObjectType(ConversationType::Ai);
        $seqDTO->setContent($message);
        $seqDTO->setSeqType(ChatMessageType::SuperAgentCard);

        $extra = new SeqExtra();
        $extra->setTopicId($chatTopicId);
        $seqDTO->setExtra($extra);
        $seqDTO->setConversationId($chatConversationId);

        $this->logger->info('[Send to Client] Sending message to client: ' . json_encode($message->toArray(), JSON_UNESCAPED_UNICODE));

        // Check for duplicate messages to avoid re-sending
        $appMessageId = $message->getMessageId();
        if ($this->chatMessageAppService->isMessageAlreadySent($appMessageId, ChatMessageType::SuperAgentCard->value)) {
            $this->logger->info(sprintf(
                'Duplicate message detected, skipping send - App Message ID: %s, Task ID: %s',
                $appMessageId,
                $message->getTaskId()
            ));
            return ''; // Skip sending if message already exists
        }

        // Send message
        try {
            $data = $this->chatMessageAppService->aiSendMessage($seqDTO, $message->getMessageId());
            return $data['seq']['seq_id'] ?? '';
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to send message to client: %s, Task ID: %s',
                $e->getMessage(),
                $message->getTaskId()
            ));
            return '';
        }
    }

    /**
     * Create general agent message
     * Private method migrated from MessageBuilderDomainService::createSuperAgentMessage.
     */
    private function createSuperAgentMessage(
        int $messageId,
        int $topicId,
        string $taskId,
        ?string $content,
        string $messageType,
        string $status,
        string $event,
        ?array $steps = null,
        ?array $tool = null,
        ?array $attachments = null,
        ?string $correlationId = null,
        ?array $usage = null,
    ): SuperAgentMessage {
        $message = new SuperAgentMessage();
        $message->setMessageId((string) $messageId);
        $message->setTopicId((string) $topicId);
        $message->setTaskId($taskId);
        $message->setType($messageType);
        $message->setStatus($status);
        $message->setEvent($event);
        $message->setRole('assistant');
        $message->setAttachments($attachments);
        if ($content !== null) {
            $message->setContent($content);
        } else {
            $message->setContent('');
        }

        if ($tool !== null) {
            $toolObj = new SuperAgentTool([
                'id' => $tool['id'] ?? '',
                'name' => $tool['name'] ?? '',
                'action' => $tool['action'] ?? '',
                'status' => $tool['status'] ?? 'running',
                'remark' => $tool['remark'] ?? '',
                'detail' => $tool['detail'] ?? [],
                'attachments' => $tool['attachments'] ?? null,
            ]);
            $message->setTool($toolObj);
        }

        if ($steps !== null) {
            $message->setSteps($steps);
        }

        if ($correlationId !== null) {
            $message->setCorrelationId($correlationId);
        }

        if ($usage !== null) {
            $message->setUsage($usage);
        }

        return $message;
    }
}
