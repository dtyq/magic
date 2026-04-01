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

readonly class WuyinVideoClient
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

    public function submit(string $baseUrl, string $apiKey, string $modelVersion, array $payload): array
    {
        $normalizedBaseUrl = $this->normalizeBaseUrl($baseUrl);
        $endpoint = VideoSubmitEndpointResolver::resolve($modelVersion);
        $this->logger->info('wuyin video submit request', [
            'base_url' => $normalizedBaseUrl,
            'endpoint' => $endpoint,
            'model_version' => $modelVersion,
            'payload' => $payload,
        ]);

        $data = $this->requestJson(
            fn (): array => Json::decode((string) $this->createClient()->post(
                $normalizedBaseUrl . $endpoint,
                [
                    'headers' => [
                        'Authorization' => $apiKey,
                        'Content-Type' => 'application/json',
                    ],
                    'query' => [
                        'key' => $apiKey,
                    ],
                    'json' => $payload,
                ],
            )->getBody()),
            'submit',
        );

        if ((int) ($data['code'] ?? 0) !== 200) {
            throw new ProviderVideoException($this->extractProviderMessageFromPayload($data, 'submit failed'));
        }

        $taskId = $data['data']['id'] ?? null;
        if (! is_string($taskId) || trim($taskId) === '') {
            throw new ProviderVideoException('submit succeeded but task id missing');
        }

        $this->logger->info('wuyin video submit response', [
            'base_url' => $normalizedBaseUrl,
            'endpoint' => $endpoint,
            'model_version' => $modelVersion,
            'task_id' => trim($taskId),
            'code' => $data['code'] ?? null,
            'message' => is_string($data['msg'] ?? null) ? $data['msg'] : '',
            'response' => $data,
        ]);

        return $data;
    }

    public function query(string $baseUrl, string $apiKey, string $taskId): array
    {
        $normalizedBaseUrl = $this->normalizeBaseUrl($baseUrl);
        $endpoint = '/api/async/detail';
        $this->logger->info('wuyin video query request', [
            'base_url' => $normalizedBaseUrl,
            'endpoint' => $endpoint,
            'task_id' => $taskId,
        ]);

        $data = $this->requestJson(
            fn (): array => Json::decode((string) $this->createClient()->get(
                $normalizedBaseUrl . $endpoint,
                [
                    'headers' => [
                        'Authorization' => $apiKey,
                        'Content-Type' => 'application/json',
                    ],
                    'query' => [
                        'key' => $apiKey,
                        'id' => $taskId,
                    ],
                ],
            )->getBody()),
            'query',
        );

        if (! isset($data['code'])) {
            throw new ProviderVideoException('invalid detail response');
        }

        $this->logger->info('wuyin video query response', [
            'base_url' => $normalizedBaseUrl,
            'endpoint' => $endpoint,
            'task_id' => $taskId,
            'provider_status' => $data['data']['status'] ?? null,
            'code' => $data['code'],
            'message' => is_string($data['msg'] ?? null) ? $data['msg'] : '',
            'response' => $data,
        ]);

        return $data;
    }

    private function normalizeBaseUrl(string $baseUrl): string
    {
        return rtrim($baseUrl, '/');
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
            throw new ProviderVideoException(sprintf('wuyin video %s failed: %s', $action, $throwable->getMessage()), $throwable);
        }

        if (! is_array($data)) {
            throw new ProviderVideoException(sprintf('wuyin video %s returned invalid json', $action));
        }

        return $data;
    }

    private function formatRequestExceptionMessage(RequestException $exception, string $action): string
    {
        if (! $exception->hasResponse()) {
            return sprintf('wuyin video %s failed: %s', $action, $exception->getMessage());
        }

        $response = $exception->getResponse();
        $statusCode = $response?->getStatusCode() ?? 0;
        $reason = $response?->getReasonPhrase() ?? 'unknown';
        $body = trim((string) $response?->getBody());

        if ($body === '') {
            return sprintf('wuyin video %s failed: HTTP %d %s', $action, $statusCode, $reason);
        }

        $providerMessage = $this->extractProviderMessageFromBody($body);
        if ($providerMessage !== null) {
            return $providerMessage;
        }

        return sprintf('wuyin video %s failed: HTTP %d %s: %s', $action, $statusCode, $reason, $body);
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

        return $this->extractProviderMessageFromPayload($decoded, null);
    }

    private function extractProviderMessageFromPayload(array $payload, ?string $fallback): string
    {
        foreach ([
            $payload['msg'] ?? null,
            $payload['message'] ?? null,
            is_array($payload['data'] ?? null) ? ($payload['data']['message'] ?? null) : null,
        ] as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return $fallback ?? 'provider request failed';
    }
}
