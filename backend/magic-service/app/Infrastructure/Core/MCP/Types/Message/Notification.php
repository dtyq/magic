<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Types\Message;

class Notification implements MessageInterface
{
    public function __construct(
        public string $jsonrpc,
        public string $method,
        public ?array $params = null
    ) {
    }

    public function getId(): int
    {
        return 0;
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function getJsonRpc(): string
    {
        return $this->jsonrpc;
    }

    public function getParams(): ?array
    {
        return $this->params;
    }
}
