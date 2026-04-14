<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use RuntimeException;

abstract readonly class AbstractCloudswayVideoAdapter implements VideoGenerationProviderAdapterInterface
{
    public function __construct(
        protected CloudswayVideoClient $cloudswayVideoClient,
    ) {
    }

    protected function resolveEndpointId(VideoQueueOperationEntity $operation): string
    {
        $modelVersion = trim($operation->getModelVersion());
        if ($modelVersion !== '') {
            return $modelVersion;
        }

        throw new RuntimeException('cloudsway endpoint id missing');
    }

    protected function buildEndpointPath(VideoQueueOperationEntity $operation, string $suffix): string
    {
        return sprintf('/v1/ai/%s/%s', trim($this->resolveEndpointId($operation), '/'), ltrim($suffix, '/'));
    }

    protected function extractFrameUri(array $frames, string $role): ?string
    {
        foreach ($frames as $frame) {
            if (! is_array($frame)) {
                continue;
            }

            if (trim((string) ($frame['role'] ?? '')) !== $role) {
                continue;
            }

            $uri = trim((string) ($frame['uri'] ?? ''));
            if ($uri !== '') {
                return $uri;
            }
        }

        return null;
    }

    /**
     * @param list<array<string, mixed>> $referenceImages
     */
    protected function extractReferenceImageUri(array $referenceImages): ?string
    {
        foreach ($referenceImages as $referenceImage) {
            if (! is_array($referenceImage)) {
                continue;
            }

            $uri = trim((string) ($referenceImage['uri'] ?? ''));
            if ($uri !== '') {
                return $uri;
            }
        }

        return null;
    }

    protected function firstNonEmptyString(mixed ...$candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return null;
    }

    protected function buildMediaFromUri(string $uri, ?string $mimeType = null): array
    {
        return array_filter([
            'gcsUri' => $uri,
            'mimeType' => $mimeType ?? $this->guessMimeType($uri),
        ], static fn (string $value): bool => trim($value) !== '');
    }

    protected function buildVeoMediaFromUri(string $uri): array
    {
        $normalizedUri = trim($uri);
        if ($normalizedUri === '') {
            throw new RuntimeException('cloudsway veo media uri is empty');
        }

        if (preg_match('#^data:(?<mime>[-\w.+/]+);base64,(?<data>.+)$#is', $normalizedUri, $matches) === 1) {
            return [
                'bytesBase64Encoded' => preg_replace('/\s+/', '', $matches['data']) ?? '',
                'mimeType' => strtolower(trim($matches['mime'])),
            ];
        }

        if (str_starts_with($normalizedUri, 'gs://')) {
            return $this->buildMediaFromUri($normalizedUri);
        }

        if (preg_match('#^https?://#i', $normalizedUri) === 1) {
            $media = $this->cloudswayVideoClient->downloadMediaAsBase64($normalizedUri);

            return [
                'bytesBase64Encoded' => $media['bytes_base64_encoded'],
                'mimeType' => $media['mime_type'],
            ];
        }

        return $this->buildMediaFromUri($normalizedUri);
    }

    protected function guessMimeType(string $uri, string $default = 'image/png'): string
    {
        $path = strtolower(parse_url($uri, PHP_URL_PATH) ?? '');
        return match (true) {
            str_ends_with($path, '.jpg'), str_ends_with($path, '.jpeg') => 'image/jpeg',
            str_ends_with($path, '.webp') => 'image/webp',
            str_ends_with($path, '.mp4') => 'video/mp4',
            str_ends_with($path, '.mov') => 'video/mov',
            str_ends_with($path, '.avi') => 'video/avi',
            default => $default,
        };
    }

    protected function markAcceptedAndIgnored(VideoQueueOperationEntity $operation, array $acceptedParams, array $ignoredParams): void
    {
        $operation->setAcceptedParams(array_values(array_unique($acceptedParams)));
        $operation->setIgnoredParams(array_values(array_unique($ignoredParams)));
    }

    protected function extractProviderMessage(array $response, string $fallback): string
    {
        foreach ([
            is_array($response['error'] ?? null) ? ($response['error']['message'] ?? null) : null,
            $response['message'] ?? null,
            $response['msg'] ?? null,
            is_array($response['data'] ?? null) ? ($response['data']['message'] ?? null) : null,
            is_array($response['data']['error'] ?? null) ? ($response['data']['error']['message'] ?? null) : null,
            is_array($response['data'] ?? null) ? ($response['data']['task_status_msg'] ?? null) : null,
        ] as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return $fallback;
    }

    protected function buildLogContext(VideoQueueOperationEntity $operation, ?string $providerTaskId = null): array
    {
        $context = [
            'video_id' => $operation->getVideoId(),
            'operation_id' => $operation->getId(),
            'provider_task_id' => $providerTaskId,
            'model' => $operation->getModel(),
            'endpoint' => $operation->getEndpoint(),
        ];

        foreach ($context as $key => $value) {
            if ($value === null) {
                unset($context[$key]);
                continue;
            }

            if (trim($value) === '') {
                unset($context[$key]);
            }
        }

        return $context;
    }

    protected function postWithOperationContext(
        VideoQueueOperationEntity $operation,
        QueueExecutorConfig $config,
        string $path,
        array $payload,
        ?string $providerTaskId = null,
    ): array {
        return $this->cloudswayVideoClient->post(
            $config->getBaseUrl(),
            $config->getApiKey(),
            $path,
            $payload,
            $this->buildLogContext($operation, $providerTaskId),
        );
    }

    protected function getWithOperationContext(
        VideoQueueOperationEntity $operation,
        QueueExecutorConfig $config,
        string $path,
        ?string $providerTaskId = null,
    ): array {
        return $this->cloudswayVideoClient->get(
            $config->getBaseUrl(),
            $config->getApiKey(),
            $path,
            $this->buildLogContext($operation, $providerTaskId),
        );
    }
}
