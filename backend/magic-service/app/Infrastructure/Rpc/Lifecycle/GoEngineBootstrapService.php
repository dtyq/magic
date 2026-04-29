<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Lifecycle;

use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use Hyperf\Contract\ConfigInterface;

class GoEngineBootstrapService
{
    use HasLogger;

    public function __construct(
        private readonly ConfigInterface $config,
        private readonly RpcClientManager $rpcClientManager,
        private readonly GoEngineProcessStarter $processStarter,
        private readonly GoEngineSupervisor $supervisor,
    ) {
    }

    public function boot(): void
    {
        $bootstrapConfig = IpcBootstrapConfig::fromArray((array) $this->config->get('ipc', []));
        $decision = $this->makeDecision($bootstrapConfig);

        $this->logDecision($decision, $bootstrapConfig);

        $processHandle = null;
        if ($decision->shouldStartProcess()) {
            $processHandle = $this->startProcess($bootstrapConfig, $decision);
            if ($processHandle === null) {
                $this->rpcClientManager->start(true);
                $this->supervisor->start($bootstrapConfig);
                $this->logResult(BootstrapResult::degraded('go_engine_start_failed'), $bootstrapConfig);
                return;
            }
        }

        $this->rpcClientManager->start(true);

        $result = $this->awaitBootstrapResult($bootstrapConfig, $decision, $processHandle);
        $this->supervisor->start($bootstrapConfig, $processHandle);
        $this->logResult($result, $bootstrapConfig);
    }

    public function shutdown(): void
    {
        $this->supervisor->stop();
        $this->rpcClientManager->stop();
    }

    private function makeDecision(IpcBootstrapConfig $config): BootstrapDecision
    {
        if ($this->rpcClientManager->probeConnection()) {
            return BootstrapDecision::reuseConnection();
        }

        if ($config->hasSocketPath() && file_exists($config->socketPath)) {
            return BootstrapDecision::waitForExistingSocket();
        }

        if (! $config->autoStart) {
            return BootstrapDecision::skip('go_engine_auto_start_disabled');
        }

        if (! $config->canStartProcess()) {
            return BootstrapDecision::skip('go_engine_process_spec_not_configured');
        }

        return BootstrapDecision::startProcess(GoEngineStartRequest::fromConfig($config));
    }

    private function startProcess(IpcBootstrapConfig $config, BootstrapDecision $decision): ?GoEngineStartHandle
    {
        $request = $decision->startRequest();
        if ($request === null) {
            return null;
        }

        $handle = $this->processStarter->start($request);
        if ($handle === null) {
            $this->logger->error('goEngineException Failed to start Go engine', [
                'command' => $request->command,
                'workdir' => $request->workDir,
                'socket_path' => $this->toRelativePath($request->socketPath),
            ] + $request->processSpec->toLogContext());
            return null;
        }

        $this->logger->info('Go engine start command invoked', [
            'command' => $handle->command(),
            'workdir' => $handle->workDir(),
            'socket_path' => $this->toRelativePath($handle->socketPath()),
            'wait_timeout_seconds' => $config->waitTimeoutSeconds,
            'wait_interval_ms' => $config->waitIntervalMs,
            'process' => $handle->diagnostics()->toArray(),
        ]);

        return $handle;
    }

    private function awaitBootstrapResult(
        IpcBootstrapConfig $config,
        BootstrapDecision $decision,
        ?GoEngineStartHandle $processHandle,
    ): BootstrapResult {
        if ($decision->reason() === 'existing_rpc_connection_ready') {
            return BootstrapResult::ready($decision->reason(), $processHandle);
        }

        if (! $decision->shouldWaitForReady()) {
            return BootstrapResult::skipped($decision->reason());
        }

        if ($processHandle === null) {
            if ($this->rpcClientManager->waitUntilConnected($config->waitTimeoutSeconds, $config->waitIntervalMs)) {
                return BootstrapResult::ready('rpc_ready_after_waiting_existing_socket');
            }

            return BootstrapResult::degraded('rpc_not_ready_after_waiting_existing_socket');
        }

        return $this->awaitProcessBackedReady($config, $processHandle);
    }

