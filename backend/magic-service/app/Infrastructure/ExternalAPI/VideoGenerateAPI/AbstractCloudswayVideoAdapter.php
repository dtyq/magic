<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
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
}
