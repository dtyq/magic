<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Rpc\Method\SvcMethods;
use App\Infrastructure\Rpc\Protocol\Contract\DataFormatterInterface;
use App\Infrastructure\Rpc\Protocol\Request as RpcRequest;
use App\Infrastructure\Transport\Ipc\Contract\FramedTransportInterface;
use App\Infrastructure\Util\Context\CoContext;
use Hyperf\Codec\Json;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Engine\Channel;
use RuntimeException;
use Throwable;

use function Hyperf\Coroutine\go;

class JsonRpcRuntimeClient
{
    use HasLogger;

    private const int LOG_PAYLOAD_LIMIT = 4096;

    private int $nextId = 1;

    /** @var array<int, Channel> */
    private array $pending = [];

    /** @var array<string, callable> */
    private array $handlers = [];

    private bool $running = false;

    private bool $connected = false;

    private bool $ready = false;

    private bool $heartbeatRunning = false;

    private ?string $lastErrorMessage = null;

    private ?string $lastErrorType = null;

    private float $lastErrorAt = 0.0;

    private ?string $lastConnectErrorSignature = null;

    private float $lastConnectErrorLoggedAt = 0.0;

    private int $suppressedConnectErrorLogs = 0;

    public function __construct(
        private readonly FramedTransportInterface $transport,
        private readonly DataFormatterInterface $dataFormatter,
        private readonly ClientConfig $config
    ) {
    }

    public function connect(bool $silent = false): bool
    {
        if ($this->connected && $this->ready && $this->transport->isConnected()) {
            return true;
        }

        $overallStart = microtime(true);

        try {
            $connectStart = microtime(true);
            $this->transport->connect();
            $connectMs = (microtime(true) - $connectStart) * 1000.0;

            $this->connected = true;
            $this->running = true;
            $this->ready = false;

            go(function () {
                $this->readLoop();
            });

            $helloStart = microtime(true);
            if (! $this->performHandshake($silent)) {
                $this->close($silent);
                return false;
            }
            $helloMs = (microtime(true) - $helloStart) * 1000.0;

            $readyStart = microtime(true);
            $this->ready = true;
            $this->startHeartbeat();
            $readyMs = (microtime(true) - $readyStart) * 1000.0;
            $totalMs = (microtime(true) - $overallStart) * 1000.0;

            $this->logger->info('RPC runtime client connected over IPC', [
                'endpoint' => $this->transport->getEndpointLabel(),
                'total_ms' => $this->formatDurationMs($totalMs),
                'connect_ms' => $this->formatDurationMs($connectMs),
                'hello_ms' => $this->formatDurationMs($helloMs),
                'ready_ms' => $this->formatDurationMs($readyMs),
            ]);
            $this->clearLastError();
            $this->lastConnectErrorSignature = null;
            $this->lastConnectErrorLoggedAt = 0.0;
            $this->suppressedConnectErrorLogs = 0;
            return true;
        } catch (Throwable $e) {
            $this->rememberError('connect', $e);
            $signature = $this->transport->getEndpointLabel() . '|' . $e->getMessage();
            $now = microtime(true);
            if (! $silent) {
                $sameSignature = $this->lastConnectErrorSignature === $signature;
                $withinLogWindow = ($now - $this->lastConnectErrorLoggedAt) <= 30.0;
                if ($sameSignature && $withinLogWindow) {
                    ++$this->suppressedConnectErrorLogs;
                } elseif ($sameSignature) {
                    $this->logger->warning('RPC runtime connect still failing', [
                        'endpoint' => $this->transport->getEndpointLabel(),
                        'error' => $e->getMessage(),
                        'suppressed_logs' => $this->suppressedConnectErrorLogs,
                    ]);
                    $this->lastConnectErrorLoggedAt = $now;
                    $this->suppressedConnectErrorLogs = 0;
                } else {
                    $this->logger->error('RPC runtime connect failed', [
                        'endpoint' => $this->transport->getEndpointLabel(),
                        'error' => $e->getMessage(),
                        'suppressed_logs' => $this->suppressedConnectErrorLogs,
                    ]);
                    $this->lastConnectErrorLoggedAt = $now;
                    $this->suppressedConnectErrorLogs = 0;
                }
            }
            $this->lastConnectErrorSignature = $signature;
            $this->transport->close();
            return false;
        }
    }

