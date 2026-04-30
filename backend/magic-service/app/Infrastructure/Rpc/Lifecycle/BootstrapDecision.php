<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

final readonly class BootstrapDecision
{
    private const string TYPE_REUSE_CONNECTION = 'reuse_connection';

    private const string TYPE_WAIT_FOR_EXISTING_SOCKET = 'wait_for_existing_socket';

    private const string TYPE_START_PROCESS = 'start_process';

    private const string TYPE_SKIP = 'skip';

    private function __construct(
        private string $type,
        private string $reason,
        private ?GoEngineStartRequest $startRequest = null,
    ) {
    }

    public static function reuseConnection(): self
    {
        return new self(self::TYPE_REUSE_CONNECTION, 'existing_rpc_connection_ready');
    }

    public static function waitForExistingSocket(): self
    {
        return new self(self::TYPE_WAIT_FOR_EXISTING_SOCKET, 'socket_exists_but_handshake_probe_failed');
    }

    public static function startProcess(GoEngineStartRequest $request): self
    {
        return new self(self::TYPE_START_PROCESS, 'start_new_go_engine_process', $request);
    }

    public static function skip(string $reason): self
    {
        return new self(self::TYPE_SKIP, $reason);
    }

    public function reason(): string
    {
        return $this->reason;
    }

    public function shouldWaitForReady(): bool
    {
        return $this->type === self::TYPE_WAIT_FOR_EXISTING_SOCKET || $this->type === self::TYPE_START_PROCESS;
    }

    public function shouldStartProcess(): bool
    {
        return $this->type === self::TYPE_START_PROCESS;
    }

    public function startRequest(): ?GoEngineStartRequest
    {
        return $this->startRequest;
    }
}
