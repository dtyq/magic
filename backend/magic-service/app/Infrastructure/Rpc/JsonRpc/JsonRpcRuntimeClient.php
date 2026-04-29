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
use App\Infrastructure\Transport\Ipc\Uds\DecodedFrameResult;
use App\Infrastructure\Transport\Ipc\Uds\IpcFrameCodec;
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

    private int $lastHandshakeServerLimitBytes = 0;

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

    /**
     * @throws Throwable
     */
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
                'client_limit_bytes' => $this->config->maxMessageBytes,
                'server_limit_bytes' => $this->lastHandshakeServerLimitBytes,
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
                    $this->logger->warning('goEngineException RPC runtime connect still failing', [
                        'endpoint' => $this->transport->getEndpointLabel(),
                        'error' => $e->getMessage(),
                        'suppressed_logs' => $this->suppressedConnectErrorLogs,
                    ]);
                    $this->lastConnectErrorLoggedAt = $now;
                    $this->suppressedConnectErrorLogs = 0;
                } else {
                    $this->logger->error('goEngineException RPC runtime connect failed', [
                        'endpoint' => $this->transport->getEndpointLabel(),
                        'error' => $e->getMessage(),
                        'suppressed_logs' => $this->suppressedConnectErrorLogs,
                    ]);
                    $this->lastConnectErrorLoggedAt = $now;
                    $this->suppressedConnectErrorLogs = 0;
                }
            }
            $this->lastConnectErrorSignature = $signature;
            $this->closeTransport($silent);
            return false;
        }
    }

    /**
     * @throws Throwable
     */
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

        $this->closeTransport($silent);
        $this->releasePendingRequests();
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
                $frame = $this->transport->readFrame();
                $this->handleMessage($frame->payload, $frame);
            } catch (Throwable $e) {
                $this->rememberError('read_loop', $e);
                $this->logger->error('goEngineException RPC runtime read loop error', [
                    'endpoint' => $this->transport->getEndpointLabel(),
                    'error' => $e->getMessage(),
                ]);
                $this->close();
                break;
            }
        }
    }

    private function handleMessage(string $json, ?DecodedFrameResult $decodedFrame = null): void
    {
        try {
            $data = Json::decode($json);
            if (! is_array($data)) {
                return;
            }

            if (isset($data['method'])) {
                $this->handleServerRequest($data, $json);
            } elseif (isset($data['id'])) {
                $this->handleResponse($data, $decodedFrame);
            }
        } catch (Throwable $e) {
            $this->rememberError('message_handle', $e);
            $this->logger->error('goEngineException RPC runtime message handle error', ['error' => $e->getMessage()]);
        }
    }

    private function handleResponse(array $data, ?DecodedFrameResult $decodedFrame = null): void
    {
        $id = $data['id'] ?? null;
        if ($id !== null && isset($this->pending[$id])) {
            $this->pending[$id]->push([
                'response' => $data,
                'decoded_frame' => $decodedFrame,
            ]);
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
            go(function () use ($handler, $params, $id, $method, $start) {
                $handlerStartedAt = microtime(true);
                try {
                    $result = $handler($params);
                    $logPayload = $this->buildResultPayload($id, $result) ?? $result;
                    $responsePayload = $this->buildResultPayload($id, $result);
                    $this->dispatchServerResponse(
                        $method,
                        $id,
                        $logPayload,
                        $responsePayload,
                        $start,
                        (microtime(true) - $handlerStartedAt) * 1000.0
                    );
                } catch (Throwable $e) {
                    $logPayload = $this->buildErrorPayload($id, -32603, $e->getMessage()) ?? $e->getMessage();
                    $responsePayload = $this->buildErrorPayload($id, -32603, $e->getMessage());
                    $this->dispatchServerResponse(
                        $method,
                        $id,
                        $logPayload,
                        $responsePayload,
                        $start,
                        (microtime(true) - $handlerStartedAt) * 1000.0
                    );
                }
            });
        } elseif ($id !== null) {
            $errorPayload = $this->buildErrorPayload($id, -32601, sprintf('Method not found: %s', $method));
            $this->dispatchServerResponse($method, $id, $errorPayload, $errorPayload, $start, 0.0);
        }
    }

    private function dispatchServerResponse(
        string $method,
        mixed $id,
        mixed $logPayload,
        ?array $responsePayload,
        float $requestStartedAt,
        float $handlerDurationMs
    ): void {
        go(function () use ($method, $id, $logPayload, $responsePayload, $requestStartedAt, $handlerDurationMs) {
            $sendStartedAt = microtime(true);
            $encodedPayload = null;

            if ($responsePayload !== null) {
                try {
                    $encodedPayload = $this->sendPacket($responsePayload);
                } catch (Throwable $e) {
                    $this->logger->error('goEngineException RPC send response failed', [
                        'method' => $method,
                        'id' => $id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $this->logResponse(
                'recv',
                $method,
                $id,
                $logPayload,
                $requestStartedAt,
                $encodedPayload,
                [
                    'handler_duration_ms' => $this->formatDurationMs($handlerDurationMs),
                    'send_duration_ms' => $this->formatDurationMs((microtime(true) - $sendStartedAt) * 1000.0),
                ]
            );
        });
    }

    /**
     * @throws Throwable
     */
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

            $decodedFrame = null;
            if (is_array($response) && array_key_exists('response', $response)) {
                $decodedFrame = $response['decoded_frame'] instanceof DecodedFrameResult ? $response['decoded_frame'] : null;
                $response = $response['response'];
            }

            if (isset($response['error'])) {
                $remoteError = $this->buildRemoteErrorException($response);
                $this->rememberError('request_remote_error', $remoteError);
                $this->logResponse('send', $method, $id, $response, $start, null, [], $decodedFrame);
                throw $remoteError;
            }

            $this->logResponse('send', $method, $id, $response, $start, null, [], $decodedFrame);
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
            $result = $this->sendRequest(SvcMethods::IPC_HELLO, $params, max(1.0, $this->config->readTimeout), false);
            $this->lastHandshakeServerLimitBytes = is_array($result) ? (int) ($result['max_message_bytes'] ?? 0) : 0;
            return true;
        } catch (Throwable $e) {
            $this->rememberError('handshake', $e);
            if (! $silent) {
                $this->logger->error('goEngineException RPC runtime handshake failed', [
                    'client_limit_bytes' => $this->config->maxMessageBytes,
                    'error' => $e->getMessage(),
                ]);
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
                    $this->logger->warning('goEngineException RPC runtime heartbeat failed', ['error' => $e->getMessage()]);
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

    private function encodePayload(mixed $payload, ?string $encodedPayload = null, ?DecodedFrameResult $decodedFrame = null): array
    {
        if ($decodedFrame !== null) {
            $bytes = strlen($decodedFrame->payload);
            $truncated = false;
            $payloadForLog = $decodedFrame->payload;
            if ($bytes > self::LOG_PAYLOAD_LIMIT) {
                $payloadForLog = '...(truncated)';
                $truncated = true;
            }

            return [
                $payloadForLog,
                $bytes,
                $truncated,
                $decodedFrame->rawJsonBytes,
                $decodedFrame->frameBytes,
                $decodedFrame->frameCodec,
            ];
        }

        if ($encodedPayload !== null) {
            return $this->summarizeEncodedPayload($encodedPayload);
        }

        if ($payload === null) {
            return ['null', 0, false, 0, 0, ''];
        }

        $json = Json::encode($payload);
        return $this->summarizeEncodedPayload($json);
    }

    private function logRequest(string $direction, string $method, mixed $id, mixed $payload, ?string $encodedPayload = null): void
    {
        if (! $this->shouldLogMethod($method)) {
            return;
        }
        [$text, $bytes, $truncated, $rawJsonBytes, $frameBytes, $frameCodec] = $this->encodePayload($payload, $encodedPayload);
        $this->logger->info('RPC request', [
            'direction' => $direction,
            'method' => $method,
            'id' => $id,
            'payload_log_limit' => self::LOG_PAYLOAD_LIMIT,
            'request_bytes' => $bytes,
            'raw_json_bytes' => $rawJsonBytes,
            'frame_bytes' => $frameBytes,
            'frame_codec' => $frameCodec,
            'request_truncated' => $truncated,
            'request' => $text,
        ]);
    }

    private function logResponse(
        string $direction,
        string $method,
        mixed $id,
        mixed $payload,
        float $start,
        ?string $encodedPayload = null,
        array $extraContext = [],
        ?DecodedFrameResult $decodedFrame = null,
    ): void {
        if (! $this->shouldLogMethod($method)) {
            return;
        }
        [$text, $bytes, $truncated, $rawJsonBytes, $frameBytes, $frameCodec] = $this->encodePayload($payload, $encodedPayload, $decodedFrame);
        $durationMs = (microtime(true) - $start) * 1000.0;

        $context = [
            'direction' => $direction,
            'method' => $method,
            'id' => $id,
            'payload_log_limit' => self::LOG_PAYLOAD_LIMIT,
            'response_bytes' => $bytes,
            'raw_json_bytes' => $rawJsonBytes,
            'frame_bytes' => $frameBytes,
            'frame_codec' => $frameCodec,
            'response_truncated' => $truncated,
            'duration_ms' => $this->formatDurationMs($durationMs),
            'response' => $text,
        ];

        if ($extraContext !== []) {
            $context = array_merge($context, $extraContext);
        }

        $this->logger->info('RPC response', $context);
    }

    private function sendResponse(mixed $id, mixed $result): void
    {
        $payload = $this->buildResultPayload($id, $result);
        try {
            if ($payload !== null) {
                $this->sendPacket($payload);
            }
        } catch (Throwable $e) {
            $this->logger->error('goEngineException RPC send response failed', ['error' => $e->getMessage()]);
        }
    }

    private function buildResultPayload(mixed $id, mixed $result): ?array
    {
        if ($id === null) {
            return null;
        }

        return [
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => $result,
        ];
    }

    private function buildErrorPayload(mixed $id, int $code, string $message): ?array
    {
        if ($id === null) {
            return null;
        }

        return [
            'jsonrpc' => '2.0',
            'id' => $id,
            'error' => ['code' => $code, 'message' => $message],
        ];
    }

    private function sendPacket(array $payload): string
    {
        $json = Json::encode($payload);
        $this->transport->writeFrame($json);
        return $json;
    }

    private function summarizeEncodedPayload(string $json): array
    {
        $bytes = strlen($json);
        $truncated = false;
        $payloadForLog = $json;
        $frameSummary = IpcFrameCodec::summarizeJson($json);
        if ($bytes > self::LOG_PAYLOAD_LIMIT) {
            $payloadForLog = '...(truncated)';
            $truncated = true;
        }

        return [
            $payloadForLog,
            $bytes,
            $truncated,
            $frameSummary['raw_json_bytes'],
            $frameSummary['frame_bytes'],
            $frameSummary['frame_codec'],
        ];
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

    private function closeTransport(bool $silent = false): void
    {
        try {
            $this->transport->close();
        } catch (Throwable $e) {
            $this->rememberError('close_transport', $e);
            if (! $silent) {
                $this->logger->warning('goEngineException RPC runtime transport close failed', ['error' => $e->getMessage()]);
            }
        }
    }

    private function releasePendingRequests(): void
    {
        foreach ($this->pending as $id => $channel) {
            try {
                $channel->push(false);
            } catch (Throwable $e) {
                $this->rememberError('release_pending', $e);
                $this->logger->warning('goEngineException RPC runtime release pending request failed', [
                    'id' => $id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