    public function call(string $method, mixed $params = null, float $timeout = 30.0): mixed
    {
        return $this->sendRequest($method, $params, $timeout, true);
    }

    public function registerHandler(string $method, callable $handler): void
    {
        $this->handlers[$method] = $handler;
    }

    public function close(bool $silent = false): void
    {
        $this->running = false;
        $this->connected = false;
        $this->ready = false;
        $this->heartbeatRunning = false;

        $this->transport->close();

        foreach ($this->pending as $channel) {
            $channel->push(false);
        }
        $this->pending = [];

        if (! $silent) {
            $this->logger->info('RPC runtime client closed');
        }
    }

    public function isConnected(): bool
    {
        return $this->connected && $this->ready && $this->transport->isConnected();
    }

    public function getLastError(): ?array
    {
        if ($this->lastErrorMessage === null || $this->lastErrorAt <= 0) {
            return null;
        }

        $errorAt = date(DATE_ATOM, (int) $this->lastErrorAt);

        return [
            'type' => $this->lastErrorType,
            'message' => $this->lastErrorMessage,
            'at' => $errorAt,
        ];
    }

    private function readLoop(): void
    {
        while ($this->running && $this->connected) {
            try {
                $body = $this->transport->readFrame();
                $this->handleMessage($body);
            } catch (Throwable $e) {
                $this->rememberError('read_loop', $e);
                $this->logger->error('RPC runtime read loop error', [
                    'endpoint' => $this->transport->getEndpointLabel(),
                    'error' => $e->getMessage(),
                ]);
                $this->close();
                break;
            }
        }
    }

    private function handleMessage(string $json): void
    {
        try {
            $data = Json::decode($json);
            if (! is_array($data)) {
                return;
            }

            if (isset($data['method'])) {
                $this->handleServerRequest($data, $json);
            } elseif (isset($data['id'])) {
                $this->handleResponse($data);
            }
        } catch (Throwable $e) {
            $this->rememberError('message_handle', $e);
            $this->logger->error('RPC runtime message handle error', ['error' => $e->getMessage()]);
        }
    }

    private function handleResponse(array $data): void
    {
        $id = $data['id'] ?? null;
        if ($id !== null && isset($this->pending[$id])) {
            $this->pending[$id]->push($data);
        } elseif ($id !== null) {
            $this->logger->debug('RPC runtime response with unknown id', [
                'id' => $id,
            ]);
        }
    }

    private function handleServerRequest(array $data, string $rawJson): void
    {
        $method = $data['method'] ?? '';
        $id = $data['id'] ?? null;
        $params = $data['params'] ?? null;

        if ($method === SvcMethods::IPC_PING) {
            if ($id !== null) {
                $this->sendResponse($id, ['ok' => true]);
            }
            return;
        }

        $start = microtime(true);
        $this->logRequest('recv', $method, $id, $data, $rawJson);

        $handler = $this->handlers[$method] ?? null;

        if ($handler) {
            go(function () use ($handler, $params, $id, $method) {
                $start = microtime(true);
                try {
                    $result = $handler($params);
                    if ($id !== null) {
                        $this->sendResponse($id, $result);
                    }
                    $this->logResponse('recv', $method, $id, $result, $start);
                } catch (Throwable $e) {
                    if ($id !== null) {
                        $this->sendError($id, -32603, $e->getMessage());
                    }
                    $this->logResponse('recv', $method, $id, $e->getMessage(), $start);
                }
            });
        } elseif ($id !== null) {
            $this->sendError($id, -32601, sprintf('Method not found: %s', $method));
            $this->logResponse('recv', $method, $id, ['code' => -32601, 'message' => sprintf('Method not found: %s', $method)], $start);
        }
    }

