<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Server\Transport\SSE;

use App\Infrastructure\Core\MCP\Server\Handler\MCPHandler;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

use function Hyperf\Coroutine\co;

class ConnectionManager
{
    /**
     * @var array<string, array<string, SSEStream>>
     */
    private array $connections = [];

    /**
     * @var array<string, array<string, MCPHandler>>
     */
    private array $handlers = [];

    /**
     * @var array<string, array<string, int>>
     */
    private array $lastActiveTime = [];

    private int $timeout = 600;

    private LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get('ConnectionManager');
    }

    public function exist(string $serverName, string $sessionId): bool
    {
        $connection = $this->connections[$serverName][$sessionId] ?? null;
        $handler = $this->handlers[$serverName][$sessionId] ?? null;
        if ($connection instanceof SSEStream && $handler instanceof MCPHandler) {
            return true;
        }

        $this->removeConnection($serverName, $sessionId);
        return false;
    }

    public function registerConnection(string $serverName, string $sessionId, SSEStream $connection, MCPHandler $MCPHandler): void
    {
        co(function () {
            $this->cleanupIdleConnections();
        });

        $this->connections[$serverName][$sessionId] = $connection;
        $this->handlers[$serverName][$sessionId] = $MCPHandler;
        $this->lastActiveTime[$serverName][$sessionId] = time();

        $this->logger->info('ConnectionRegistered', [
            'server_name' => $serverName,
            'session_id' => $sessionId,
        ]);
    }

    public function removeConnection(string $serverName, string $sessionId): void
    {
        $connection = $this->getConnection($serverName, $sessionId);
        $connection?->end();
        unset($this->connections[$serverName][$sessionId], $this->handlers[$serverName][$sessionId], $this->lastActiveTime[$serverName][$sessionId]);

        $this->logger->debug('ConnectionRemoved', [
            'server_name' => $serverName,
            'session_id' => $sessionId,
        ]);
    }

    public function getConnection(string $serverName, string $sessionId): ?SSEStream
    {
        if (! isset($this->connections[$serverName][$sessionId])) {
            return null;
        }

        return $this->connections[$serverName][$sessionId] ?? null;
    }

    public function getHandler(string $serverName, string $sessionId): ?MCPHandler
    {
        if (! isset($this->handlers[$serverName][$sessionId])) {
            return null;
        }

        return $this->handlers[$serverName][$sessionId];
    }

    protected function cleanupIdleConnections(): void
    {
        $now = time();
        foreach ($this->connections as $serverName => $connections) {
            foreach ($connections as $sessionId => $connection) {
                $lastActive = $this->lastActiveTime[$serverName][$sessionId] ?? 0;
                if ($now - $lastActive > $this->timeout) {
                    $this->removeConnection($serverName, $sessionId);
                    $this->logger->info('IdleConnectionRemoved', [
                        'server_name' => $serverName,
                        'session_id' => $sessionId,
                        'idle_time' => $now - $lastActive,
                    ]);
                }
            }
        }
    }
}
