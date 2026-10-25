<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\ClassMap\SocketIoServer;

use Hyperf\Coordinator\Timer;

final class SocketIOConnectionState
{
    public const LEGACY_PROTOCOL = 3;

    public const CURRENT_PROTOCOL = 4;

    /** @var array<string, true> */
    public array $namespaces = [];

    public bool $closed = false;

    public ?int $heartbeatTimer = null;

    public ?int $pongTimer = null;

    public function __construct(public readonly int $protocol)
    {
    }

    public function acknowledgePong(Timer $timer): void
    {
        if ($this->pongTimer !== null) {
            $timer->clear($this->pongTimer);
            $this->pongTimer = null;
        }
    }

    public function close(Timer $timer): void
    {
        $this->closed = true;
        $this->acknowledgePong($timer);
        if ($this->heartbeatTimer !== null) {
            $timer->clear($this->heartbeatTimer);
            $this->heartbeatTimer = null;
        }
    }
}
