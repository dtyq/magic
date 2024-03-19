<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Transport;

use App\Infrastructure\Core\MCP\Server\Handler\MCPHandler;
use App\Infrastructure\Core\MCP\Types\Message\MessageInterface;

interface TransportInterface
{
    public function register(string $path, string $serverName, MCPHandler $handler): void;

    public function handle(string $serverName, string $sessionId, MessageInterface $message, bool $broadcast = true): void;

    public function readMessage(): MessageInterface;
}
