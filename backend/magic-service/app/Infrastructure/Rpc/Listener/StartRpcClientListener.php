<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Listener;

use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Framework\Event\OnWorkerStop;
use Hyperf\Server\Event\MainCoroutineServerStart;
use Throwable;

/**
 * RPC 客户端生命周期监听器.
 *
 * 在 PHP 启动阶段尽量拉起 Go Engine，并启动 PHP 侧 RPC 客户端。
 * Go 未就绪时保持降级运行，不中断 PHP 主进程。
 */
class StartRpcClientListener implements ListenerInterface
{
    use HasLogger;

    private static bool $started = false;

    private static ?RpcClientManager $manager = null;

    public function __construct(
        private readonly RpcClientManager $rpcClientManager,
        private readonly ConfigInterface $config,
    ) {
    }

    public function listen(): array
    {
        return [
            MainCoroutineServerStart::class,
            OnWorkerStop::class,
        ];
    }

    public function process(object $event): void
    {
        if ($event instanceof OnWorkerStop) {
            $this->handleStop($event);
            return;
        }

        if ($event instanceof MainCoroutineServerStart) {
            $this->handleStart();
        }
    }

    private function handleStart(): void
    {
        if (self::$started) {
            return;
        }

        self::$started = true;

        try {
            $this->ensureGoEngineStarted();
            $this->rpcClientManager->start();
            self::$manager = $this->rpcClientManager;
        } catch (Throwable $e) {
            $this->logger->error('Failed to start RPC client manager', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function ensureGoEngineStarted(): void
    {
        $ipcConfig = (array) $this->config->get('ipc', []);
        $autoStart = (bool) ($ipcConfig['engine_auto_start'] ?? true);
        if (! $autoStart) {
            $this->logger->info('Go engine auto start disabled');
            return;
        }

        $socketPath = (string) ($ipcConfig['socket_path'] ?? '');
        if ($socketPath !== '' && $this->canConnectSocket($socketPath)) {
            return;
        }

        $workDir = (string) ($ipcConfig['engine_workdir'] ?? '');
        $command = (string) ($ipcConfig['engine_start_command'] ?? '');
        $waitTimeoutSeconds = max(0, (int) ($ipcConfig['engine_start_wait_timeout_seconds'] ?? 20));
        $waitIntervalMs = max(10, (int) ($ipcConfig['engine_start_wait_interval_ms'] ?? 200));
        if ($workDir === '' || $command === '') {
            $this->logger->warning('Go engine start command not configured', [
                'workdir' => $workDir,
                'command' => $command,
            ]);
            return;
        }

        $shellCommand = sprintf('cd %s && %s', escapeshellarg($workDir), $command);
        $process = proc_open(
            ['/bin/sh', '-c', $shellCommand],
            [
                0 => ['pipe', 'r'],
                1 => ['file', 'php://stdout', 'w'],
                2 => ['file', 'php://stderr', 'w'],
            ],
            $pipes
        );

        if (! is_resource($process)) {
            $this->logger->error('Failed to start Go engine', [
                'command' => $command,
                'workdir' => $workDir,
                'socket_path' => $this->getRelativePath($socketPath),
            ]);
            return;
        }

        foreach ($pipes as $pipe) {
            if (is_resource($pipe)) {
                fclose($pipe);
            }
        }

        $this->logger->info('Go engine start command invoked', [
            'command' => $command,
            'workdir' => $workDir,
            'socket_path' => $this->getRelativePath($socketPath),
            'wait_timeout_seconds' => $waitTimeoutSeconds,
            'wait_interval_ms' => $waitIntervalMs,
        ]);

        if ($socketPath === '') {
            return;
        }

        if ($this->waitForSocketReady($socketPath, $waitTimeoutSeconds, $waitIntervalMs)) {
            $this->logger->info('Go engine socket is ready', [
                'socket_path' => $this->getRelativePath($socketPath),
                'wait_timeout_seconds' => $waitTimeoutSeconds,
            ]);
            return;
        }

        $this->logger->error('Go engine socket not ready within timeout, continue in degraded mode', [
            'socket_path' => $this->getRelativePath($socketPath),
            'wait_timeout_seconds' => $waitTimeoutSeconds,
            'wait_interval_ms' => $waitIntervalMs,
            'command' => $command,
            'workdir' => $workDir,
        ]);
    }

    private function canConnectSocket(string $socketPath, float $timeout = 0.2): bool
    {
        $address = 'unix://' . $socketPath;
        $errno = 0;
        $errstr = '';
        $connection = @stream_socket_client($address, $errno, $errstr, $timeout);
        if ($connection === false) {
            return false;
        }

        fclose($connection);
        return true;
    }

    private function waitForSocketReady(string $socketPath, int $timeoutSeconds, int $intervalMs): bool
    {
        if ($timeoutSeconds <= 0) {
            return $this->canConnectSocket($socketPath);
        }

        $deadline = microtime(true) + $timeoutSeconds;
        while (microtime(true) < $deadline) {
            if ($this->canConnectSocket($socketPath)) {
                return true;
            }
            usleep($intervalMs * 1000);
        }

        return $this->canConnectSocket($socketPath);
    }

    private function getRelativePath(string $path): string
    {
        if (defined('BASE_PATH') && str_starts_with($path, BASE_PATH)) {
            return ltrim(str_replace(BASE_PATH, '', $path), DIRECTORY_SEPARATOR);
        }

        return $path;
    }

    private function handleStop(OnWorkerStop $event): void
    {
        if ($event->workerId !== 0) {
            return;
        }

        if (self::$manager !== null) {
            self::$manager->stop();
            self::$manager = null;
            self::$started = false;
        }
    }
}
