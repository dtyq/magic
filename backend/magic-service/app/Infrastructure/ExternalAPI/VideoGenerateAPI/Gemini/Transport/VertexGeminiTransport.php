<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Transport;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Infrastructure\ExternalAPI\Google\Auth\GoogleServiceAccountTokenProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\GeminiTransportInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\GeminiVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use InvalidArgumentException;

final class VertexGeminiTransport implements GeminiTransportInterface
{
    private const string DEFAULT_HOST = 'https://aiplatform.googleapis.com';

    private const string API_VERSION = 'v1beta1';

    public function __construct(private readonly GeminiVideoClient $client)
    {
    }

    public function createInteraction(QueueExecutorConfig $config, array $payload, array $logContext = []): array
    {
        unset($payload['response_format']['delivery']);

        return $this->request($config, function (GoogleServiceAccountTokenProvider $tokenProvider, string $baseUrl, string $path) use ($config, $payload, $logContext): array {
            return $this->client->postWithHeaders(
                $baseUrl,
                ['Authorization' => 'Bearer ' . $tokenProvider->getAccessToken()],
                $path,
                $payload,
                $logContext,
                $this->proxyUrl($config),
            );
        });
    }

    public function getInteraction(QueueExecutorConfig $config, string $interactionId, array $logContext = []): array
    {
        return $this->request($config, function (GoogleServiceAccountTokenProvider $tokenProvider, string $baseUrl, string $path) use ($config, $interactionId, $logContext): array {
            return $this->client->getWithHeaders(
                $baseUrl,
                ['Authorization' => 'Bearer ' . $tokenProvider->getAccessToken()],
                $path . '/' . rawurlencode($interactionId),
                $logContext,
                $this->proxyUrl($config),
            );
        });
    }

    private function request(QueueExecutorConfig $config, callable $request): array
    {
        $tokenProvider = new GoogleServiceAccountTokenProvider($this->serviceAccountConfig($config), $this->proxyUrl($config));
        [$baseUrl, $path] = $this->endpoint($config);
        try {
            return $request($tokenProvider, $baseUrl, $path);
        } catch (ProviderVideoException $exception) {
            if ($exception->getHttpStatus() !== 401) {
                throw $exception;
            }
            $tokenProvider->invalidate();
            return $request($tokenProvider, $baseUrl, $path);
        }
    }

    /** @return array{0: string, 1: string} */
    private function endpoint(QueueExecutorConfig $config): array
    {
        $projectId = $config->getExtraString('project_id');
        $location = $config->getExtraString('location', 'global');
        if ($projectId === '') {
            throw new InvalidArgumentException('Google Vertex project_id is required');
        }

        $host = $this->resolveHost($config->getBaseUrl(), $location);
        $path = sprintf(
            '/%s/projects/%s/locations/%s/interactions',
            self::API_VERSION,
            rawurlencode($projectId),
            rawurlencode($location),
        );

        return [$host, $path];
    }

    private function resolveHost(string $configuredBaseUrl, string $location): string
    {
        $configuredBaseUrl = rtrim(trim($configuredBaseUrl), '/');
        if ($configuredBaseUrl !== '' && str_contains($configuredBaseUrl, 'aiplatform.googleapis.com')) {
            $parsed = parse_url($configuredBaseUrl);
            if (isset($parsed['scheme'], $parsed['host'])) {
                $host = strtolower($parsed['host']);
                if ($host !== 'aiplatform.googleapis.com' || $location === 'global') {
                    return $parsed['scheme'] . '://' . $parsed['host'];
                }
            }
        }

        return $location === 'global'
            ? self::DEFAULT_HOST
            : 'https://' . $location . '-aiplatform.googleapis.com';
    }

    /** @return array<string, mixed> */
    private function serviceAccountConfig(QueueExecutorConfig $config): array
    {
        $serviceAccountConfig = $config->getExtraConfig();
        $required = ['project_id', 'client_email', 'private_key'];
        foreach ($required as $key) {
            if (trim((string) ($serviceAccountConfig[$key] ?? '')) === '') {
                throw new InvalidArgumentException('Google Vertex Service Account config is incomplete');
            }
        }

        return $serviceAccountConfig;
    }

    private function proxyUrl(QueueExecutorConfig $config): string
    {
        return $config->getExtraString('proxy_url');
    }
}
