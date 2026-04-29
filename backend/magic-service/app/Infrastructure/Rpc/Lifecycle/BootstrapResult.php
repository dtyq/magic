<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

final readonly class BootstrapResult
{
    private const string STATUS_READY = 'ready';

    private const string STATUS_DEGRADED = 'degraded';

    private const string STATUS_SKIPPED = 'skipped';

    private function __construct(
        private string $status,
        private string $reason,
        private ?GoEngineStartHandle $handle = null,
        private ?int $exitCode = null,
    ) {
    }

    public static function ready(string $reason, ?GoEngineStartHandle $handle = null): self
    {
        return new self(self::STATUS_READY, $reason, $handle);
    }

    public static function degraded(string $reason, ?GoEngineStartHandle $handle = null, ?int $exitCode = null): self
    {
        return new self(self::STATUS_DEGRADED, $reason, $handle, $exitCode);
    }

    public static function skipped(string $reason): self
    {
        return new self(self::STATUS_SKIPPED, $reason);
    }

    public function isReady(): bool
    {
        return $this->status === self::STATUS_READY;
    }

    public function isDegraded(): bool
    {
        return $this->status === self::STATUS_DEGRADED;
    }

    public function status(): string
    {
        return $this->status;
    }

    public function reason(): string
    {
        return $this->reason;
    }

    public function handle(): ?GoEngineStartHandle
    {
        return $this->handle;
    }

    public function exitCode(): ?int
    {
        return $this->exitCode;
    }
}
