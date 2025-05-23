<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Transport\SSE;

use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

readonly class BroadcastPayload
{
    public function __construct(
        private string $serverName,
        private string $sessionId,
        private MessageInterface $message,
    ) {
    }

    public function getServerName(): string
    {
        return $this->serverName;
    }

    public function getSessionId(): string
    {
        return $this->sessionId;
    }

    public function getMessage(): MessageInterface
    {
        return $this->message;
    }
}
