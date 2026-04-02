<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

readonly class WuyinGrokVideoAdapter extends AbstractWuyinVideoAdapter
{
    private const string INPUT_TEXT_PROMPT = 'text_prompt';

    private const string INPUT_REFERENCE_IMAGES = 'reference_images';

    private const string FIELD_ASPECT_RATIO = 'aspect_ratio';

    private const string FIELD_DURATION_SECONDS = 'duration_seconds';

    private const string MODEL_ID_GROK_IMAGINE = 'wuyin-grok-imagine';

    private const string LEGACY_MODEL_ID_GROK_IMAGINE = 'grok-imagine';

    private const string MODEL_VERSION_GROK_IMAGINE = 'grok_imagine';

    private const array SUPPORTED_ASPECT_RATIOS = ['2:3', '3:2', '1:1', '16:9', '9:16'];

    private const array SUPPORTED_DURATIONS = [6, 10, 15];

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return $this->isGrokModel($this->normalizedCandidates($modelVersion, $modelId));
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        return new VideoGenerationConfig([
            'supported_inputs' => [self::INPUT_TEXT_PROMPT, self::INPUT_REFERENCE_IMAGES],
            'reference_images' => [
                'max_count' => 1,
                'reference_types' => ['asset'],
                'style_supported' => false,
            ],
            'generation' => [
                'aspect_ratios' => ['2:3', '3:2', '1:1', '16:9', '9:16'],
                'durations' => [6, 10, 15],
                'supports_seed' => false,
                'supports_watermark' => false,
                'supports_negative_prompt' => false,
                'supports_generate_audio' => false,
                'supports_person_generation' => false,
                'supports_enhance_prompt' => false,
                'supports_compression_quality' => false,
                'supports_resize_mode' => false,
                'supports_sample_count' => false,
            ],
            'constraints' => [],
        ]);
    }

    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        $request = $operation->getRawRequest();
        $referenceImages = $this->extractRequestInputArray($request, 'reference_images');
        $frames = $this->extractRequestInputArray($request, 'frames');
        $videoInput = $this->extractRequestInputArray($request, 'video');
        $generation = $this->extractRequestGeneration($request);
        ['payload' => $payload, 'accepted_params' => $acceptedParams, 'ignored_params' => $ignoredParams] = $this->createPromptPayloadState($request);

        $referenceImageUrl = $this->extractReferenceImageUrl($referenceImages);
        if ($referenceImageUrl !== null) {
            $payload['image_urls'] = [$referenceImageUrl];
            $acceptedParams[] = 'inputs.reference_images';
        }

        if (isset($generation[self::FIELD_DURATION_SECONDS])) {
            if (in_array((int) $generation[self::FIELD_DURATION_SECONDS], self::SUPPORTED_DURATIONS, true)) {
                $payload['duration'] = (string) $generation[self::FIELD_DURATION_SECONDS];
                $acceptedParams[] = 'generation.duration_seconds';
            } else {
                $ignoredParams[] = 'generation.duration_seconds';
            }
        }

        if (isset($generation[self::FIELD_ASPECT_RATIO])) {
            if ($referenceImageUrl === null) {
                if (in_array($generation[self::FIELD_ASPECT_RATIO], self::SUPPORTED_ASPECT_RATIOS, true)) {
                    $payload['aspect_ratio'] = $generation[self::FIELD_ASPECT_RATIO];
                    $acceptedParams[] = 'generation.aspect_ratio';
                } else {
                    $ignoredParams[] = 'generation.aspect_ratio';
                }
            } else {
                $ignoredParams[] = 'generation.aspect_ratio';
            }
        }
        if (isset($generation['size'])) {
            $ignoredParams[] = 'generation.size';
        }
        foreach (array_keys($generation) as $field) {
            if (in_array($field, [self::FIELD_DURATION_SECONDS, self::FIELD_ASPECT_RATIO, 'size'], true)) {
                continue;
            }

            $ignoredParams[] = 'generation.' . $field;
        }

        $this->appendCommonIgnoredParams($request, $ignoredParams);
        if ($frames !== []) {
            $ignoredParams[] = 'inputs.frames';
        }
        if ($videoInput !== []) {
            $ignoredParams[] = 'inputs.video';
        }

        return $this->finalizeProviderPayload($operation, $payload, $acceptedParams, $ignoredParams);
    }

    /**
     * @param list<array<string, mixed>> $referenceImages
     */
    private function extractReferenceImageUrl(array $referenceImages): ?string
    {
        foreach ($referenceImages as $referenceImage) {
            $uri = trim((string) ($referenceImage['uri'] ?? ''));
            if ($uri !== '') {
                return $uri;
            }
        }

        return null;
    }

    /**
     * @param list<string> $normalizedCandidates
     */
    private function isGrokModel(array $normalizedCandidates): bool
    {
        return array_any($normalizedCandidates, static fn (string $candidate): bool => in_array($candidate, [
            self::MODEL_ID_GROK_IMAGINE,
            self::LEGACY_MODEL_ID_GROK_IMAGINE,
            self::MODEL_VERSION_GROK_IMAGINE,
        ], true) || str_contains($candidate, 'grok'));
    }
}
