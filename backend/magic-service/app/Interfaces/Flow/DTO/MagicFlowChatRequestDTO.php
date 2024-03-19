<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO;

class MagicFlowChatRequestDTO extends AbstractFlowDTO
{
    public string $conversationId = '';

    public string $flowCode;

    public string $user = '';

    public string $message = '';

    public bool $stream = false;

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(?string $conversationId): void
    {
        $this->conversationId = $conversationId ?? '';
    }

    public function getFlowCode(): string
    {
        return $this->flowCode;
    }

    public function setFlowCode(?string $flowCode): void
    {
        $this->flowCode = $flowCode ?? '';
    }

    public function getUser(): string
    {
        return $this->user;
    }

    public function setUser(?string $user): void
    {
        $this->user = $user ?? '';
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function setMessage(?string $message): void
    {
        $this->message = $message ?? '';
    }

    public function isStream(): bool
    {
        return $this->stream;
    }

    public function setStream(?bool $stream): void
    {
        $this->stream = $stream ?? false;
    }
}
