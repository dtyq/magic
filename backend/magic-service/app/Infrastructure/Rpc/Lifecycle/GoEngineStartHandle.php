<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

class GoEngineStartHandle
{
    private const int SIGNAL_TERM = 15;

    private const int SIGNAL_KILL = 9;

    private ?int $pid = null;

    private ?int $cachedExitCode = null;

    private ?bool $cachedSignaled = null;

    private ?int $cachedTermSignal = null;

    private ?bool $cachedStopped = null;

    private ?int $cachedStopSignal = null;

    private bool $closed = false;

    private float $startedAt;

    public function __construct(
        private mixed $process,
        private readonly GoEngineStartRequest $request,
        ?float $startedAt = null,
    ) {
        $this->startedAt = $startedAt ?? microtime(true);
    }

    public function command(): string
    {
        return $this->request->command;
    }

    public function workDir(): string
    {
        return $this->request->workDir;
    }

    public function socketPath(): string
    {
        return $this->request->socketPath;
    }

    public function pidType(): string
    {
        return GoEngineProcessSpec::PID_TYPE;
    }

    public function startedAt(): float
    {
        return $this->startedAt;
    }

    public function uptimeSeconds(): float
    {
        if ($this->startedAt <= 0) {
            return 0.0;
        }

        return max(0.0, microtime(true) - $this->startedAt);
    }

    public function diagnostics(): GoEngineProcessDiagnostics
    {
        $status = $this->readStatus();
        $pid = $status !== null ? ($status->pid ?? $this->pid) : $this->pid;

        return new GoEngineProcessDiagnostics(
            pidType: $this->pidType(),
            pid: $pid,
            childPids: $this->readChildPids($pid),
            running: $status !== null ? $status->running : false,
            exitCode: $this->cachedExitCode ?? ($status !== null ? $status->exitCode : -1),
            signaled: $this->cachedSignaled ?? ($status !== null ? $status->signaled : false),
            termSignal: $this->cachedTermSignal ?? $status?->termSignal,
            stopped: $this->cachedStopped ?? ($status !== null ? $status->stopped : false),
            stopSignal: $this->cachedStopSignal ?? $status?->stopSignal,
            startedAt: $this->startedAt,
            uptimeSeconds: $this->uptimeSeconds(),
            command: $this->command(),
            workDir: $this->workDir(),
            socketPath: $this->socketPath(),
        );
    }

    public function pid(): ?int
    {
        $status = $this->readStatus();
        if ($status?->pid !== null) {
            $this->pid = $status->pid;
        }

        return $this->pid;
    }

    public function isRunning(): bool
    {
        $status = $this->readStatus();
        return $status !== null ? $status->running : false;
    }

    public function exitCode(): int
    {
        $status = $this->readStatus();
        return $this->cachedExitCode ?? ($status !== null ? $status->exitCode : -1);
    }

    public function terminate(int $graceSeconds): void
    {
        if (! $this->isProcessResource()) {
            return;
        }

        if (! $this->isRunning()) {
            $this->close();
            return;
        }

        @proc_terminate($this->process, self::SIGNAL_TERM);

        if (! $this->waitUntilStopped(microtime(true) + max(0, $graceSeconds))) {
            @proc_terminate($this->process, self::SIGNAL_KILL);
            $this->waitUntilStopped(microtime(true) + 1.0);
        }

        $this->close();
    }

    public function close(): void
    {
        if ($this->closed || ! $this->isProcessResource()) {
            return;
        }

        $status = $this->readStatus();
        if ($status !== null && $status->running) {
            return;
        }

        $exitCode = @proc_close($this->process);
        if ($exitCode >= 0) {
            $this->cachedExitCode = $exitCode;
        }
        $this->closed = true;
        $this->process = null;
    }

    private function readStatus(): ?GoEngineProcessStatus
    {
        if (! $this->isProcessResource()) {
            return null;
        }

        $status = GoEngineProcessStatus::fromProcStatus(proc_get_status($this->process));

        if ($status->pid !== null) {
            $this->pid = $status->pid;
        }

        if ($status->exitCode >= 0) {
            $this->cachedExitCode = $status->exitCode;
        }
        $this->cachedSignaled = $status->signaled;
        $this->cachedTermSignal = $status->termSignal;
        $this->cachedStopped = $status->stopped;
        $this->cachedStopSignal = $status->stopSignal;

        return $status;
    }

    private function waitUntilStopped(float $deadline): bool
    {
        do {
            if (! $this->isRunning()) {
                return true;
            }

            usleep(100_000);
        } while (microtime(true) < $deadline);

        return false;
    }

    private function isProcessResource(): bool
    {
        return is_resource($this->process) && get_resource_type($this->process) === 'process';
    }

    /**
     * @return int[]
     */
    private function readChildPids(?int $pid): array
    {
        if ($pid === null || $pid <= 0) {
            return [];
        }

        $path = sprintf('/proc/%d/task/%d/children', $pid, $pid);
        if (! is_readable($path)) {
            return [];
        }

        $content = trim((string) @file_get_contents($path));
        if ($content === '') {
            return [];
        }

        $childPids = [];
        foreach (preg_split('/\s+/', $content) ?: [] as $value) {
            $childPid = (int) $value;
            if ($childPid > 0) {
                $childPids[] = $childPid;
            }
        }

        return $childPids;
    }
}