    private function awaitProcessBackedReady(IpcBootstrapConfig $config, GoEngineStartHandle $processHandle): BootstrapResult
    {
        if ($config->waitTimeoutSeconds <= 0) {
            return $this->rpcClientManager->isConnected()
                ? BootstrapResult::ready('rpc_ready_after_process_start', $processHandle)
                : BootstrapResult::degraded('rpc_not_ready_after_process_start', $processHandle, $processHandle->exitCode());
        }

        $deadline = microtime(true) + $config->waitTimeoutSeconds;
        $sleepMicros = $config->waitIntervalMs * 1000;
        while (microtime(true) < $deadline) {
            if ($this->rpcClientManager->isConnected()) {
                return BootstrapResult::ready('rpc_ready_after_process_start', $processHandle);
            }

            if (! $processHandle->isRunning()) {
                return BootstrapResult::degraded('go_engine_process_exited_early', $processHandle, $processHandle->exitCode());
            }

            usleep($sleepMicros);
        }

        if ($this->rpcClientManager->isConnected()) {
            return BootstrapResult::ready('rpc_ready_after_process_start', $processHandle);
        }

        return BootstrapResult::degraded('rpc_not_ready_after_process_start', $processHandle, $processHandle->exitCode());
    }

    private function logResult(BootstrapResult $result, IpcBootstrapConfig $config): void
    {
        if ($result->isReady()) {
            return;
        }

        if ($result->isDegraded()) {
            if ($result->reason() === 'go_engine_process_exited_early') {
                $this->logger->info('Go engine process exited early, stopping wait', [
                    'socket_path' => $this->toRelativePath($config->socketPath),
                    'exit_code' => $result->exitCode() ?? -1,
                ] + $this->handleDiagnosticsContext($result->handle()));
            }

            $this->logger->error('goEngineException Go engine RPC not ready within timeout, continue in degraded mode', [
                'socket_path' => $this->toRelativePath($config->socketPath),
                'wait_timeout_seconds' => $config->waitTimeoutSeconds,
                'wait_interval_ms' => $config->waitIntervalMs,
                'command' => $result->handle()?->command() ?? $config->command,
                'workdir' => $result->handle()?->workDir() ?? $config->workDir,
                'reason' => $result->reason(),
                'exit_code' => $result->exitCode(),
            ] + $this->handleDiagnosticsContext($result->handle()));
            return;
        }

        if ($result->reason() === 'go_engine_auto_start_disabled') {
            $this->logger->info('Go engine auto start disabled');
            return;
        }

        if ($result->reason() === 'go_engine_process_spec_not_configured') {
            $this->logger->warning('goEngineException Go engine process spec not configured', [
                'workdir' => $config->workDir,
                'command' => $config->command,
            ]);
        }
    }

    private function logDecision(BootstrapDecision $decision, IpcBootstrapConfig $config): void
    {
        if ($decision->reason() !== 'socket_exists_but_handshake_probe_failed') {
            return;
        }

        $this->logger->warning('goEngineException Go engine socket exists but handshake probe failed, skip auto start', [
            'socket_path' => $this->toRelativePath($config->socketPath),
        ]);
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
    private function handleDiagnosticsContext(?GoEngineStartHandle $handle): array
    {
        if ($handle === null) {
            return ['process' => null];
        }

        $process = $handle->diagnostics()->toArray();

        return [
            'process' => $process,
            'pid' => $process['pid'] ?? null,
            'pid_type' => $process['pid_type'] ?? null,
            'signaled' => $process['signaled'] ?? null,
            'term_signal' => $process['term_signal'] ?? null,
            'stopped' => $process['stopped'] ?? null,
            'stop_signal' => $process['stop_signal'] ?? null,
            'uptime_seconds' => $process['uptime_seconds'] ?? null,
        ];
    }
}
