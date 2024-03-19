<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Types\Message;

use JsonSerializable;
use stdClass;
use Throwable;

class ErrorResponse implements MessageInterface, JsonSerializable
{
    public function __construct(
        public int $id,
        public string $jsonrpc,
        public Throwable $throwable
    ) {
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getMethod(): string
    {
        return '';
    }

    public function getJsonRpc(): string
    {
        return $this->jsonrpc;
    }

    public function getParams(): ?array
    {
        return null;
    }

    public function jsonSerialize(): array
    {
        return [
            'id' => $this->id,
            'jsonrpc' => $this->jsonrpc,
            'error' => [
                'code' => $this->throwable->getCode(),
                'message' => $this->throwable->getMessage(),
                'data' => new stdClass(),
            ],
        ];
    }
}
