<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling;

use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use Throwable;

readonly class KelingVideoClient
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

    public function post(string $baseUrl, string $bearerToken, string $path, array $payload, array $logContext = []): array
    {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $sanitizedLogContext = $this->sanitizeForLog($logContext);
        $this->logger->info('keling video post request', [
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
                            'Authorization' => 'Bearer ' . $bearerToken,
                            'Content-Type' => 'application/json',
                        ],
                        'json' => $payload,
                    ],
                )->getBody()),
                'post',
            );
        } catch (ProviderVideoException $exception) {
            $this->logger->error('keling video post error', [
                'base_url' => $normalizedBaseUrl,
                'path' => $normalizedPath,
                'context' => $sanitizedLogContext,
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        $this->logger->info('keling video post response', [
            'base_url' => $normalizedBaseUrl,
            'path' => $normalizedPath,
            'context' => $sanitizedLogContext,
            'response' => $this->sanitizeForLog($data),
        ]);

        return $data;
    }

    public function get(string $baseUrl, string $bearerToken, string $path, array $logContext = []): array
    {
        $normalizedBaseUrl = rtrim($baseUrl, '/');
        $normalizedPath = '/' . ltrim($path, '/');
        $sanitizedLogContext = $this->sanitizeForLog($logContext);
        $this->logger->info('keling video get request', [
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
                            'Authorization' => 'Bearer ' . $bearerToken,
                            'Content-Type' => 'application/json',
                        ],
                    ],
                )->getBody()),
                'get',
            );
        } catch (ProviderVideoException $exception) {
            $this->logger->error('keling video get error', [
                'base_url' => $normalizedBaseUrl,
                'path' => $normalizedPath,
                'context' => $sanitizedLogContext,
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        $this->logger->info('keling video get response', [
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
            throw new ProviderVideoException(sprintf('keling video %s failed: %s', $action, $throwable->getMessage()), $throwable);
        }

        if (! is_array($data)) {
            throw new ProviderVideoException(sprintf('keling video %s returned invalid json', $action));
        }

        return $data;
    }

    private function formatRequestExceptionMessage(RequestException $exception, string $action): string
    {
        if (! $exception->hasResponse()) {
            return sprintf('keling video %s failed: %s', $action, $exception->getMessage());
        }

        $response = $exception->getResponse();
        $statusCode = $response?->getStatusCode() ?? 0;
        $reason = $response?->getReasonPhrase() ?? 'unknown';
        $body = trim((string) $response?->getBody());

        if ($body === '') {
            return sprintf('keling video %s failed: HTTP %d %s', $action, $statusCode, $reason);
        }

        $providerMessage = $this->extractProviderMessageFromBody($body);
        return $providerMessage ?? sprintf(
            'keling video %s failed: HTTP %d %s: %s',
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

        foreach ([
            is_array($decoded['error'] ?? null) ? ($decoded['error']['message'] ?? null) : null,
            $decoded['message'] ?? null,
            $decoded['msg'] ?? null,
            is_array($decoded['data'] ?? null) ? ($decoded['data']['message'] ?? null) : null,
            is_array($decoded['data']['error'] ?? null) ? ($decoded['data']['error']['message'] ?? null) : null,
            is_array($decoded['data'] ?? null) ? ($decoded['data']['task_status_msg'] ?? null) : null,
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
