<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ChatCompletionsDTO extends AbstractDTO
{
    protected ?string $conversationId = null;

    protected string $message;

    // 如果不在会话中，支持外部传入历史消息
    protected array $history;

    protected string $topicId = '';

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): void
    {
        $this->topicId = $topicId;
    }

    public function getConversationId(): ?string
    {
        return $this->conversationId;
    }

    public function setConversationId(?string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function setMessage(string $message): void
    {
        $this->message = $message;
    }

    public function getHistory(): array
    {
        return $this->history;
    }

    public function setHistory(array $history): void
    {
        $this->history = $history;
    }
}
