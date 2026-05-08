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

    private int $connectBackoffMs;

    private int $connectMaxBackoffMs;

    private float $retryJitterMin;

    private float $retryJitterMax;

    private int $retryLogIntervalSeconds;

    private DataFormatterInterface $dataFormatter;

    private ClientConfig $clientConfig;

    private bool $running = false;

    private bool $silentInitialConnect = false;

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
    public function start(bool $silentInitialConnect = false): void
    {
        if (! $this->enabled) {
            $this->logger->info('JSON-RPC client is disabled');
            return;
        }

        if ($this->running) {
            return;
        }

        $this->initClient();
        $this->running = true;
        $this->silentInitialConnect = $silentInitialConnect;
        if ($this->startedAt <= 0) {
            $this->startedAt = microtime(true);
        }

        $this->startKeepAliveLoop();
    }

    /**
     * 停止客户端连接.
     */
    public function stop(): void
    {
        $this->running = false;
        $this->silentInitialConnect = false;
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
     * 同步探测 Go Engine 是否已完成真实 RPC 握手。
     *
     * 成功时复用这条连接，供后续 start() 直接接管；
     * 失败时仅更新健康状态，不抛出异常。
     */
    public function probeConnection(): bool
    {
        if (! $this->enabled) {
            return false;
        }

        $this->initClient();

        if ($this->client === null) {
            return false;
        }

        if ($this->client->isConnected()) {
            return true;
        }

        try {
            if (! $this->client->connect(true)) {
                $this->markConnectFailure();
                return false;
            }
        } catch (Throwable) {
            $this->markConnectFailure();
            return false;
        }

        $this->markConnected();
        return true;
    }

    public function waitUntilConnected(int $timeoutSeconds, int $intervalMs): bool
    {
        if ($timeoutSeconds <= 0) {
            return $this->isConnected();
        }

        $sleepMicros = max(10, $intervalMs) * 1000;
        $deadline = microtime(true) + $timeoutSeconds;
        while (microtime(true) < $deadline) {
            if ($this->isConnected()) {
                return true;
            }
            usleep($sleepMicros);
        }

        return $this->isConnected();
    }

    /**
     * 获取连接健康快照（只读，不触发连接）.
     */
    public function healthSnapshot(): RpcClientHealthSnapshot
    {
        return new RpcClientHealthSnapshot(
            enabled: $this->enabled,
            running: $this->running,
            socketPath: $this->socketPath,
            isConnected: $this->isConnected(),
            startedAt: $this->startedAt,
            hasEverConnected: $this->hasEverConnected,
            lastConnectedAt: $this->lastConnectedAt,
            lastFailureAt: $this->lastFailureAt,
            consecutiveFailures: $this->consecutiveFailures,
            lastError: RpcClientLastError::fromNullableArray($this->client?->getLastError()),
        );
    }

    /**
     * 调用 Go Engine 的方法.
     * @throws Throwable
     */
    public function call(string $method, mixed $params = null, float $timeout = 30.0): mixed
    {
        if ($this->client === null || ! $this->client->isConnected()) {
            throw new RuntimeException('RPC client not connected');
        }

        return $this->client->call($method, $params, $timeout);
    }

    protected function registerHandlers(): void
    {
        try {
            if ($this->client === null) {
                return;
            }
            (new RpcServiceRegistry())->register($this->client, $this->container);
        } catch (Throwable $e) {
            $this->logger->error('goEngineException Failed to register handlers', ['error' => $e->getMessage()]);
        }
    }

    protected function createClient(): JsonRpcRuntimeClient
    {
        $transport = new UdsFramedTransport($this->socketPath, $this->clientConfig);
        return new JsonRpcRuntimeClient($transport, $this->dataFormatter, $this->clientConfig);
    }

    protected function startKeepAliveLoop(): void
    {
        // 启动连接并在协程中保持长连接重试
        go(function () {
            $this->keepAliveLoop();
        });
    }

    private function initClient(): void
    {
        if ($this->client !== null) {
            return;
        }

        $this->client = $this->createClient();
        $this->registerHandlers();
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

            $silent = $isFirstConnect ? $this->silentInitialConnect : true;
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

            $sleepSeconds = $this->delayWithJitterSeconds($retryDelay);
            $this->logConnectFailureIfNeeded($sleepSeconds, $this->shouldSuppressConnectFailureWarning());
            Coroutine::sleep($sleepSeconds);
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

    private function logConnectFailureIfNeeded(float $nextRetryDelaySeconds, bool $suppressWarning): void
    {
        if ($suppressWarning) {
            ++$this->suppressedRetryLogs;
            return;
        }

        if ($this->retryLogIntervalSeconds <= 0) {
            return;
        }

        $now = microtime(true);
        if ($this->lastRetryLogAt > 0 && ($now - $this->lastRetryLogAt) < $this->retryLogIntervalSeconds) {
            ++$this->suppressedRetryLogs;
            return;
        }

        $this->logger->warning('goEngineException RPC client connect failed, keepalive will retry', [
            'socket_path' => $this->socketPath,
            'consecutive_failures' => $this->consecutiveFailures,
            'suppressed_retry_logs' => $this->suppressedRetryLogs,
            'next_retry_delay_seconds' => $nextRetryDelaySeconds,
            'last_error' => $this->client?->getLastError(),
        ]);

        $this->lastRetryLogAt = $now;
        $this->suppressedRetryLogs = 0;
    }

    private function shouldSuppressConnectFailureWarning(): bool
    {
        return $this->silentInitialConnect && ! $this->hasEverConnected;
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
