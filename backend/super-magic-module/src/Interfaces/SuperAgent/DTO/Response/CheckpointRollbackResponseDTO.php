<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

class CheckpointRollbackResponseDTO
{
    protected string $sandboxId = '';
    protected string $targetMessageId = '';
    protected string $message = '';
    protected bool $success = false;

    /**
     * 构造函数.
     */
    public function __construct()
    {
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(string $sandboxId): void
    {
        $this->sandboxId = $sandboxId;
    }

    public function getTargetMessageId(): string
    {
        return $this->targetMessageId;
    }

    public function setTargetMessageId(string $targetMessageId): void
    {
        $this->targetMessageId = $targetMessageId;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function setMessage(string $message): void
    {
        $this->message = $message;
    }

    public function isSuccess(): bool
    {
        return $this->success;
    }

    public function setSuccess(bool $success): void
    {
        $this->success = $success;
    }

    public function toArray(): array
    {
        return [
            'sandbox_id' => $this->sandboxId,
            'target_message_id' => $this->targetMessageId,
            'message' => $this->message,
            'success' => $this->success,
        ];
    }
}
