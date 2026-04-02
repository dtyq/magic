<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

abstract readonly class AbstractWuyinVideoAdapter implements VideoGenerationProviderAdapterInterface
{
    private const string INPUT_PROMPT = 'prompt';

    private const string PROVIDER_STATUS_SUCCEEDED = 'succeeded';

    private const string PROVIDER_STATUS_FAILED = 'failed';

    private const string PROVIDER_STATUS_PROCESSING = 'processing';

    private const string ERROR_CODE_PROVIDER_FAILED = 'PROVIDER_FAILED';

    private const string ERROR_MESSAGE_FAILED = 'video generation failed';

    public function __construct(
        protected WuyinVideoClient $wuyinVideoClient,
    ) {
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $response = $this->wuyinVideoClient->submit(
            $config->getBaseUrl(),
            $config->getApiKey(),
            $operation->getModelVersion(),
            $operation->getProviderPayload(),
        );

        $taskId = $response['data']['id'] ?? null;
        if (! is_string($taskId) || trim($taskId) === '') {
            throw new ProviderVideoException('submit succeeded but task id missing');
        }

        return trim($taskId);
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $detail = $this->wuyinVideoClient->query(
            $config->getBaseUrl(),
            $config->getApiKey(),
            $providerTaskId,
        );

        $status = (int) ($detail['data']['status'] ?? -1);

        return [
            'status' => $this->mapStatus($status),
            'provider_result' => $detail,
            'output' => $this->extractOutput($detail, $config, $providerTaskId),
            'error' => $status === 3 ? [
                'code' => self::ERROR_CODE_PROVIDER_FAILED,
                'message' => $this->extractErrorMessage($detail),
                'provider_code' => isset($detail['code']) ? (string) $detail['code'] : null,
            ] : null,
        ];
    }

    protected function extractOutput(array $detail, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $result = $detail['data']['result'] ?? null;
        $videoUrl = $this->extractStringCandidate([
            $detail['data']['url'] ?? null,
            $detail['data']['video_url'] ?? null,
            $detail['data']['videoUrl'] ?? null,
            is_array($result) ? ($result['url'] ?? null) : null,
            is_array($result) ? ($result['video_url'] ?? null) : null,
            is_array($result) ? ($result['videoUrl'] ?? null) : null,
            $this->extractResultVideoUrl($result),
        ]);
        $posterUrl = $this->extractStringCandidate([
            $detail['data']['poster_url'] ?? null,
            $detail['data']['posterUrl'] ?? null,
            $detail['data']['cover_url'] ?? null,
            $detail['data']['coverUrl'] ?? null,
            is_array($result) ? ($result['poster_url'] ?? null) : null,
            is_array($result) ? ($result['posterUrl'] ?? null) : null,
            is_array($result) ? ($result['cover_url'] ?? null) : null,
            is_array($result) ? ($result['coverUrl'] ?? null) : null,
            $this->extractResultPosterUrl($result),
        ]);

        return array_filter([
            'video_url' => $videoUrl,
            'poster_url' => $posterUrl,
            'provider_task_id' => $providerTaskId,
            'provider_base_url' => rtrim($config->getBaseUrl(), '/'),
        ], static fn (mixed $value): bool => $value !== null && $value !== '');
    }

    /**
     * @return list<string>
     */
    protected function normalizedCandidates(string $modelVersion, string $modelId): array
    {
        return array_values(array_unique([
            strtolower(trim($modelVersion)),
            strtolower(trim($modelId)),
        ]));
    }

    protected function extractStringCandidate(array $candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return null;
    }

    protected function extractErrorMessage(array $detail): string
    {
        $message = $detail['data']['message'] ?? $detail['msg'] ?? self::ERROR_MESSAGE_FAILED;
        return is_string($message) && trim($message) !== '' ? trim($message) : self::ERROR_MESSAGE_FAILED;
    }

    /**
     * @return array{payload: array<string, mixed>, accepted_params: list<string>, ignored_params: list<string>}
     */
    protected function createPromptPayloadState(array $request): array
    {
        return [
            'payload' => [
                self::INPUT_PROMPT => $request['prompt'] ?? '',
            ],
            'accepted_params' => [self::INPUT_PROMPT],
            'ignored_params' => [],
        ];
    }

    /**
     * @return array<int|string, mixed>
     */
    protected function extractRequestInputArray(array $request, string $key): array
    {
        return is_array($request['inputs'][$key] ?? null) ? $request['inputs'][$key] : [];
    }

    /**
     * @return array<string, mixed>
     */
    protected function extractRequestGeneration(array $request): array
    {
        return is_array($request['generation'] ?? null) ? $request['generation'] : [];
    }

    /**
     * @param list<string> $ignoredParams
     */
    protected function appendCommonIgnoredParams(array $request, array &$ignoredParams): void
    {
        if (array_key_exists('task', $request) && trim((string) $request['task']) !== '') {
            $ignoredParams[] = 'task';
        }
        if (! empty($request['callbacks']['webhook_url'] ?? null)) {
            $ignoredParams[] = 'callbacks.webhook_url';
        }
        if (! empty($request['execution']['service_tier'] ?? null)) {
            $ignoredParams[] = 'execution.service_tier';
        }
        if (! empty($request['execution']['expires_after_seconds'] ?? null)) {
            $ignoredParams[] = 'execution.expires_after_seconds';
        }
    }

    /**
     * @param array<string, mixed> $payload
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     * @return array<string, mixed>
     */
    protected function finalizeProviderPayload(
        VideoQueueOperationEntity $operation,
        array $payload,
        array $acceptedParams,
        array $ignoredParams
    ): array {
        $operation->setAcceptedParams(array_values(array_unique($acceptedParams)));
        $operation->setIgnoredParams(array_values(array_unique($ignoredParams)));

        return array_filter($payload, static fn (mixed $value): bool => $value !== '' && $value !== []);
    }

    protected function extractResultVideoUrl(mixed $result): ?string
    {
        if (is_string($result) && trim($result) !== '') {
            return trim($result);
        }

        if (! is_array($result)) {
            return null;
        }

        foreach ($result as $item) {
            if (is_string($item) && trim($item) !== '') {
                return trim($item);
            }

            if (is_array($item)) {
                $matched = $this->extractStringCandidate([
                    $item['url'] ?? null,
                    $item['video_url'] ?? null,
                    $item['videoUrl'] ?? null,
                ]);
                if ($matched !== null) {
                    return $matched;
                }
            }
        }

        return null;
    }

    protected function extractResultPosterUrl(mixed $result): ?string
    {
        if (! is_array($result)) {
            return null;
        }

        foreach ($result as $item) {
            if (! is_array($item)) {
                continue;
            }

            $matched = $this->extractStringCandidate([
                $item['poster_url'] ?? null,
                $item['posterUrl'] ?? null,
                $item['cover_url'] ?? null,
                $item['coverUrl'] ?? null,
            ]);
            if ($matched !== null) {
                return $matched;
            }
        }

        return null;
    }

    private function mapStatus(int $status): string
    {
        return match ($status) {
            2 => self::PROVIDER_STATUS_SUCCEEDED,
            3 => self::PROVIDER_STATUS_FAILED,
            default => self::PROVIDER_STATUS_PROCESSING,
        };
    }
}
