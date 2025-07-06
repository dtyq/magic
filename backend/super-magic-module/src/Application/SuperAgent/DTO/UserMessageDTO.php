<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ChatInstruction;

/**
 * User message DTO for initializing agent task.
 */
class UserMessageDTO
{
    public function __construct(
        private readonly string $agentUserId,
        private readonly string $chatConversationId,
        private readonly string $chatTopicId,
        private readonly string $prompt,
        private readonly ?string $attachments = null,
        private readonly ?string $mentions = null,
        private readonly ChatInstruction $instruction = ChatInstruction::Normal,
        // $taskMode 即将废弃，请勿使用
        private readonly string $taskMode = ''
    ) {
    }

    public function getAgentUserId(): string
    {
        return $this->agentUserId;
    }

    public function getChatConversationId(): string
    {
        return $this->chatConversationId;
    }

    public function getChatTopicId(): string
    {
        return $this->chatTopicId;
    }

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function getAttachments(): ?string
    {
        return $this->attachments;
    }

    public function getMentions(): ?string
    {
        return $this->mentions ?? null;
    }

    public function getInstruction(): ChatInstruction
    {
        return $this->instruction;
    }

    public function getTaskMode(): string
    {
        return $this->taskMode;
    }

    /**
     * Create DTO from array.
     */
    public static function fromArray(array $data): self
    {
        return new self(
            agentUserId: $data['agent_user_id'] ?? $data['agentUserId'] ?? '',
            chatConversationId: $data['chat_conversation_id'] ?? $data['chatConversationId'] ?? '',
            chatTopicId: $data['chat_topic_id'] ?? $data['chatTopicId'] ?? '',
            prompt: $data['prompt'] ?? '',
            attachments: $data['attachments'] ?? null,
            mentions: $data['mentions'] ?? null,
            instruction: isset($data['instruction'])
                ? ChatInstruction::tryFrom($data['instruction']) ?? ChatInstruction::Normal
                : ChatInstruction::Normal,
            taskMode: $data['task_mode'] ?? $data['taskMode'] ?? ''
        );
    }

    /**
     * Convert DTO to array.
     */
    public function toArray(): array
    {
        return [
            'agent_user_id' => $this->agentUserId,
            'chat_conversation_id' => $this->chatConversationId,
            'chat_topic_id' => $this->chatTopicId,
            'prompt' => $this->prompt,
            'attachments' => $this->attachments,
            'mentions' => $this->mentions,
            'instruction' => $this->instruction->value,
            'task_mode' => $this->taskMode,
        ];
    }
}
