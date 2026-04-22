<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc;

use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Rpc\Protocol\Contract\DataFormatterInterface;
use App\Infrastructure\Rpc\Protocol\JsonDataFormatter;
use App\Infrastructure\Rpc\Registry\RpcServiceRegistry;
use App\Infrastructure\Transport\Ipc\Uds\UdsFramedTransport;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Coroutine\Coroutine;
use Psr\Container\ContainerInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Coroutine\go;

/**
 * JSON-RPC 客户端连接管理器.
 *
 * 管理与 Go Engine 的 UDS 连接
 * 支持自动重连和方法处理器注册
 */
class RpcClientManager
{
    use HasLogger;

    private ?JsonRpcRuntimeClient $client = null;

    private bool $enabled;

    private string $socketPath;

    private int $connectRetries;

    private int $connectBackoffMs;

    private int $connectMaxBackoffMs;

    private float $retryJitterMin;

    private float $retryJitterMax;

    private int $retryLogIntervalSeconds;

    private DataFormatterInterface $dataFormatter;

    private ClientConfig $clientConfig;

    private bool $running = false;

    private float $startedAt = 0.0;

    private bool $hasEverConnected = false;

    private float $lastConnectedAt = 0.0;

    private float $lastFailureAt = 0.0;

    private int $consecutiveFailures = 0;

    private float $lastRetryLogAt = 0.0;

    private int $suppressedRetryLogs = 0;

    public function __construct(
        private readonly ContainerInterface $container,
        private readonly ConfigInterface $config,
    ) {
        $this->dataFormatter = new JsonDataFormatter();
        $config = $this->config->get('ipc', []);

        $this->enabled = (bool) ($config['rpc_client_enabled'] ?? false);
        $this->socketPath = (string) ($config['socket_path'] ?? BASE_PATH . '/runtime/magic_engine.sock');
        $this->connectRetries = (int) ($config['rpc_connect_retries'] ?? 5);
        $this->connectBackoffMs = (int) ($config['rpc_connect_backoff_ms'] ?? 200);
        $this->connectMaxBackoffMs = (int) ($config['rpc_connect_max_backoff_ms'] ?? 30000);
        if ($this->connectMaxBackoffMs < $this->connectBackoffMs) {
            $this->connectMaxBackoffMs = $this->connectBackoffMs;
        }
        $this->retryJitterMin = (float) ($config['rpc_retry_jitter_min'] ?? 0.8);
        $this->retryJitterMax = (float) ($config['rpc_retry_jitter_max'] ?? 1.2);
        if ($this->retryJitterMin <= 0) {
            $this->retryJitterMin = 1.0;
        }
        if ($this->retryJitterMax <= 0) {
            $this->retryJitterMax = 1.0;
        }
        if ($this->retryJitterMin > $this->retryJitterMax) {
            [$this->retryJitterMin, $this->retryJitterMax] = [$this->retryJitterMax, $this->retryJitterMin];
        }
        $this->retryLogIntervalSeconds = max(0, (int) ($config['rpc_retry_log_interval_seconds'] ?? 30));

        $this->clientConfig = ClientConfig::fromArray($config);
    }

    /**
     * 启动客户端连接.
     */
    public function start(): void
    {
        if (! $this->enabled) {
            $this->logger->info('JSON-RPC client is disabled');
            return;
        }

        $this->initClient();
        $this->running = true;
        if ($this->startedAt <= 0) {
            $this->startedAt = microtime(true);
        }

        // 启动连接并在协程中保持长连接重试
        go(function () {
            $this->keepAliveLoop();
        });
    }

    /**
     * 停止客户端连接.
     */
    public function stop(): void
    {
        $this->running = false;
        if ($this->client !== null) {
            $this->client->close();
            $this->client = null;
        }
    }

    /**
     * 获取客户端实例.
     */
    public function getClient(): ?JsonRpcRuntimeClient
    {
        return $this->client;
    }

    /**
     * 检查是否已连接.
     */
    public function isConnected(): bool
    {
        return $this->client !== null && $this->client->isConnected();
    }

    /**
     * 获取连接健康快照（只读，不触发连接）.
     */
    public function getHealthSnapshot(): array
    {
        return [
            'enabled' => $this->enabled,
            'running' => $this->running,
            'socket_path' => $this->socketPath,
            'is_connected' => $this->isConnected(),
            'started_at' => $this->formatTimestamp($this->startedAt),
            'started_at_unix' => $this->toUnixTimestamp($this->startedAt),
            'has_ever_connected' => $this->hasEverConnected,
            'last_connected_at' => $this->formatTimestamp($this->lastConnectedAt),
            'last_connected_at_unix' => $this->toUnixTimestamp($this->lastConnectedAt),
            'last_failure_at' => $this->formatTimestamp($this->lastFailureAt),
            'last_failure_at_unix' => $this->toUnixTimestamp($this->lastFailureAt),
            'consecutive_failures' => $this->consecutiveFailures,
            'last_error' => $this->client?->getLastError(),
        ];
    }

    /**
     * 调用 Go Engine 的方法.
     */
    public function call(string $method, mixed $params = null, float $timeout = 30.0): mixed
    {
        if ($this->client === null || ! $this->client->isConnected()) {
            throw new RuntimeException('RPC client not connected');
        }

        return $this->client->call($method, $params, $timeout);
    }

    /**
     * 调用 Go Engine 的方法（带重试与重连）.
     */
    public function callWithRetry(string $method, mixed $params = null, float $timeout = 30.0): mixed
    {
        $this->ensureConnected();

        try {
            if ($this->client === null) {
                throw new RuntimeException('RPC client not initialized');
            }
            return $this->client->call($method, $params, $timeout);
        } catch (Throwable $e) {
            $this->logger->warning('RPC call failed, retrying after reconnect', [
                'method' => $method,
                'error' => $e->getMessage(),
            ]);

            $this->client?->close();

            $this->connectWithRetry(true);

            if ($this->client === null) {
                throw new RuntimeException('RPC client not initialized');
            }
            return $this->client->call($method, $params, $timeout);
        }
    }

