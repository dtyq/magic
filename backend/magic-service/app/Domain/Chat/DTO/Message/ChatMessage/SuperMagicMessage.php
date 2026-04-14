<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\MagicMessageStruct;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

class SuperMagicMessage extends MagicMessageStruct implements MessageInterface
{
    protected ?string $topicId = null;

    protected ?string $taskId = null;

    protected string $role;

    protected ?string $reasoningContent = null;

    protected ?string $content = null;

    protected ?array $toolCalls = null;

    protected ?string $toolCallId = null;

    protected ?string $name = null;

    protected ?array $tool = null;

    protected ?string $correlationId = null;

    protected ?string $status = null;

    /**
     * 附件信息。
     */
    protected ?array $attachments = null;

    protected ?array $usage = null;

    public function toArray(bool $filterNull = false): array
    {
        $data = [
            'task_id' => $this->taskId,
            'topic_id' => $this->topicId,
            'role' => $this->role,
            'reasoning_content' => $this->reasoningContent,
            'content' => $this->content,
            'tool_calls' => $this->toolCalls,
            'tool_call_id' => $this->toolCallId,
            'name' => $this->name,
            'tool' => $this->tool,
            'correlation_id' => $this->correlationId,
            'attachments' => $this->attachments,
            'usage' => $this->usage,
            'status' => $this->status,
        ];

        return $filterNull ? array_filter($data, fn ($value) => ! is_null($value)) : $data;
    }

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::SuperMagicMessage;
    }
}
