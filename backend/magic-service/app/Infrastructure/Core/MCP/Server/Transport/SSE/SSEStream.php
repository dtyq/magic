<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Transport\SSE;

use Hyperf\Engine\Http\WritableConnection;
use Psr\Http\Message\ResponseInterface;
use Swow\Http\Http;

class SSEStream extends WritableConnection
{
    public function __construct(?ResponseInterface $response = null)
    {
        /* @phpstan-ignore-next-line */
        parent::__construct($response->getConnection()->getSocket());

        $headers = [
            'Content-Type' => 'text/event-stream; charset=utf-8',
            'Connection' => 'keep-alive',
            'Cache-Control' => 'no-cache',
        ];
        foreach ($response->getHeaders() ?? [] as $name => $values) {
            $headers[$name] = implode(', ', $values);
        }

        $this->getSocket()->write([
            Http::packResponse(
                statusCode: 200,
                headers: $headers,
                protocolVersion: '1.1'
            ),
        ]);
        $this->sent = true;
    }

    public function write(string $data): bool
    {
        $this->getSocket()->write([
            sprintf("%s\r\n", $data),
        ]);
        $this->sent = true;

        return true;
    }
}
