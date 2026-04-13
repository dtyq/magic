<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

readonly class CloudswayVeoVideoAdapter extends AbstractCloudswayVideoAdapter
{
    private const string FIELD_SIZE = 'size';

    private const int DEFAULT_DURATION_SECONDS = 8;

    private const string DEFAULT_RESOLUTION = '720p';

    private const array SUPPORTED_ASPECT_RATIOS = ['16:9', '9:16'];

    private const array SUPPORTED_DURATIONS = [4, 6, 8];

    private const array SUPPORTED_RESOLUTIONS = ['720p', '1080p', '4k'];

    private const string REFERENCE_TYPE_ASSET = 'asset';

    private const int MAX_REFERENCE_IMAGES = 3;

    private const array SUPPORTED_PERSON_GENERATION_OPTIONS = ['allow_adult', 'dont_allow'];

    private const array SUPPORTED_COMPRESSION_QUALITY_OPTIONS = ['optimized', 'lossless'];

    private const array SUPPORTED_RESIZE_MODE_OPTIONS = ['pad', 'crop'];

    private const int MIN_SAMPLE_COUNT = 1;

    private const int MAX_SAMPLE_COUNT = 4;

    private const int MIN_SEED = 0;

    private const int MAX_SEED = 4294967295;

    private const string MODEL_ID_FAST = 'veo-3.1-fast-generate-preview';

    private const string MODEL_ID_PRO = 'veo-3.1-generate-preview';

    /**
     * @var list<array{label: string, value: string, width: int, height: int, resolution: string}>
     */
    private const array SUPPORTED_SIZES = [
        ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
        ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
        ['label' => '16:9', 'value' => '3840x2160', 'width' => 3840, 'height' => 2160, 'resolution' => '4k'],
        ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
        ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
    ];

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        $normalizedModelId = strtolower(trim($modelId));
        return in_array($normalizedModelId, [
            self::MODEL_ID_FAST,
            self::MODEL_ID_PRO,
        ], true);
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        $supportsReferenceImages = $this->supportsReferenceImages($modelId);

        return new VideoGenerationConfig([
            'supported_inputs' => array_values(array_filter([
                'text_prompt',
                'image',
                'last_frame',
                $supportsReferenceImages ? 'reference_images' : null,
            ])),
            'reference_images' => [
                'max_count' => $supportsReferenceImages ? self::MAX_REFERENCE_IMAGES : 0,
                'reference_types' => $supportsReferenceImages ? [self::REFERENCE_TYPE_ASSET] : [],
                'style_supported' => false,
            ],
            'generation' => [
                'aspect_ratios' => self::SUPPORTED_ASPECT_RATIOS,
                'durations' => self::SUPPORTED_DURATIONS,
                'default_duration_seconds' => self::DEFAULT_DURATION_SECONDS,
                'resolutions' => self::SUPPORTED_RESOLUTIONS,
                'sizes' => self::SUPPORTED_SIZES,
                'default_resolution' => self::DEFAULT_RESOLUTION,
                'supports_seed' => true,
                'seed_range' => [self::MIN_SEED, self::MAX_SEED],
                'supports_watermark' => false,
                'supports_negative_prompt' => true,
                'supports_generate_audio' => true,
                'supports_person_generation' => true,
                'person_generation_options' => self::SUPPORTED_PERSON_GENERATION_OPTIONS,
                'supports_enhance_prompt' => true,
                'supports_compression_quality' => true,
                'compression_quality_options' => self::SUPPORTED_COMPRESSION_QUALITY_OPTIONS,
                'supports_resize_mode' => true,
                'resize_mode_options' => self::SUPPORTED_RESIZE_MODE_OPTIONS,
                'supports_sample_count' => true,
                'sample_count_range' => [self::MIN_SAMPLE_COUNT, self::MAX_SAMPLE_COUNT],
            ],
            'constraints' => $supportsReferenceImages
                ? ['reference_images_requires_duration_seconds' => self::DEFAULT_DURATION_SECONDS]
                : [],
        ]);
    }

    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        $request = $operation->getRawRequest();
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $inputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        $videoInput = is_array($inputs['video'] ?? null) ? $inputs['video'] : [];
        $referenceImages = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];
        $frames = is_array($inputs['frames'] ?? null) ? $inputs['frames'] : [];
        $supportsReferenceImages = $this->supportsReferenceImages($operation->getModel());

        $instance = [
            'prompt' => (string) ($request['prompt'] ?? ''),
        ];
        $parameters = [];
        $acceptedParams = ['prompt'];
        $ignoredParams = [];

        $primaryImage = $this->extractFrameUri($frames, 'start');
        if ($primaryImage !== null) {
            $instance['image'] = $this->buildVeoMediaFromUri($primaryImage);
            $acceptedParams[] = 'inputs.frames.start';
        }

        $lastFrame = $this->extractFrameUri($frames, 'end');
        if ($lastFrame !== null) {
            $instance['lastFrame'] = $this->buildVeoMediaFromUri($lastFrame);
            $acceptedParams[] = 'inputs.frames.end';
        }

        $veoReferenceImages = [];
        if ($supportsReferenceImages) {
            foreach ($referenceImages as $referenceImage) {
                if (! is_array($referenceImage)) {
                    $ignoredParams[] = 'inputs.reference_images';
                    continue;
                }

                $uri = trim((string) ($referenceImage['uri'] ?? ''));
                if ($uri === '') {
                    $ignoredParams[] = 'inputs.reference_images';
                    continue;
                }

                $referenceType = trim((string) ($referenceImage['type'] ?? self::REFERENCE_TYPE_ASSET)) ?: self::REFERENCE_TYPE_ASSET;
                if ($referenceType !== self::REFERENCE_TYPE_ASSET) {
                    $ignoredParams[] = 'inputs.reference_images';
                    continue;
                }

                if (count($veoReferenceImages) >= self::MAX_REFERENCE_IMAGES) {
                    $ignoredParams[] = 'inputs.reference_images';
                    continue;
                }

                $veoReferenceImages[] = [
                    'image' => $this->buildVeoMediaFromUri($uri),
                    'referenceType' => $referenceType,
                ];
            }
            if ($veoReferenceImages !== []) {
                $instance['referenceImages'] = $veoReferenceImages;
                $acceptedParams[] = 'inputs.reference_images';
            }
        } elseif ($referenceImages !== []) {
            $ignoredParams[] = 'inputs.reference_images';
        }

        foreach ([
            'aspect_ratio' => [
                'provider_key' => 'aspectRatio',
                'allowed_values' => self::SUPPORTED_ASPECT_RATIOS,
            ],
            'duration_seconds' => [
                'provider_key' => 'durationSeconds',
                'allowed_values' => self::SUPPORTED_DURATIONS,
            ],
            'resolution' => [
                'provider_key' => 'resolution',
                'allowed_values' => self::SUPPORTED_RESOLUTIONS,
            ],
            'negative_prompt' => [
                'provider_key' => 'negativePrompt',
                'allowed_values' => null,
            ],
            'generate_audio' => [
                'provider_key' => 'generateAudio',
                'allowed_values' => null,
            ],
            'person_generation' => [
                'provider_key' => 'personGeneration',
                'allowed_values' => self::SUPPORTED_PERSON_GENERATION_OPTIONS,
            ],
            'enhance_prompt' => [
                'provider_key' => 'enhancePrompt',
                'allowed_values' => null,
            ],
            'compression_quality' => [
                'provider_key' => 'compressionQuality',
                'allowed_values' => self::SUPPORTED_COMPRESSION_QUALITY_OPTIONS,
            ],
            'resize_mode' => [
                'provider_key' => 'resizeMode',
                'allowed_values' => self::SUPPORTED_RESIZE_MODE_OPTIONS,
            ],
            'sample_count' => [
                'provider_key' => 'sampleCount',
                'allowed_values' => null,
            ],
            'seed' => [
                'provider_key' => 'seed',
                'allowed_values' => null,
            ],
        ] as $requestKey => $mapping) {
            if (! array_key_exists($requestKey, $generation)) {
                continue;
            }

            $value = $generation[$requestKey];
            $allowedValues = $mapping['allowed_values'];
            if (is_array($allowedValues) && ! in_array($value, $allowedValues, true)) {
                $ignoredParams[] = 'generation.' . $requestKey;
                continue;
            }
            if ($requestKey === 'duration_seconds' && $veoReferenceImages !== [] && (int) $value !== self::DEFAULT_DURATION_SECONDS) {
                $ignoredParams[] = 'generation.duration_seconds';
                continue;
            }
            if ($requestKey === 'sample_count' && ! $this->isSupportedSampleCount($value)) {
                $ignoredParams[] = 'generation.sample_count';
                continue;
            }
            if ($requestKey === 'seed' && ! $this->isSupportedSeed($value)) {
                $ignoredParams[] = 'generation.seed';
                continue;
            }
            if ($requestKey === 'resize_mode' && $primaryImage === null) {
                $ignoredParams[] = 'generation.resize_mode';
                continue;
            }

            $parameters[$mapping['provider_key']] = $value;
            $acceptedParams[] = 'generation.' . $requestKey;
        }
        if (array_key_exists(self::FIELD_SIZE, $generation) && ! $this->applyGenerationSize($generation, $parameters, $acceptedParams)) {
            $ignoredParams[] = 'generation.size';
        }
        $this->ensureRequiredParameters($generation, $veoReferenceImages !== [], $parameters, $acceptedParams);

        if (array_key_exists('watermark', $generation)) {
            $ignoredParams[] = 'generation.watermark';
        }
        foreach (array_keys($generation) as $field) {
            if (in_array($field, [
                'aspect_ratio',
                'duration_seconds',
                'resolution',
                'negative_prompt',
                'generate_audio',
                'person_generation',
                'enhance_prompt',
                'compression_quality',
                'resize_mode',
                'sample_count',
                'seed',
                'watermark',
                self::FIELD_SIZE,
            ], true)) {
                continue;
            }

            $ignoredParams[] = 'generation.' . $field;
        }
        if (! empty($request['task'] ?? null)) {
            $ignoredParams[] = 'task';
        }
        if ($videoInput !== []) {
            $ignoredParams[] = 'inputs.video';
        }

        $this->markAcceptedAndIgnored($operation, $acceptedParams, $ignoredParams);

        return [
            'instances' => [$instance],
            'parameters' => $parameters,
        ];
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $response = $this->postWithOperationContext(
            $operation,
            $config,
            $this->buildEndpointPath($operation, 'veo/videos/generate'),
            $operation->getProviderPayload(),
        );

        $operationName = $this->firstNonEmptyString(
            $response['name'] ?? null,
            $response['data']['name'] ?? null,
        );
        if ($operationName === null) {
            throw new ProviderVideoException(
                $this->extractProviderMessage($response, 'cloudsway veo submit succeeded but operation name missing')
            );
        }

        return $operationName;
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $detail = $this->postWithOperationContext(
            $operation,
            $config,
            $this->buildEndpointPath($operation, 'veo/videos/task'),
            ['operationName' => $providerTaskId],
            $providerTaskId,
        );

        $payload = is_array($detail['data'] ?? null) ? $detail['data'] : $detail;
        $done = (bool) ($payload['done'] ?? false);
        $error = is_array($payload['error'] ?? null) ? $payload['error'] : null;
        $response = is_array($payload['response'] ?? null) ? $payload['response'] : [];
        $videoUrl = null;
        foreach (($response['videos'] ?? []) as $video) {
            if (! is_array($video)) {
                continue;
            }

            $videoUrl = $this->firstNonEmptyString($video['gcsUri'] ?? null, $video['url'] ?? null);
            if ($videoUrl !== null) {
                break;
            }
        }

        $status = 'processing';
        if ($done) {
            $status = $error === null ? 'succeeded' : 'failed';
        }

        return [
            'status' => $status,
            'provider_result' => $detail,
            'output' => $videoUrl === null ? [] : [
                'video_url' => $videoUrl,
                'provider_task_id' => $providerTaskId,
                'provider_base_url' => rtrim($config->getBaseUrl(), '/'),
            ],
            'error' => $error === null ? null : [
                'code' => 'PROVIDER_FAILED',
                'message' => $this->firstNonEmptyString($error['message'] ?? null, 'video generation failed') ?? 'video generation failed',
                'provider_code' => isset($error['code']) ? (string) $error['code'] : null,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $generation
     * @param array<string, mixed> $parameters
     * @param list<string> $acceptedParams
     */
    private function applyGenerationSize(array $generation, array &$parameters, array &$acceptedParams): bool
    {
        $matchedSize = $this->matchSupportedSize($generation[self::FIELD_SIZE] ?? null);
        if ($matchedSize === null) {
            return false;
        }

        $matchedAspectRatio = trim((string) ($matchedSize['label'] ?? ''));
        if (
            isset($generation['aspect_ratio'])
            && is_string($generation['aspect_ratio'])
            && $matchedAspectRatio !== ''
            && $generation['aspect_ratio'] !== $matchedAspectRatio
        ) {
            return false;
        }

        $matchedResolution = trim((string) ($matchedSize['resolution'] ?? ''));
        if (
            isset($generation['resolution'])
            && is_string($generation['resolution'])
            && $matchedResolution !== ''
            && $generation['resolution'] !== $matchedResolution
        ) {
            return false;
        }

        if (! array_key_exists('aspectRatio', $parameters) && $matchedAspectRatio !== '') {
            $parameters['aspectRatio'] = $matchedAspectRatio;
        }
        if (! array_key_exists('resolution', $parameters) && $matchedResolution !== '') {
            $parameters['resolution'] = $matchedResolution;
        }
        $acceptedParams[] = 'generation.size';

        return true;
    }

    /**
     * @return null|array{label: string, value: string, width: int, height: int, resolution: string}
     */
    private function matchSupportedSize(mixed $value): ?array
    {
        $normalizedValue = is_string($value) ? strtolower(trim($value)) : '';
        if ($normalizedValue === '') {
            return null;
        }

        $matchedSize = array_find(
            self::SUPPORTED_SIZES,
            static fn (array $size): bool => strtolower($size['value']) === $normalizedValue
        );
        return $matchedSize ?? null;
    }

    /**
     * @param array<string, mixed> $generation
     * @param array<string, mixed> $parameters
     * @param list<string> $acceptedParams
     */
    private function ensureRequiredParameters(
        array $generation,
        bool $hasReferenceImages,
        array &$parameters,
        array &$acceptedParams
    ): void {
        if (! array_key_exists('durationSeconds', $parameters)) {
            $parameters['durationSeconds'] = $this->resolveDurationSeconds($generation, $hasReferenceImages);
            $acceptedParams[] = 'generation.duration_seconds';
        }

        if (! array_key_exists('resolution', $parameters)) {
            $parameters['resolution'] = $this->resolveResolution($generation);
            $acceptedParams[] = 'generation.resolution';
        }
    }

    /**
     * @param array<string, mixed> $generation
     */
    private function resolveDurationSeconds(array $generation, bool $requiresReferenceImageDuration): int
    {
        if ($requiresReferenceImageDuration) {
            return self::DEFAULT_DURATION_SECONDS;
        }

        $durationSeconds = (int) ($generation['duration_seconds'] ?? self::DEFAULT_DURATION_SECONDS);
        if (in_array($durationSeconds, self::SUPPORTED_DURATIONS, true)) {
            return $durationSeconds;
        }

        return self::DEFAULT_DURATION_SECONDS;
    }

    /**
     * @param array<string, mixed> $generation
     */
    private function resolveResolution(array $generation): string
    {
        $resolution = strtolower(trim((string) ($generation['resolution'] ?? self::DEFAULT_RESOLUTION)));
        if (in_array($resolution, self::SUPPORTED_RESOLUTIONS, true)) {
            return $resolution;
        }

        return self::DEFAULT_RESOLUTION;
    }

    private function supportsReferenceImages(string $modelId): bool
    {
        return strtolower(trim($modelId)) === self::MODEL_ID_PRO;
    }

    private function isSupportedSampleCount(mixed $value): bool
    {
        $sampleCount = (int) $value;
        return $sampleCount >= self::MIN_SAMPLE_COUNT && $sampleCount <= self::MAX_SAMPLE_COUNT;
    }

    private function isSupportedSeed(mixed $value): bool
    {
        $seed = (int) $value;
        return $seed >= self::MIN_SEED && $seed <= self::MAX_SEED;
    }
}
