<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Message\Assembler;

use App\Application\SuperMagic\Message\DTO\UserMessageDTO;
use App\Domain\Chat\DTO\Message\ChatMessage\RichTextMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\UserToolCallMessage;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\MessageExtra;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\SuperAgentExtra;
use App\Domain\Chat\DTO\Message\MagicMessageStruct;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\SuperMagic\Common\Entity\ValueObject\SuperMagicExecutionSource;
use App\Domain\SuperMagic\Message\Entity\ValueObject\ChatInstruction;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskMode;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use InvalidArgumentException;

/**
 * Assembles UserMessageDTO from parsed chat message content.
 * Shared message parsing and classification for HTTP and WebSocket transports.
 * Transport identities remain caller-owned; execution uses the same UserMessageDTO.
 */
class UserMessageDTOAssembler
{
    /**
     * Build a UserMessageDTO from an already validated/parsed message content struct.
     *
     * @param TextContentInterface $contentStruct Parsed message content (MagicMessageStruct)
     * @param TopicEntity $topicEntity Target topic entity
     * @param string $agentUserId Receiver agent user id
     * @param string $messageType Chat message type (e.g. rich_text)
     * @param string $messageId Business message id (used for dedup / persistence linkage)
     * @param string $messageSeqId IM seq id of the persisted user message
     * @param string $language Current request language
     * @param SuperMagicExecutionSource $executionSource Execution source used to stamp dynamic params
     * @param string $chatConversationId Agent conversation id (may be resolved later by the consumer)
     */
    public static function fromMessageContentStruct(
        TextContentInterface $contentStruct,
        TopicEntity $topicEntity,
        string $agentUserId,
        string $messageType,
        string $messageId,
        string $messageSeqId,
        string $language,
        SuperMagicExecutionSource $executionSource,
        string $chatConversationId = '',
        ?array $messageSubscriptionConfig = null
    ): UserMessageDTO {
        if (! $contentStruct instanceof MagicMessageStruct) {
            throw new InvalidArgumentException('Unsupported message content');
        }
        return self::fromParsedMessage(self::parseMessageContent($contentStruct, $executionSource), [
            'agent_user_id' => $agentUserId,
            'chat_conversation_id' => $chatConversationId,
            'chat_topic_id' => $topicEntity->getChatTopicId(),
            'topic_id' => $topicEntity->getId(),
            'message_id' => $messageId,
            'message_seq_id' => $messageSeqId,
            'chat_message_type' => $messageType,
            'language' => $language,
            'message_subscription_config' => $messageSubscriptionConfig,
        ]);
    }

    public static function prepareMessageContent(MagicMessageStruct $message): void
    {
        if (! $message instanceof RichTextMessage) {
            return;
        }
        $nodes = $message->extractMentionNodes();
        if ($nodes === []) {
            return;
        }
        $messageExtra = $message->getExtra() ?? new MessageExtra();
        $superAgentExtra = $messageExtra->getSuperAgent() ?? new SuperAgentExtra();
        $superAgentExtra->fillMentionsFromTiptapNodesIfEmpty($nodes);
        $messageExtra->setSuperAgent($superAgentExtra);
        $message->setExtra($messageExtra);
    }

    public static function parseMessageContent(MagicMessageStruct $message, SuperMagicExecutionSource $executionSource): array
    {
        self::prepareMessageContent($message);
        $extra = $message->getExtra()?->getSuperAgent();
        [$instruction, $taskMode] = self::parseInstructions($message->getInstructs() ?? []);
        $attachments = $message instanceof TextContentInterface ? ($message->getAttachments() ?? []) : [];
        $mentions = $extra?->getMentionsJsonStruct();
        return [
            'prompt' => $message instanceof TextContentInterface ? $message->getTextContent() : '',
            'attachments' => $attachments === [] ? '' : json_encode($attachments, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'mentions' => empty($mentions) ? null : json_encode($mentions, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'instruction' => $instruction->value,
            'task_mode' => $taskMode,
            'topic_mode' => $extra?->getTopicPattern() ?? 'general',
            'model_id' => $extra?->getModelId() ?? '',
            'queue_id' => $extra?->getQueueId() ?? '',
            'dynamic_params' => SuperMagicExecutionSource::ensureDynamicParams($extra?->getDynamicParams(), $executionSource),
            'extra' => $extra?->toArray(),
        ];
    }

    public static function fromParsedMessage(array $fields, array $context): UserMessageDTO
    {
        $allowedContext = array_flip([
            'agent_user_id', 'chat_conversation_id', 'chat_topic_id', 'topic_id',
            'message_id', 'message_seq_id', 'chat_message_type', 'language',
            'raw_content', 'message_subscription_config',
        ]);
        if (array_diff_key($context, $allowedContext) !== []) {
            throw new InvalidArgumentException('Unexpected message context field');
        }
        return UserMessageDTO::fromArray(array_merge($context, $fields));
    }

    /** @return array{ChatInstruction, string} */
    public static function parseInstructions(array $instructions): array
    {
        $chatInstruction = ChatInstruction::Normal;
        $taskMode = '';
        foreach ($instructions as $instruction) {
            $value = $instruction['value'] ?? '';
            $parsedInstruction = ChatInstruction::tryFrom($value);
            if ($parsedInstruction !== null) {
                $chatInstruction = $parsedInstruction;
                continue;
            }
            $parsedTaskMode = TaskMode::tryFrom($value);
            if ($parsedTaskMode !== null) {
                $taskMode = $parsedTaskMode->value;
                break;
            }
        }
        return [$chatInstruction, $taskMode];
    }

    public static function resolveUserToolCallMessage(?MagicMessageStruct $message, ?array $dynamicParams): ?UserToolCallMessage
    {
        if ($message instanceof UserToolCallMessage) {
            return $message;
        }
        $reply = $dynamicParams['tool_reply'] ?? null;
        if (! is_array($reply) || empty($reply['name'])) {
            return null;
        }
        $detail = is_array($reply['detail'] ?? null) ? $reply['detail'] : [];
        return (new UserToolCallMessage())
            ->setName((string) $reply['name'])
            ->setToolCallId((string) ($detail['question_id'] ?? ''))
            ->setDetail(array_diff_key($detail, array_flip(['question_id', 'task_id'])));
    }

    public static function classifyMessage(ChatInstruction $instruction, ?UserToolCallMessage $toolReply): string
    {
        if ($toolReply !== null) {
            return 'tool_reply';
        }
        return $instruction === ChatInstruction::Interrupted ? 'interrupt' : 'chat';
    }

    public static function assertTaskCreationMessage(MagicMessageStruct $message, array $fields): void
    {
        $rawReply = $fields['dynamic_params']['tool_reply'] ?? null;
        if ($rawReply !== null && $rawReply !== []
            && (! is_array($rawReply) || ! is_string($rawReply['name'] ?? null) || $rawReply['name'] === '')) {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'task.open_api.invalid_tool_reply');
        }
        $toolReply = self::resolveUserToolCallMessage($message, $fields['dynamic_params']);
        if (self::classifyMessage(ChatInstruction::from($fields['instruction']), $toolReply) !== 'chat') {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'task.open_api.create_messages_only');
        }
    }
}
