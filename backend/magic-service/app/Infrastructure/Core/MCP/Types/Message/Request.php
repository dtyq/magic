<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Types\Message;

class Request implements MessageInterface
{
    public function __construct(
        public int $id,
        public string $jsonrpc,
        public string $method,
        public ?array $params = null
    ) {
    }

    public function getId(): int
    {
        return $this->id;
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