    /**
     * 确保已建立连接.
     */
    public function ensureConnected(): void
    {
        if (! $this->enabled) {
            throw new RuntimeException('RPC client is disabled');
        }

        $this->initClient();

        if ($this->client !== null && $this->client->isConnected()) {
            return;
        }

        $this->connectWithRetry(true);
    }

    private function registerHandlers(): void
    {
        try {
            if ($this->client === null) {
                return;
            }
            (new RpcServiceRegistry())->register($this->client, $this->container);
        } catch (Throwable $e) {
            $this->logger->error('Failed to register handlers', ['error' => $e->getMessage()]);
        }
    }

    private function initClient(): void
    {
        if ($this->client !== null) {
            return;
        }

        $transport = new UdsFramedTransport($this->socketPath, $this->clientConfig);
        $this->client = new JsonRpcRuntimeClient($transport, $this->dataFormatter, $this->clientConfig);
        $this->registerHandlers();
    }

    private function connectWithRetry(bool $throwOnFailure): void
    {
        $maxRetries = max(1, $this->connectRetries);
        $retryDelay = $this->initialRetryDelaySeconds();

        // 同步连接阶段：指数退避 + 抖动（jitter），避免多个实例同时重试造成雪崩。
        // 规则由以下配置决定：rpc_connect_retries / rpc_connect_backoff_ms /
        // rpc_connect_max_backoff_ms / rpc_retry_jitter_min / rpc_retry_jitter_max。
        for ($i = 0; $i < $maxRetries; ++$i) {
            if ($this->client === null) {
                return;
            }

            if ($this->client->connect()) {
                $this->markConnected();
                return;
            }
            $this->markConnectFailure();

            $this->logRetryFailure($i + 1, $maxRetries);

            usleep((int) ($this->delayWithJitterSeconds($retryDelay) * 1_000_000));
            $retryDelay = $this->nextRetryDelaySeconds($retryDelay);
        }

        if ($throwOnFailure) {
            throw new RuntimeException('Failed to connect after max retries');
        }

        $this->logger->error('Failed to connect after max retries');
    }

    private function keepAliveLoop(): void
    {
        // 常驻保活阶段：断连后持续重连，延迟按 1x,2x,4x... 增长，最大值由 rpc_connect_max_backoff_ms 控制。
        // 每次等待还会乘以 jitter 因子（rpc_retry_jitter_min ~ rpc_retry_jitter_max）。
        $retryDelay = $this->initialRetryDelaySeconds();
        $isFirstConnect = true;

        while ($this->running && $this->client !== null) {
            if ($this->client->isConnected()) {
                Coroutine::sleep(1.0);
                $isFirstConnect = false; // 成功连接过一次后，后续断开将静默重连
                $retryDelay = $this->initialRetryDelaySeconds();
                continue;
            }

            $silent = ! $isFirstConnect;
            try {
                if ($this->client->connect($silent)) {
                    $this->markConnected();
                    $retryDelay = $this->initialRetryDelaySeconds();
                    $isFirstConnect = false;
                    continue;
                }
            } catch (Throwable) {
            }
            $this->markConnectFailure();

            $isFirstConnect = false; // 无论由于失败还是异常，除了第一次之外后续均保持静默

            Coroutine::sleep($this->delayWithJitterSeconds($retryDelay));
            $retryDelay = $this->nextRetryDelaySeconds($retryDelay);
        }
    }

    private function markConnected(): void
    {
        $this->hasEverConnected = true;
        $this->lastConnectedAt = microtime(true);
        $this->consecutiveFailures = 0;
        $this->suppressedRetryLogs = 0;
        $this->lastRetryLogAt = 0.0;
    }

    private function markConnectFailure(): void
    {
        $this->lastFailureAt = microtime(true);
        ++$this->consecutiveFailures;
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

    private function logRetryFailure(int $attempt, int $maxRetries): void
    {
        if ($this->retryLogIntervalSeconds <= 0) {
            $this->logger->warning('Failed to connect, retrying...', [
                'attempt' => $attempt,
                'max' => $maxRetries,
                'suppressed_logs' => $this->suppressedRetryLogs,
            ]);
            $this->suppressedRetryLogs = 0;
            return;
        }

        $now = microtime(true);
        if ($this->lastRetryLogAt > 0 && ($now - $this->lastRetryLogAt) < $this->retryLogIntervalSeconds) {
            ++$this->suppressedRetryLogs;
            return;
        }

        $this->logger->warning('Failed to connect, retrying...', [
            'attempt' => $attempt,
            'max' => $maxRetries,
            'suppressed_logs' => $this->suppressedRetryLogs,
        ]);
        $this->lastRetryLogAt = $now;
        $this->suppressedRetryLogs = 0;
    }

    private function initialRetryDelaySeconds(): float
    {
        return max(1, $this->connectBackoffMs) / 1000;
    }

    private function nextRetryDelaySeconds(float $current): float
    {
        $maxDelay = max(1, $this->connectMaxBackoffMs) / 1000;
        return min($current * 2, $maxDelay);
    }

    private function delayWithJitterSeconds(float $baseDelay): float
    {
        if ($this->retryJitterMin === $this->retryJitterMax) {
            return $baseDelay * $this->retryJitterMin;
        }

        $range = $this->retryJitterMax - $this->retryJitterMin;
        $factor = $this->retryJitterMin + (mt_rand() / mt_getrandmax()) * $range;
        return $baseDelay * $factor;
    }
}
