<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

final readonly class GoEngineProcessDiagnostics
{
    /**
     * @param int[] $childPids
     */
    public function __construct(
        public string $pidType,
        public ?int $pid,
        public array $childPids,
        public bool $running,
        public int $exitCode,
        public bool $signaled,
        public ?int $termSignal,
        public bool $stopped,
        public ?int $stopSignal,
        public float $startedAt,
        public float $uptimeSeconds,
        public string $command,
        public string $workDir,
        public string $socketPath,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'pid_type' => $this->pidType,
            'pid' => $this->pid,
            'child_pids' => $this->childPids,
            'running' => $this->running,
            'exit_code' => $this->exitCode,
            'signaled' => $this->signaled,
            'term_signal' => $this->termSignal,
            'stopped' => $this->stopped,
            'stop_signal' => $this->stopSignal,
            'started_at' => $this->formatTimestamp($this->startedAt),
            'started_at_unix' => $this->toUnixTimestamp($this->startedAt),
            'uptime_seconds' => round($this->uptimeSeconds, 3),
            'command' => $this->command,
            'workdir' => $this->workDir,
            'socket_path' => $this->socketPath,
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
