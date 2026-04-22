<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Transport\Ipc\Contract;

interface FramedTransportInterface
{
    public function connect(): void;

    public function close(): void;

    public function isConnected(): bool;

    public function readFrame(): string;

    public function writeFrame(string $payload): void;

    public function getEndpointLabel(): string;
}
