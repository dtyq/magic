<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use Hyperf\Coroutine\Coroutine;
use Throwable;

use function Hyperf\Coroutine\go;

class GoEngineSupervisor
{
    use HasLogger;

    private ?IpcBootstrapConfig $config = null;

    private ?GoEngineStartHandle $handle = null;

    private bool $running = false;

    private bool $restarting = false;

    private int $restartCount = 0;

    private float $lastRestartAt = 0.0;

    private ?GoEngineSupervisorReason $lastRestartReason = null;

    private ?int $lastExitCode = null;

    private float $lastRpcHealthyAt = 0.0;

    private int $currentBackoffMs = 0;

    private float $nextRestartAt = 0.0;

    public function __construct(
        private readonly RpcClientManager $rpcClientManager,
        private readonly GoEngineProcessStarter $processStarter,
    ) {
    }

    public function start(IpcBootstrapConfig $config, ?GoEngineStartHandle $handle = null): void
    {
        $this->config = $config;
        if ($handle !== null) {
            $this->handle = $handle;
        }

        if (! $config->shouldRunSupervisor()) {
            return;
        }

        if ($this->running) {
            return;
        }

        $this->running = true;
        if ($this->rpcClientManager->isConnected()) {
            $this->markRpcHealthy();
        } elseif ($this->handle !== null) {
            $this->lastRpcHealthyAt = $this->now();
        }

        $this->startLoop();
    }

    public function stop(): void
    {
        $this->running = false;
        $this->restarting = false;
        $this->nextRestartAt = 0.0;

        $this->terminateCurrentHandle();
    }

    public function snapshot(): GoEngineSupervisorSnapshot
    {
        $config = $this->config;
        $handle = $this->handle;

        return new GoEngineSupervisorSnapshot(
            enabled: $config?->shouldRunSupervisor() ?? false,
            running: $this->running,
            restarting: $this->restarting,
            goPid: $handle?->pid(),
            goPidType: $handle?->pidType(),
            goUptimeSeconds: $handle?->uptimeSeconds(),
            restartCount: $this->restartCount,
            lastRestartAt: $this->lastRestartAt,
            lastRestartReason: $this->lastRestartReason,
            lastExitCode: $this->lastExitCode,
            lastRpcHealthyAt: $this->lastRpcHealthyAt,
            currentBackoffMs: $this->currentBackoffMs,
        );
    }

    public function inspectAndRecover(): void
    {
        $config = $this->config;
        if ($this->restarting || ! $this->running || $config === null || ! $config->shouldRunSupervisor()) {
            return;
        }

        if ($this->rpcClientManager->isConnected()) {
            $this->markRpcHealthy();
            return;
        }

        if ($this->handle !== null) {
            if (! $this->handle->isRunning()) {
                $this->lastExitCode = $this->handle->exitCode();
                $this->restart(GoEngineSupervisorReason::ProcessExited);
                return;
            }

            if (! $this->rpcUnhealthyTooLong($config)) {
                return;
            }

            if ($this->probeConnection()) {
                $this->markRpcHealthy();
                return;
            }

            $this->restart(GoEngineSupervisorReason::RpcUnhealthyTimeout);
            return;
        }

        if ($this->probeConnection()) {
            $this->markRpcHealthy();
            return;
        }

        $this->restart(GoEngineSupervisorReason::NoHealthyRpcConnection);
    }

    protected function startLoop(): void
    {
        go(function () {
            $this->runLoop();
        });
    }

    protected function now(): float
    {
        return microtime(true);
    }

    private function runLoop(): void
    {
        while ($this->running) {
            try {
                $this->inspectAndRecover();
            } catch (Throwable $e) {
                $this->logger->error('goEngineException Go engine supervisor tick failed', [
                    'error' => $e->getMessage(),
                ]);
            }

            $interval = max(1, $this->config?->supervisorIntervalSeconds ?? 1);
            Coroutine::sleep((float) $interval);
        }
    }

    private function restart(GoEngineSupervisorReason $reason): void
    {
        $config = $this->config;
        if ($config === null || ! $config->shouldRunSupervisor() || ! $this->restartWindowReady()) {
            return;
        }

        $this->restarting = true;
        ++$this->restartCount;
        $this->lastRestartAt = $this->now();
        $this->lastRestartReason = $reason;

        $this->logger->warning('goEngineException Restarting Go engine from PHP supervisor', [
            'reason' => $reason->value,
            'restart_count' => $this->restartCount,
            'current_backoff_ms' => $this->currentBackoffMs,
        ] + $this->diagnosticContext($this->handle, $config));

        try {
            $this->rpcClientManager->stop();
            $this->terminateCurrentHandle();
            $this->cleanupSocketIfDisconnected($config);

            $handle = $this->processStarter->start(GoEngineStartRequest::fromConfig($config));
            if ($handle === null) {
                $this->markRestartFailed(GoEngineSupervisorReason::GoEngineStartFailed);
                return;
            }

            $this->handle = $handle;
            $this->rpcClientManager->start(true);

            if ($this->rpcClientManager->waitUntilConnected($config->waitTimeoutSeconds, $config->waitIntervalMs)) {
                $this->markRestartSucceeded();
                return;
            }

            if (! $handle->isRunning()) {
                $this->lastExitCode = $handle->exitCode();
                $handle->close();
            }

            $this->markRestartFailed(GoEngineSupervisorReason::RpcNotReadyAfterRestart);
        } catch (Throwable $e) {
            $this->markRestartFailed(GoEngineSupervisorReason::GoEngineRestartException);
            $this->logger->error('goEngineException Go engine supervisor restart failed', [
                'reason' => $reason->value,
                'error' => $e->getMessage(),
            ] + $this->diagnosticContext($this->handle, $config));
        } finally {
            $this->restarting = false;
        }
    }