    private function sendRequest(string $method, mixed $params, float $timeout, bool $requireReady): mixed
    {
        if (! $this->connected || ! $this->transport->isConnected()) {
            throw new RuntimeException('RPC transport not connected');
        }
        if ($requireReady && ! $this->ready) {
            throw new RuntimeException('RPC runtime not ready');
        }
        if ($this->config->maxPendingRequests > 0 && count($this->pending) >= $this->config->maxPendingRequests) {
            throw new RuntimeException('RPC pending requests limit reached');
        }

        $id = $this->nextId++;
        $rpcRequest = new RpcRequest($method, $params ?? [], $id, $this->buildRequestContext());
        $payload = $this->dataFormatter->formatRequest($rpcRequest);

        $channel = new Channel(1);
        $this->pending[$id] = $channel;
        $start = microtime(true);

        try {
            try {
                // 发送失败通常意味着底层连接异常，需要主动断开并交给重连逻辑接管。
                $requestJson = $this->sendPacket($payload);
                $this->logRequest('send', $method, $id, $payload, $requestJson);
            } catch (Throwable $e) {
                $this->rememberError('request_send', $e);
                $this->logResponse('send', $method, $id, $e->getMessage(), $start);
                $this->close();
                throw $e;
            }

            try {
                $response = $channel->pop($timeout);
            } catch (Throwable $e) {
                $this->rememberError('request_wait', $e);
                $this->logResponse('send', $method, $id, $e->getMessage(), $start);
                $this->close();
                throw $e;
            }

            if ($response === false) {
                $timeoutError = new RuntimeException('RPC timeout');
                $this->rememberError('request_timeout', $timeoutError);
                $this->logResponse('send', $method, $id, 'timeout', $start);
                throw $timeoutError;
            }

            if (isset($response['error'])) {
                $remoteError = $this->buildRemoteErrorException($response);
                $this->rememberError('request_remote_error', $remoteError);
                $this->logResponse('send', $method, $id, $response['error'], $start);
                throw $remoteError;
            }

            $this->logResponse('send', $method, $id, $response['result'] ?? null, $start);
            return $response['result'] ?? null;
        } finally {
            unset($this->pending[$id]);
        }
    }

    private function performHandshake(bool $silent = false): bool
    {
        $params = [
            'protocol_version' => $this->config->protocolVersion,
            'client_id' => $this->resolveClientId(),
            'pid' => getmypid() ?: 0,
            'capabilities' => $this->getCapabilities(),
            'auth_token' => $this->config->authToken,
            'max_message_bytes' => $this->config->maxMessageBytes,
        ];

        try {
            $this->sendRequest(SvcMethods::IPC_HELLO, $params, max(1.0, $this->config->readTimeout), false);
            return true;
        } catch (Throwable $e) {
            $this->rememberError('handshake', $e);
            if (! $silent) {
                $this->logger->error('RPC runtime handshake failed', ['error' => $e->getMessage()]);
            }
            return false;
        }
    }

    private function startHeartbeat(): void
    {
        if ($this->config->heartbeatInterval <= 0 || $this->heartbeatRunning) {
            return;
        }
        $this->heartbeatRunning = true;

        go(function () {
            while ($this->running) {
                Coroutine::sleep($this->config->heartbeatInterval);
                if (! $this->isConnected()) {
                    break;
                }
                try {
                    $this->sendRequest(SvcMethods::IPC_PING, null, max(1.0, $this->config->heartbeatTimeout), false);
                } catch (Throwable $e) {
                    $this->rememberError('heartbeat', $e);
                    $this->logger->warning('RPC runtime heartbeat failed', ['error' => $e->getMessage()]);
                    $this->close();
                    break;
                }
            }
            $this->heartbeatRunning = false;
        });
    }

    private function resolveClientId(): string
    {
        if ($this->config->clientId !== '') {
            return $this->config->clientId;
        }
        $host = gethostname() ?: 'unknown';
        $pid = getmypid() ?: 0;
        return $host . ':' . $pid;
    }

    /**
     * @return string[]
     */
    private function getCapabilities(): array
    {
        return array_keys($this->handlers);
    }

    private function shouldLogMethod(string $method): bool
    {
        return $method !== SvcMethods::IPC_HELLO && $method !== SvcMethods::IPC_PING;
    }

