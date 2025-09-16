<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item\SuperAgentTool;
use Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\SuperAgentMessage;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;

/**
 * Message Builder Service - Focused on building various message formats.
 */
class MessageBuilderDomainService
{
    /**
     * Build initialization message.
     *
     * @param string $userId User ID
     * @param array $uploadCredential Upload credential
     * @param MessageMetadata $metaData Metadata or metadata object
     * @param bool $isFirstTaskMessage Whether it's the first task message
     * @param null|array $sandboxConfig Sandbox configuration
     * @param string $taskMode Task mode
     * @return array Built message
     */
    public function buildInitMessage(
        string $userId,
        array $uploadCredential,
        MessageMetadata $metaData,
        bool $isFirstTaskMessage,
        ?array $sandboxConfig,
        string $taskMode = 'chat'
    ): array {
        // Process metadata
        $metaDataArray = $metaData->toArray();

        return [
            'message_id' => (string) IdGenerator::getSnowId(),
            'user_id' => $userId,
            'type' => MessageType::Init->value,
            'fetch_workdir' => ! $isFirstTaskMessage, // As long as it's not the first creation, initialization will fetch the sandbox
            'upload_config' => $uploadCredential,
            'message_subscription_config' => [
                'method' => 'POST',
                'url' => config('super-magic.sandbox.callback_host', '') . '/api/v1/super-agent/tasks/deliver-message',
                'headers' => [
                    'token' => config('super-magic.sandbox.token', ''),
                ],
            ],
            'sts_token_refresh' => [
                'method' => 'POST',
                'url' => config('super-magic.sandbox.callback_host', '') . '/api/v1/super-agent/file/refresh-sts-token',
                'headers' => [
                    'token' => config('super-magic.sandbox.token', ''),
                ],
            ],
            'metadata' => $metaDataArray,
            'project_archive' => $sandboxConfig,
            'task_mode' => $taskMode,
            'magic_service_host' => config('super-magic.sandbox.callback_host', ''),
        ];
    }

    /**
     * Build chat message.
     *
     * @param string $userId User ID
     * @param int $taskId Task ID
     * @param string $contextType Context type
     * @param string $prompt User prompt
     * @param array $attachmentUrls Attachment URL list
     * @param string $taskMode Task mode
     * @return array Built message
     */
    public function buildChatMessage(
        string $userId,
        int $taskId,
        string $contextType,
        string $prompt,
        array $attachmentUrls = [],
        string $taskMode = 'chat'
    ): array {
        return [
            'message_id' => (string) IdGenerator::getSnowId(),
            'user_id' => $userId,
            'task_id' => (string) $taskId,
            'type' => MessageType::Chat->value,
            'context_type' => $contextType,
            'prompt' => $prompt,
            'attachments' => $attachmentUrls,
            'task_mode' => $taskMode,
        ];
    }

    public function buildContinueMessage(string $userId, string $taskId): array
    {
        return [
            'message_id' => (string) IdGenerator::getSnowId(),
            'user_id' => $userId,
            'task_id' => $taskId,
            'type' => MessageType::Chat->value,
            'context_type' => ChatInstruction::FollowUp,
            'prompt' => 'Continue',
            'attachments' => [],
            'task_mode' => 'chat',
        ];
    }

    public function buildInterruptMessage(string $userId, int $taskId, string $taskMode = 'chat', string $remark = '')
    {
        return [
            'message_id' => (string) IdGenerator::getSnowId(),
            'user_id' => $userId,
            'task_id' => (string) $taskId,
            'type' => MessageType::Chat->value,
            'context_type' => ChatInstruction::Interrupted->value,
            'prompt' => '',
            'attachments' => [],
            'task_mode' => $taskMode,
            'remark' => $remark,
        ];
    }

    /**
     * Create super agent message.
     */
    public function createSuperAgentMessage(
        int $topicId,
        string $taskId,
        ?string $content,
        string $messageType,
        string $status,
        string $event,
        ?array $steps = null,
        ?array $tool = null,
        ?array $attachments = null,
        ?string $correlationId = null
    ): SuperAgentMessage {
        $message = new SuperAgentMessage();
        $message->setMessageId((string) IdGenerator::getSnowId());
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

        return $message;
    }
}
