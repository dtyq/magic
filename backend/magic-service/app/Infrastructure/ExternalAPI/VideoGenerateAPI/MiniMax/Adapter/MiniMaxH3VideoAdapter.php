<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\ErrorCode\MagicApiErrorCode;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Capability\MiniMaxH3GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Transport\ApiKeyMiniMaxTransport;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;

readonly class MiniMaxH3VideoAdapter implements VideoGenerationConnectivityTestableInterface
{
    public function __construct(
        private MiniMaxH3GenerationCapabilityProvider $capabilityProvider,
        private ApiKeyMiniMaxTransport $transport,
    ) {
    }

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return $this->capabilityProvider->supportsModel($modelVersion, $modelId);
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        return $this->capabilityProvider->resolveGenerationConfig($modelVersion, $modelId);
    }

    public function resolveHasAudioOutput(string $modelVersion, string $modelId, array $request): bool
    {
        return true;
    }

    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        $request = $operation->getRawRequest();
        $inputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $prompt = trim((string) ($request['prompt'] ?? ''));
        $duration = (int) ($generation['duration_seconds'] ?? 0);
        $resolution = strtoupper((string) ($generation['resolution'] ?? ''));
        $frames = is_array($inputs['frames'] ?? null) ? $inputs['frames'] : [];
        $referenceImages = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];
        $referenceVideos = is_array($inputs['reference_videos'] ?? null) ? $inputs['reference_videos'] : [];
        $referenceAudios = is_array($inputs['reference_audios'] ?? null) ? $inputs['reference_audios'] : [];

        if ($prompt === '' || $duration < 4 || $duration > 15 || ! in_array($resolution, ['768P', '2K'], true)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'invalid MiniMax H3 generation parameters');
        }
        if ($referenceImages !== [] && count($referenceImages) > 9 || count($referenceVideos) > 3 || count($referenceAudios) > 3) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'MiniMax H3 reference media exceeds limit');
        }
        if ($frames !== [] && ($referenceImages !== [] || $referenceVideos !== [] || $referenceAudios !== [])) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'MiniMax H3 frames and reference media cannot be combined');
        }
        if ($referenceAudios !== [] && $referenceImages === [] && $referenceVideos === []) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'MiniMax H3 reference audio requires image or video reference');
        }

        $content = [['type' => 'text', 'text' => $prompt]];
        foreach ($frames as $frame) {
            if (! is_array($frame) || ! is_string($frame['uri'] ?? null)) {
                continue;
            }
            $content[] = ['type' => 'image_url', 'image_url' => ['url' => $frame['uri']], 'role' => ($frame['role'] ?? '') === 'end' ? 'last_frame' : 'first_frame'];
        }
        $this->appendMedia($content, $referenceImages, 'image_url', 'reference_image');
        $this->appendMedia($content, $referenceVideos, 'video_url', 'reference_video');
        $this->appendMedia($content, $referenceAudios, 'audio_url', 'reference_audio');

        $ratio = (string) ($generation['aspect_ratio'] ?? '16:9');
        if ($frames !== []) {
            $ratio = 'adaptive';
        }
        if ($frames === [] && $referenceImages === [] && $referenceVideos === [] && $referenceAudios === [] && $ratio === 'adaptive') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'MiniMax H3 text generation requires a concrete aspect ratio');
        }

        $operation->setAcceptedParams(['prompt', 'inputs', 'generation.duration_seconds', 'generation.resolution', 'generation.aspect_ratio', 'generation.watermark']);
        return array_filter([
            'model' => 'MiniMax-H3',
            'content' => $content,
            'resolution' => $resolution,
            'duration' => $duration,
            'ratio' => $ratio,
            'aigc_watermark' => array_key_exists('watermark', $generation) ? (bool) $generation['watermark'] : null,
        ], static fn (mixed $value): bool => $value !== null);
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $response = $this->transport->submit($config, $operation->getProviderPayload());
        $taskId = trim((string) ($response['task_id'] ?? ''));
        if ($taskId === '') {
            throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage());
        }
        return $taskId;
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $response = $this->transport->query($config, $providerTaskId);
        $task = is_array($response['task'] ?? null) ? $response['task'] : [];
        $status = strtolower((string) ($task['status'] ?? 'queued'));
        $url = is_array($task['content'] ?? null) ? ($task['content']['url'] ?? null) : null;
        $failed = in_array($status, ['failed', 'cancelled'], true);

        return [
            'status' => match ($status) {
                'succeeded' => 'succeeded',
                'failed', 'cancelled' => 'failed',
                default => 'processing',
            },
            'provider_result' => $response,
            'output' => is_string($url) && $url !== '' ? ['video_url' => $url, 'provider_task_id' => $providerTaskId] : [],
            'error' => $failed ? [
                'code' => (string) VideoGenerateErrorCode::GENERAL_ERROR->value,
                'message' => VideoGenerateErrorCode::GENERAL_ERROR->getMessage(),
            ] : null,
        ];
    }

    public function testConnection(QueueExecutorConfig $config, string $modelVersion): bool
    {
        return $this->transport->testConnection($config, $modelVersion);
    }

    private function appendMedia(array &$content, array $items, string $type, string $role): void
    {
        foreach ($items as $item) {
            $uri = is_array($item) ? trim((string) ($item['uri'] ?? '')) : '';
            if ($uri !== '') {
                $content[] = ['type' => $type, $type => ['url' => $uri], 'role' => $role];
            }
        }
    }
}