    private function formatDurationMs(float $durationMs): float
    {
        return round($durationMs, 2);
    }

    private function encodePayload(mixed $payload, ?string $encodedPayload = null): array
    {
        if ($encodedPayload !== null) {
            $json = $encodedPayload;
            $bytes = strlen($json);
            $truncated = false;
            if ($bytes > self::LOG_PAYLOAD_LIMIT) {
                $json = '...(truncated)';
                $truncated = true;
            }
            return [$json, $bytes, $truncated];
        }

        if ($payload === null) {
            return ['null', 0, false];
        }

        $json = Json::encode($payload);
        $bytes = strlen($json);
        $truncated = false;
        if ($bytes > self::LOG_PAYLOAD_LIMIT) {
            $json = '...(truncated)';
            $truncated = true;
        }
        return [$json, $bytes, $truncated];
    }

    private function logRequest(string $direction, string $method, mixed $id, mixed $payload, ?string $encodedPayload = null): void
    {
        if (! $this->shouldLogMethod($method)) {
            return;
        }
        [$text, $bytes, $truncated] = $this->encodePayload($payload, $encodedPayload);
        $this->logger->info('RPC request', [
            'direction' => $direction,
            'method' => $method,
            'id' => $id,
            'payload_log_limit' => self::LOG_PAYLOAD_LIMIT,
            'request_bytes' => $bytes,
            'request_truncated' => $truncated,
            'request' => $text,
        ]);
    }

    private function logResponse(string $direction, string $method, mixed $id, mixed $payload, float $start, ?string $encodedPayload = null): void
    {
        if (! $this->shouldLogMethod($method)) {
            return;
        }
        [$text, $bytes, $truncated] = $this->encodePayload($payload, $encodedPayload);
        $durationMs = (microtime(true) - $start) * 1000.0;
        $this->logger->info('RPC response', [
            'direction' => $direction,
            'method' => $method,
            'id' => $id,
            'payload_log_limit' => self::LOG_PAYLOAD_LIMIT,
            'response_bytes' => $bytes,
            'response_truncated' => $truncated,
            'duration_ms' => $this->formatDurationMs($durationMs),
            'response' => $text,
        ]);
    }

    private function sendResponse(mixed $id, mixed $result): void
    {
        $payload = [
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => $result,
        ];
        try {
            $this->sendPacket($payload);
        } catch (Throwable $e) {
            $this->logger->error('RPC send response failed', ['error' => $e->getMessage()]);
        }
    }

    private function sendError(mixed $id, int $code, string $message): void
    {
        $payload = [
            'jsonrpc' => '2.0',
            'id' => $id,
            'error' => ['code' => $code, 'message' => $message],
        ];
        try {
            $this->sendPacket($payload);
        } catch (Throwable $e) {
            $this->logger->error('RPC send error failed', ['error' => $e->getMessage()]);
        }
    }

    private function sendPacket(array $payload): string
    {
        $json = Json::encode($payload);
        $this->transport->writeFrame($json);
        return $json;
    }

    /**
     * @return array<string, string>
     */
    private function buildRequestContext(): array
    {
        $requestId = CoContext::getRequestId();
        if ($requestId === '') {
            return [];
        }

        return ['request_id' => $requestId];
    }

    private function rememberError(string $type, Throwable $throwable): void
    {
        $this->lastErrorType = $type;
        $this->lastErrorMessage = $throwable->getMessage();
        $this->lastErrorAt = microtime(true);
    }

    private function clearLastError(): void
    {
        $this->lastErrorType = null;
        $this->lastErrorMessage = null;
        $this->lastErrorAt = 0.0;
    }

    /**
     * @param array<string, mixed> $response
     */
    private function buildRemoteErrorException(array $response): BusinessException
    {
        /** @var array<string, mixed> $error */
        $error = is_array($response['error'] ?? null) ? $response['error'] : [];
        $message = (string) ($error['message'] ?? 'Unknown error');
        $code = (int) ($error['code'] ?? -1);
        return new BusinessException($message, $code);
    }
}
