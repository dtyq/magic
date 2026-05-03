<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope;

use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use Throwable;

readonly class DashScopeVideoClient
{
    use HasLogger;

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
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $sanitizedLogContext = $this->sanitizeForLog($logContext);
        $this->logger->info('dashscope video post request', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
            'payload' => $this->sanitizeForLog($payload),
        ]);

        try {
            $data = $this->requestJson(
                fn (): array => Json::decode((string) $this->createClient()->post(
                    $normalizedBaseUrl . $normalizedPath,
                    [
                        'headers' => [
                            'Authorization' => 'Bearer ' . $apiKey,
                            'Content-Type' => 'application/json',
                            'X-DashScope-Async' => 'enable',
                        ],
                        'json' => $payload,
                    ],
                )->getBody()),
                'post',
            );
        } catch (ProviderVideoException $exception) {
            $this->logger->error('dashscope video post error', [
                'base_url' => $normalizedBaseUrl,
                'path' => $normalizedPath,
                'context' => $sanitizedLogContext,
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        $this->logger->info('dashscope video post response', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
            'response' => $this->sanitizeForLog($data),
        ]);

        return $data;
    }

    public function get(string $baseUrl, string $apiKey, string $path, array $logContext = []): array
    {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $sanitizedLogContext = $this->sanitizeForLog($logContext);
        $this->logger->info('dashscope video get request', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
        ]);

        try {
            $data = $this->requestJson(
                fn (): array => Json::decode((string) $this->createClient()->get(
                    $normalizedBaseUrl . $normalizedPath,
                    [
                        'headers' => [
                            'Authorization' => 'Bearer ' . $apiKey,
                            'Content-Type' => 'application/json',
                        ],
                    ],
                )->getBody()),
                'get',
            );
        } catch (ProviderVideoException $exception) {
            $this->logger->error('dashscope video get error', [
                'base_url' => $normalizedBaseUrl,
                'path' => $normalizedPath,
                'context' => $sanitizedLogContext,
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        $this->logger->info('dashscope video get response', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
            'response' => $this->sanitizeForLog($data),
        ]);

        return $data;
    }

    private function createClient(): Client
    {
        return $this->clientFactory->create([
            'timeout' => 30,
            'verify' => false,
        ]);
    }

    private function requestJson(callable $request, string $action): array
    {
        try {
            $data = $request();
        } catch (RequestException $exception) {
            throw new ProviderVideoException($this->formatRequestExceptionMessage($exception, $action), $exception);
        } catch (Throwable $throwable) {
            throw new ProviderVideoException(sprintf('dashscope video %s failed: %s', $action, $throwable->getMessage()), $throwable);
        }

        if (! is_array($data)) {
            throw new ProviderVideoException(sprintf('dashscope video %s returned invalid json', $action));
        }

        $this->assertProviderSuccess($data, $action);

        return $data;
    }

    private function assertProviderSuccess(array $data, string $action): void
    {
        if (! array_key_exists('code', $data)) {
            return;
        }

        $code = $data['code'];
        if ($code === 0 || $code === '0' || $code === null || $code === '') {
            return;
        }

        $message = $this->extractProviderMessage($data) ?? 'unknown provider error';
        throw new ProviderVideoException(sprintf('dashscope video %s failed: %s', $action, $message));
    }

    private function formatRequestExceptionMessage(RequestException $exception, string $action): string
    {
        if (! $exception->hasResponse()) {
            return sprintf('dashscope video %s failed: %s', $action, $exception->getMessage());
        }

        $response = $exception->getResponse();
        $statusCode = $response?->getStatusCode() ?? 0;
        $reason = $response?->getReasonPhrase() ?? 'unknown';
        $body = trim((string) $response?->getBody());

        if ($body === '') {
            return sprintf('dashscope video %s failed: HTTP %d %s', $action, $statusCode, $reason);
        }

        $providerMessage = $this->extractProviderMessageFromBody($body);
        return $providerMessage ?? sprintf(
            'dashscope video %s failed: HTTP %d %s: %s',
            $action,
            $statusCode,
            $reason,
            $this->sanitizeResponseBody($body),
        );
    }

    private function extractProviderMessageFromBody(string $body): ?string
    {
        try {
            $decoded = Json::decode($body);
        } catch (Throwable) {
            return null;
        }

        if (! is_array($decoded)) {
            return null;
        }

        return $this->extractProviderMessage($decoded);
    }

    private function extractProviderMessage(array $data): ?string
    {
        foreach ([
            is_array($data['error'] ?? null) ? ($data['error']['message'] ?? null) : null,
            $data['message'] ?? null,
            $data['msg'] ?? null,
            is_array($data['output'] ?? null) ? ($data['output']['message'] ?? null) : null,
            is_array($data['output'] ?? null) ? ($data['output']['task_status_msg'] ?? null) : null,
        ] as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return null;
    }

    private function sanitizeForLog(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $sanitized = [];
        foreach ($value as $key => $item) {
            $sanitized[$key] = is_array($item) ? $this->sanitizeForLog($item) : $item;
        }

        return $sanitized;
    }

    private function sanitizeResponseBody(string $body): string
    {
        return strlen($body) > 1024 ? substr($body, 0, 1024) . '...(truncated)' : $body;
    }
}
