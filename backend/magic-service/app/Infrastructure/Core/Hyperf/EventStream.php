<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Hyperf;

use Hyperf\Engine\Contract\Http\Writable;
use Psr\Http\Message\ResponseInterface;
use Swow\Http\Http;
use Swow\Psr7\Server\ServerConnection;

class EventStream
{
    public function __construct(protected Writable $connection, ?ResponseInterface $response = null)
    {
        $headers = [
            'Content-Type' => 'text/event-stream; charset=utf-8',
            //            'X-Accel-Buffering' => 'no',
            'Cache-Control' => 'no-cache',
            'Connection' => 'close',
        ];
        foreach ($response?->getHeaders() ?? [] as $name => $values) {
            $headers[$name] = implode(', ', $values);
        }

        /** @var ServerConnection $socket */
        $socket = $this->connection->getSocket();
        $socket->write([
            Http::packResponse(
                statusCode: 200,
                headers: $headers,
                protocolVersion: '1.1'
            ),
        ]);
    }

    public function write(string $data): self
    {
        /* @var ServerConnection $socket */
        $socket = $this->connection->getSocket();
        $socket->write([$data]);
        return $this;
    }

    public function end(): void
    {
    }

    public function close(): void
    {
        /** @var ServerConnection $socket */
        $socket = $this->connection->getSocket();
        $socket->close();
    }
}