    private function probeConnection(): bool
    {
        try {
            return $this->rpcClientManager->probeConnection();
        } catch (Throwable $e) {
            $this->logger->warning('goEngineException Go engine supervisor probe failed', [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    private function rpcUnhealthyTooLong(IpcBootstrapConfig $config): bool
    {
        if ($config->supervisorRpcUnhealthySeconds <= 0) {
            return true;
        }

        $lastHealthyAt = $this->lastRpcHealthyAt > 0 ? $this->lastRpcHealthyAt : $this->now();
        if ($this->lastRpcHealthyAt <= 0) {
            $this->lastRpcHealthyAt = $lastHealthyAt;
        }

        return ($this->now() - $lastHealthyAt) >= $config->supervisorRpcUnhealthySeconds;
    }

    private function restartWindowReady(): bool
    {
        return $this->nextRestartAt <= 0 || $this->now() >= $this->nextRestartAt;
    }

    private function markRestartSucceeded(): void
    {
        $this->markRpcHealthy();
        $this->currentBackoffMs = 0;
        $this->nextRestartAt = 0.0;

        $this->logger->info('Go engine supervisor restart completed', [
            'restart_count' => $this->restartCount,
            'restart_reason' => $this->lastRestartReason?->value,
        ] + $this->diagnosticContext($this->handle, $this->config));
    }

    private function markRestartFailed(GoEngineSupervisorReason $reason): void
    {
        $config = $this->config;
        if ($config === null) {
            return;
        }

        $this->lastRestartReason = $reason;
        $this->currentBackoffMs = $this->currentBackoffMs <= 0
            ? $config->supervisorRestartBackoffMs
            : min($this->currentBackoffMs * 2, $config->supervisorRestartMaxBackoffMs);
        $this->nextRestartAt = $this->now() + ($this->currentBackoffMs / 1000);
        if ($this->handle !== null && $config->supervisorRpcUnhealthySeconds > 0) {
            $this->lastRpcHealthyAt = $this->now() - $config->supervisorRpcUnhealthySeconds;
        }

        $this->logger->error('goEngineException Go engine supervisor restart not ready', [
            'reason' => $reason->value,
            'restart_count' => $this->restartCount,
            'next_backoff_ms' => $this->currentBackoffMs,
        ] + $this->diagnosticContext($this->handle, $config));
    }

    private function markRpcHealthy(): void
    {
        $this->lastRpcHealthyAt = $this->now();
        $this->currentBackoffMs = 0;
        $this->nextRestartAt = 0.0;
    }

    private function terminateCurrentHandle(): void
    {
        if ($this->handle === null) {
            return;
        }

        $config = $this->config;
        if ($this->handle->isRunning()) {
            $this->logger->info('Terminating managed Go engine process', [
                'grace_seconds' => $config?->supervisorTerminateGraceSeconds ?? 5,
            ] + $this->diagnosticContext($this->handle, $config));
            $this->handle->terminate($config?->supervisorTerminateGraceSeconds ?? 5);
        } else {
            $this->lastExitCode = $this->handle->exitCode();
            $this->logger->info('Closing exited Go engine process handle', $this->diagnosticContext($this->handle, $config));
            $this->handle->close();
        }

        $this->handle = null;
    }

    private function cleanupSocketIfDisconnected(IpcBootstrapConfig $config): void
    {
        if ($config->socketPath === '' || $this->rpcClientManager->isConnected() || ! file_exists($config->socketPath)) {
            return;
        }

        if (! @unlink($config->socketPath)) {
            $this->logger->warning('goEngineException Failed to remove stale Go engine socket', [
                'socket_path' => $this->toRelativePath($config->socketPath),
            ]);
        }
    }

    private function toRelativePath(string $path): string
    {
        if (defined('BASE_PATH') && str_starts_with($path, BASE_PATH)) {
            return ltrim(str_replace(BASE_PATH, '', $path), DIRECTORY_SEPARATOR);
        }

        return $path;
    }

    /**
     * @return array<string, mixed>
     */
    private function diagnosticContext(?GoEngineStartHandle $handle, ?IpcBootstrapConfig $config): array
    {
        $process = $handle?->diagnostics()->toArray();
        $socketPath = $config?->socketPath ?? $handle?->socketPath() ?? '';
        $lastRpcHealthyAt = $this->lastRpcHealthyAt > 0 ? $this->lastRpcHealthyAt : null;

        return [
            'process' => $process,
            'exit_code' => $process['exit_code'] ?? $this->lastExitCode,
            'signaled' => $process['signaled'] ?? null,
            'term_signal' => $process['term_signal'] ?? null,
            'stopped' => $process['stopped'] ?? null,
            'stop_signal' => $process['stop_signal'] ?? null,
            'pid' => $process['pid'] ?? null,
            'pid_type' => $process['pid_type'] ?? null,
            'uptime_seconds' => $process['uptime_seconds'] ?? null,
            'last_rpc_healthy_at' => $lastRpcHealthyAt === null ? null : date(DATE_ATOM, (int) $lastRpcHealthyAt),
            'seconds_since_last_rpc_healthy' => $lastRpcHealthyAt === null ? null : round(max(0.0, $this->now() - $lastRpcHealthyAt), 3),
            'socket_exists' => $socketPath !== '' && file_exists($socketPath),
            'socket_path' => $socketPath === '' ? null : $this->toRelativePath($socketPath),
        ];
    }
}
