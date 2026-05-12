<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

final readonly class GoEngineSupervisorSnapshot
{
    public function __construct(
        public bool $enabled = false,
        public bool $running = false,
        public bool $restarting = false,
        public ?int $goPid = null,
        public ?string $goPidType = null,
        public ?float $goUptimeSeconds = null,
        public int $restartCount = 0,
        public float $lastRestartAt = 0.0,
        public ?GoEngineSupervisorReason $lastRestartReason = null,
        public ?int $lastExitCode = null,
        public float $lastRpcHealthyAt = 0.0,
        public int $currentBackoffMs = 0,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'enabled' => $this->enabled,
            'running' => $this->running,
            'restarting' => $this->restarting,
            'go_pid' => $this->goPid,
            'go_pid_type' => $this->goPidType,
            'go_uptime_seconds' => $this->goUptimeSeconds === null ? null : round($this->goUptimeSeconds, 3),
            'restart_count' => $this->restartCount,
            'last_restart_at' => $this->formatTimestamp($this->lastRestartAt),
            'last_restart_at_unix' => $this->toUnixTimestamp($this->lastRestartAt),
            'last_restart_reason' => $this->lastRestartReason?->value,
            'last_exit_code' => $this->lastExitCode,
            'last_rpc_healthy_at' => $this->formatTimestamp($this->lastRpcHealthyAt),
            'last_rpc_healthy_at_unix' => $this->toUnixTimestamp($this->lastRpcHealthyAt),
            'current_backoff_ms' => $this->currentBackoffMs,
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
