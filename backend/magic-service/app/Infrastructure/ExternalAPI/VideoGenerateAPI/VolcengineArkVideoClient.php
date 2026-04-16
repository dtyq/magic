<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Infrastructure\Core\Traits\HasLogger;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use Throwable;

readonly class VolcengineArkVideoClient
{
    use HasLogger;

    // Seedance 任务创建在高峰期可能长时间挂起，请求超时放宽到 180 秒避免 30 秒过早中断。
    private const int REQUEST_TIMEOUT_SECONDS = 180;

    public function __construct(
        private ClientFactory $clientFactory,
        ?LoggerFactory $loggerFactory = null,
    ) {
        if ($loggerFactory !== null) {
            $this->logger = $loggerFactory->get(self::class);
        }
    }

    public function post(string $baseUrl, string $apiKey, string $path, array $payload, array $logContext = []): array
    {
        return $this->requestJson(
            'post',
            $baseUrl,
            $apiKey,
            $path,
            ['json' => $payload],
            $logContext,
        );
    }

    public function get(string $baseUrl, string $apiKey, string $path, array $logContext = []): array
    {
        return $this->requestJson(
            'get',
            $baseUrl,
            $apiKey,
            $path,
            [],
            $logContext,
        );
    }

    private function createClient(): Client
    {
        return $this->clientFactory->create([
            'timeout' => self::REQUEST_TIMEOUT_SECONDS,
            'verify' => false,
        ]);
    }

    private function requestJson(
        string $method,
        string $baseUrl,
        string $apiKey,
        string $path,
        array $options,
        array $logContext,
    ): array {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $startedAt = microtime(true);

        $this->logger->info('volcengine ark video request', [
            'method' => $method,
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $logContext,
            'payload' => $options['json'] ?? null,
        ]);

        try {
            $requestOptions = array_merge([
                'headers' => [
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ],
            ], $options);
            $response = match ($method) {
                'post' => $this->createClient()->post($normalizedBaseUrl . $normalizedPath, $requestOptions),
                'get' => $this->createClient()->get($normalizedBaseUrl . $normalizedPath, $requestOptions),
                default => throw new ProviderVideoException(sprintf('unsupported volcengine ark video method %s', $method)),
            };
            $data = Json::decode((string) $response->getBody());
        } catch (RequestException $exception) {
            $this->logger->error('volcengine ark video error', [
                'method' => $method,
                'base_url' => $normalizedBaseUrl,
                'path' => $normalizedPath,
                'context' => $logContext,
                'http_status' => $exception->getResponse()?->getStatusCode(),
                'elapsed_ms' => $this->calculateElapsedMilliseconds($startedAt),
                'error' => $this->formatRequestExceptionMessage($exception, $method),
            ]);
            throw new ProviderVideoException($this->formatRequestExceptionMessage($exception, $method), $exception);
        } catch (Throwable $throwable) {
            $this->logger->error('volcengine ark video error', [
                'method' => $method,
                'base_url' => $normalizedBaseUrl,
                'path' => $normalizedPath,
                'context' => $logContext,
                'http_status' => null,
                'provider_request_id' => null,
                'elapsed_ms' => $this->calculateElapsedMilliseconds($startedAt),
                'error' => sprintf('volcengine ark video %s failed: %s', $method, $throwable->getMessage()),
            ]);
            throw new ProviderVideoException(sprintf('volcengine ark video %s failed: %s', $method, $throwable->getMessage()), $throwable);
        }

        if (! is_array($data)) {
            throw new ProviderVideoException(sprintf('volcengine ark video %s returned invalid json', $method));
        }

        $this->logger->info('volcengine ark video response', [
            'method' => $method,
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $logContext,
            'http_status' => $response->getStatusCode(),
            'elapsed_ms' => $this->calculateElapsedMilliseconds($startedAt),
            'response' => $data,
        ]);

        return $data;
    }

    private function calculateElapsedMilliseconds(float $startedAt): int
    {
        return max(0, (int) round((microtime(true) - $startedAt) * 1000));
    }

    private function formatRequestExceptionMessage(RequestException $exception, string $action): string
    {
        if (! $exception->hasResponse()) {
            return sprintf('volcengine ark video %s failed: %s', $action, $exception->getMessage());
        }

        $response = $exception->getResponse();
        $statusCode = $response?->getStatusCode() ?? 0;
        $reason = $response?->getReasonPhrase() ?? 'unknown';
        $body = trim((string) $response?->getBody());
        if ($body === '') {
            return sprintf('volcengine ark video %s failed: HTTP %d %s', $action, $statusCode, $reason);
        }

        $trimmedBody = trim($body);
        if ($trimmedBody !== '' && in_array($trimmedBody[0], ['{', '['], true)) {
            try {
                $payload = Json::decode($trimmedBody);
                if (is_array($payload)) {
                    $error = is_array($payload['error'] ?? null) ? $payload['error'] : [];
                    $message = $payload['message'] ?? $payload['msg'] ?? $error['message'] ?? null;
                    if (is_string($message) && trim($message) !== '') {
                        return trim($message);
                    }
                }
            } catch (Throwable) {
            }
        }

        return sprintf(
            'volcengine ark video %s failed: HTTP %d %s: %s',
            $action,
            $statusCode,
            $reason,
            $body,
        );
    }
}
