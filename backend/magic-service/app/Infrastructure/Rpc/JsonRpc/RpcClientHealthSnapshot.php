<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc;

final readonly class RpcClientHealthSnapshot
{
    public function __construct(
        public bool $enabled = false,
        public bool $running = false,
        public string $socketPath = '',
        public bool $isConnected = false,
        public float $startedAt = 0.0,
        public bool $hasEverConnected = false,
        public float $lastConnectedAt = 0.0,
        public float $lastFailureAt = 0.0,
        public int $consecutiveFailures = 0,
        public ?RpcClientLastError $lastError = null,
    ) {
    }

    public function startedSinceSeconds(int $now): ?int
    {
        $startedAtUnix = $this->toUnixTimestamp($this->startedAt);
        if ($startedAtUnix === null) {
            return null;
        }

        return max(0, $now - $startedAtUnix);
    }

    public function withinStartupGrace(int $startupGraceSeconds, int $now): bool
    {
        $startedSinceSeconds = $this->startedSinceSeconds($now);

        return $this->running
            && ! $this->hasEverConnected
            && ($startedSinceSeconds === null || $startedSinceSeconds < $startupGraceSeconds);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'enabled' => $this->enabled,
            'running' => $this->running,
            'socket_path' => $this->socketPath,
            'is_connected' => $this->isConnected,
            'started_at' => $this->formatTimestamp($this->startedAt),
            'started_at_unix' => $this->toUnixTimestamp($this->startedAt),
            'has_ever_connected' => $this->hasEverConnected,
            'last_connected_at' => $this->formatTimestamp($this->lastConnectedAt),
            'last_connected_at_unix' => $this->toUnixTimestamp($this->lastConnectedAt),
            'last_failure_at' => $this->formatTimestamp($this->lastFailureAt),
            'last_failure_at_unix' => $this->toUnixTimestamp($this->lastFailureAt),
            'consecutive_failures' => $this->consecutiveFailures,
            'last_error' => $this->lastError?->toArray(),
        ];
    }

    private function formatTimestamp(float $value): ?string
    {
        if ($value <= 0) {
            return null;
        }

        return date(DATE_ATOM, (int) $value);
    }

    private function toUnixTimestamp(float $value): ?int
    {
        if ($value <= 0) {
            return null;
        }

        return (int) $value;
    }
}
