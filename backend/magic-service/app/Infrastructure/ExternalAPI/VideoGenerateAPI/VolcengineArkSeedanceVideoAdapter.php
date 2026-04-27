<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use Hyperf\Contract\TranslatorInterface;

readonly class VolcengineArkSeedanceVideoAdapter implements VideoGenerationProviderAdapterInterface
{
    // 对齐方舟 Seedance 当前文档里的默认时长，缺省时我们按 5 秒回填。
    private const int DEFAULT_DURATION_SECONDS = 5;

    // 这是当前接入侧采用的保守默认值，不表示官方永远固定只会默认到 720p。
    private const string DEFAULT_RESOLUTION = '720p';

    /**
     * 当前按方舟 Seedance 文档支持范围声明，后续如果官方扩容需要同步这里。
     *
     * @var list<string>
     */
    private const array SUPPORTED_ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];

    /**
     * 当前按方舟 Seedance 文档支持范围声明，后续如果官方扩容需要同步这里。
     *
     * @var list<int>
     */
    private const array SUPPORTED_DURATIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

    /**
     * 当前按方舟 Seedance 文档支持范围声明，后续如果官方扩容需要同步这里。
     *
     * @var list<string>
     */
    private const array SUPPORTED_RESOLUTIONS = ['480p', '720p', '1080p'];

    /**
     * 当前接入的 Seedance 1.5 Pro / 2.0 / 2.0 Fast 尺寸表。
     * 这里用于 featured 能力下发给前端，不参与 provider 请求参数组装。
     *
     * @var list<array{label: string, value: string, width: int, height: int, resolution: string}>
     */
    private const array SUPPORTED_SIZES = [
        ['label' => '16:9', 'value' => '864x496', 'width' => 864, 'height' => 496, 'resolution' => '480p'],
        ['label' => '4:3', 'value' => '752x560', 'width' => 752, 'height' => 560, 'resolution' => '480p'],
        ['label' => '1:1', 'value' => '640x640', 'width' => 640, 'height' => 640, 'resolution' => '480p'],
        ['label' => '3:4', 'value' => '560x752', 'width' => 560, 'height' => 752, 'resolution' => '480p'],
        ['label' => '9:16', 'value' => '496x864', 'width' => 496, 'height' => 864, 'resolution' => '480p'],
        ['label' => '21:9', 'value' => '992x432', 'width' => 992, 'height' => 432, 'resolution' => '480p'],
        ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
        ['label' => '4:3', 'value' => '1112x834', 'width' => 1112, 'height' => 834, 'resolution' => '720p'],
        ['label' => '1:1', 'value' => '960x960', 'width' => 960, 'height' => 960, 'resolution' => '720p'],
        ['label' => '3:4', 'value' => '834x1112', 'width' => 834, 'height' => 1112, 'resolution' => '720p'],
        ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
        ['label' => '21:9', 'value' => '1470x630', 'width' => 1470, 'height' => 630, 'resolution' => '720p'],
        ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
        ['label' => '4:3', 'value' => '1668x1252', 'width' => 1668, 'height' => 1252, 'resolution' => '1080p'],
        ['label' => '1:1', 'value' => '1440x1440', 'width' => 1440, 'height' => 1440, 'resolution' => '1080p'],
        ['label' => '3:4', 'value' => '1252x1668', 'width' => 1252, 'height' => 1668, 'resolution' => '1080p'],
        ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
        ['label' => '21:9', 'value' => '2205x945', 'width' => 2205, 'height' => 945, 'resolution' => '1080p'],
    ];

    public function __construct(
        private VolcengineArkVideoClient $client,
    ) {
    }

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        // VolcengineArk 的视频模型标识不是稳定白名单，当前运行时也是先按 providerCode
        // 路由到这个 adapter，再由它统一承接方舟视频协议，因此这里仅要求模型标识非空。
        return trim($modelId) !== '' || trim($modelVersion) !== '';
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        return new VideoGenerationConfig([
            'supported_inputs' => [
                'text_prompt',
                'image',
                'reference_images',
                'reference_videos',
                'reference_audios',
                'mask',
                'video_extension',
                'video_edit',
                'video_upscale',
            ],
            'reference_images' => [
                // Seedance 2.0 参考图能力按当前产品规格开放到 1~9 张。
                'max_count' => 9,
                'reference_types' => ['asset'],
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
                'seed_range' => [-1, 4294967295],
                'supports_watermark' => true,
                'supports_negative_prompt' => false,
                'supports_generate_audio' => true,
                'supports_person_generation' => false,
                'supports_enhance_prompt' => false,
                'supports_compression_quality' => false,
                'supports_resize_mode' => false,
                'supports_sample_count' => false,
            ],
            'input_modes' => [
                'standard' => [
                    'description' => $this->translateInputMode('standard'),
                    'supported_fields' => [],
                ],
                'image_reference' => [
                    'description' => $this->translateInputMode('image_reference.multiple', [
                        'max_count' => 9,
                    ]),
                    'supported_fields' => ['reference_images'],
                    'reference_images' => [
                        'max_count' => 9,
                        'reference_types' => ['asset'],
                        'style_supported' => false,
                    ],
                ],
                'omni_reference' => [
                    'description' => $this->translateInputMode('omni_reference', [
                        'max_count' => 12,
                    ]),
                    'supported_fields' => ['reference_images', 'reference_videos', 'reference_audios'],
                    'max_count' => 12,
                ],
                'keyframe_guided' => [
                    'description' => $this->translateInputMode('keyframe_guided.start_end'),
                    'supported_fields' => ['frames'],
                    'frame_roles' => ['start', 'end'],
                ],
            ],
        ]);
    }

    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        $request = $operation->getRawRequest();
        $inputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $frames = is_array($inputs['frames'] ?? null) ? $inputs['frames'] : [];
        $referenceImages = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];
        $referenceVideos = is_array($inputs['reference_videos'] ?? null) ? $inputs['reference_videos'] : [];
        $referenceAudios = is_array($inputs['reference_audios'] ?? null) ? $inputs['reference_audios'] : [];
        $content = [[
            'type' => 'text',
            'text' => $this->buildPrompt($request),
        ]];
        $acceptedParams = ['prompt', 'task'];
        $ignoredParams = [];

        $startFrameUri = $this->extractFrameUri($frames, ['start', 'first']);
        if ($startFrameUri !== null) {
            $content[] = [
                'type' => 'image_url',
                'image_url' => ['url' => $startFrameUri],
                'role' => 'first_frame',
            ];
            $acceptedParams[] = 'inputs.frames.start';
        }

        $endFrameUri = $this->extractFrameUri($frames, ['end', 'last']);
        if ($endFrameUri !== null) {
            $content[] = [
                'type' => 'image_url',
                'image_url' => ['url' => $endFrameUri],
                'role' => 'last_frame',
            ];
            $acceptedParams[] = 'inputs.frames.end';
        }

        foreach ($referenceImages as $referenceImage) {
            if (! is_array($referenceImage)) {
                continue;
            }

            $uri = $this->firstNonEmptyString($referenceImage['uri'] ?? null);
            if ($uri === null) {
                continue;
            }

            $content[] = [
                'type' => 'image_url',
                'image_url' => ['url' => $uri],
                'role' => 'reference_image',
            ];
            $acceptedParams[] = 'inputs.reference_images';
        }

        foreach ($referenceVideos as $referenceVideo) {
            if (! is_array($referenceVideo)) {
                continue;
            }

            $referenceVideoUri = $this->firstNonEmptyString($referenceVideo['uri'] ?? null);
            if ($referenceVideoUri === null) {
                continue;
            }

            $content[] = [
                'type' => 'video_url',
                'video_url' => ['url' => $referenceVideoUri],
                'role' => 'reference_video',
            ];
            $acceptedParams[] = 'inputs.reference_videos';
        }

        foreach ($referenceAudios as $referenceAudio) {
            if (! is_array($referenceAudio)) {
                continue;
            }

            $referenceAudioUri = $this->firstNonEmptyString($referenceAudio['uri'] ?? null);
            if ($referenceAudioUri === null) {
                continue;
            }

            $content[] = [
                'type' => 'audio_url',
                'audio_url' => ['url' => $referenceAudioUri],
                'role' => 'reference_audio',
            ];
            $acceptedParams[] = 'inputs.reference_audios';
        }

        $maskUri = $this->firstNonEmptyString($inputs['mask']['uri'] ?? null);
        if ($maskUri !== null) {
            $content[] = [
                'type' => 'mask_url',
                'mask_url' => ['url' => $maskUri],
            ];
            $acceptedParams[] = 'inputs.mask';
        }

        $modelId = $this->firstNonEmptyString($request['model_id'] ?? null, $operation->getModel()) ?? $operation->getModel();
        $payload = [
            'model' => $modelId,
            'task' => $this->firstNonEmptyString($request['task'] ?? null, 'generate') ?? 'generate',
            'content' => $content,
        ];
        $payload['resolution'] = $this->resolveResolution($generation, $acceptedParams, $ignoredParams);

        // 如果是1080p，不支持参考图
        if ($payload['resolution'] === '1080p' && $referenceImages !== []) {
            throw new ProviderVideoException('generation.resolution=1080p is not supported when inputs.reference_images is provided');
        }

        $payload['duration'] = $this->resolveDuration($generation, $acceptedParams, $ignoredParams);

        $aspectRatio = $this->resolveAspectRatio($generation, $acceptedParams, $ignoredParams);
        if ($aspectRatio !== null) {
            $payload['ratio'] = $aspectRatio;
        }

        $seed = $this->resolveSeed($generation, $acceptedParams, $ignoredParams);
        if ($seed !== null) {
            $payload['seed'] = $seed;
        }

        if (array_key_exists('camera_fixed', $generation)) {
            $payload['camera_fixed'] = (bool) $generation['camera_fixed'];
            $acceptedParams[] = 'generation.camera_fixed';
        }

        $callbackUrl = $this->firstNonEmptyString($request['callbacks']['webhook_url'] ?? null);
        if ($callbackUrl !== null) {
            $payload['callback_url'] = $callbackUrl;
            $acceptedParams[] = 'callbacks.webhook_url';
        }

        $serviceTier = $this->firstNonEmptyString($request['execution']['service_tier'] ?? null);
        if ($serviceTier !== null) {
            $ignoredParams[] = 'execution.service_tier';
        }

        if (array_key_exists('expires_after_seconds', $request['execution'] ?? [])) {
            $payload['execution_expires_after'] = (int) $request['execution']['expires_after_seconds'];
            $acceptedParams[] = 'execution.expires_after_seconds';
        }
        if (array_key_exists('return_last_frame', $generation)) {
            $payload['return_last_frame'] = (bool) $generation['return_last_frame'];
            $acceptedParams[] = 'generation.return_last_frame';
        }
        if (array_key_exists('generate_audio', $generation)) {
            $payload['generate_audio'] = (bool) $generation['generate_audio'];
            $acceptedParams[] = 'generation.generate_audio';
        }
        if (array_key_exists('enhance_prompt', $generation)) {
            $payload['enhance_prompt'] = (bool) $generation['enhance_prompt'];
            $acceptedParams[] = 'generation.enhance_prompt';
        }
        if (array_key_exists('watermark', $generation)) {
            $payload['watermark'] = (bool) $generation['watermark'];
            $acceptedParams[] = 'generation.watermark';
        }

        foreach (array_keys($generation) as $field) {
            if (in_array($field, [
                'aspect_ratio',
                'duration_seconds',
                'resolution',
                'seed',
                'camera_fixed',
                'return_last_frame',
                'generate_audio',
                'watermark',
                'enhance_prompt',
            ], true)) {
                continue;
            }

            $ignoredParams[] = 'generation.' . $field;
        }

        foreach (array_keys($request) as $field) {
            if (in_array($field, ['model_id', 'task', 'prompt', 'inputs', 'generation', 'callbacks', 'execution'], true)) {
                continue;
            }

            $ignoredParams[] = $field;
        }

        $operation->setAcceptedParams(array_values(array_unique($acceptedParams)));
        $operation->setIgnoredParams(array_values(array_unique($ignoredParams)));

        return $payload;
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $response = $this->client->post(
            $config->getBaseUrl(),
            $config->getApiKey(),
            '/contents/generations/tasks',
            $operation->getProviderPayload(),
            ['operation_id' => $operation->getId()],
        );

        $taskId = $this->firstNonEmptyString(
            $response['id'] ?? null,
            $response['task_id'] ?? null,
            $response['data']['id'] ?? null,
            $response['data']['task_id'] ?? null,
        );
        if ($taskId === null) {
            throw new ProviderVideoException('volcengine ark seedance submit succeeded but task id missing');
        }

        return $taskId;
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $detail = $this->client->get(
            $config->getBaseUrl(),
            $config->getApiKey(),
            '/contents/generations/tasks/' . rawurlencode($providerTaskId),
            [
                'operation_id' => $operation->getId(),
                'provider_task_id' => $providerTaskId,
            ],
        );

        $status = strtolower(trim((string) ($detail['status'] ?? $detail['data']['status'] ?? 'queued')));
        $content = is_array($detail['content'] ?? null)
            ? $detail['content']
            : (is_array($detail['data']['content'] ?? null) ? $detail['data']['content'] : []);
        $videoUrl = $this->firstNonEmptyString(
            $content['video_url'] ?? null,
            $content['url'] ?? null,
            is_array($content['videos'][0] ?? null) ? ($content['videos'][0]['video_url'] ?? $content['videos'][0]['url'] ?? null) : null,
        );
        $lastFrameUrl = $this->firstNonEmptyString(
            $content['last_frame_url'] ?? null,
            $content['lastFrameUrl'] ?? null,
            is_array($content['images'][0] ?? null) ? ($content['images'][0]['url'] ?? $content['images'][0]['image_url'] ?? null) : null,
        );

        $resultStatus = match ($status) {
            'succeeded', 'success' => 'succeeded',
            'failed', 'error', 'expired', 'cancelled', 'canceled' => 'failed',
            default => 'processing',
        };

        $error = is_array($detail['error'] ?? null) ? $detail['error'] : [];
        $data = is_array($detail['data'] ?? null) ? $detail['data'] : [];

        $errorCode = $detail['error']['code'] ?? '';
        if (! $errorCode) {
            $errorCode = match ($status) {
                'expired' => 'PROVIDER_EXPIRED',
                'cancelled', 'canceled' => 'PROVIDER_CANCELLED',
                'failed', 'error' => 'PROVIDER_FAILED',
                default => null,
            };
        }

        return [
            'status' => $resultStatus,
            'provider_result' => $detail,
            'output' => array_filter([
                'video_url' => $videoUrl,
                'last_frame_url' => $lastFrameUrl,
                'provider_task_id' => $providerTaskId,
                'provider_base_url' => rtrim($config->getBaseUrl(), '/'),
            ], static fn (mixed $value): bool => $value !== null && $value !== ''),
            'error' => $errorCode === null ? null : [
                'code' => $errorCode,
                'message' => $this->firstNonEmptyString(
                    $detail['message'] ?? null,
                    $detail['msg'] ?? null,
                    $error['message'] ?? null,
                    $data['message'] ?? null,
                    'video generation failed',
                ) ?? 'video generation failed',
                'provider_code' => null,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $request
     */
    private function buildPrompt(array $request): string
    {
        return trim((string) ($request['prompt'] ?? ''));
    }

    /**
     * @param array<string, mixed> $generation
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     */
    private function resolveResolution(array $generation, array &$acceptedParams, array &$ignoredParams): string
    {
        if (! array_key_exists('resolution', $generation)) {
            return self::DEFAULT_RESOLUTION;
        }

        $resolution = trim((string) $generation['resolution']);
        if (! in_array($resolution, self::SUPPORTED_RESOLUTIONS, true)) {
            $ignoredParams[] = 'generation.resolution';
            return self::DEFAULT_RESOLUTION;
        }

        $acceptedParams[] = 'generation.resolution';
        return $resolution;
    }

    /**
     * @param array<string, mixed> $generation
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     */
    private function resolveDuration(array $generation, array &$acceptedParams, array &$ignoredParams): int
    {
        if (! array_key_exists('duration_seconds', $generation)) {
            return self::DEFAULT_DURATION_SECONDS;
        }

        $duration = (int) $generation['duration_seconds'];
        if (! in_array($duration, self::SUPPORTED_DURATIONS, true)) {
            $ignoredParams[] = 'generation.duration_seconds';
            return self::DEFAULT_DURATION_SECONDS;
        }

        $acceptedParams[] = 'generation.duration_seconds';
        return $duration;
    }

    /**
     * @param array<string, mixed> $generation
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     */
    private function resolveAspectRatio(array $generation, array &$acceptedParams, array &$ignoredParams): ?string
    {
        if (! array_key_exists('aspect_ratio', $generation)) {
            return null;
        }

        $aspectRatio = trim((string) $generation['aspect_ratio']);
        if (! in_array($aspectRatio, self::SUPPORTED_ASPECT_RATIOS, true)) {
            $ignoredParams[] = 'generation.aspect_ratio';
            return null;
        }

        $acceptedParams[] = 'generation.aspect_ratio';
        return $aspectRatio;
    }

    /**
     * @param array<string, mixed> $generation
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     */
    private function resolveSeed(array $generation, array &$acceptedParams, array &$ignoredParams): ?int
    {
        if (! array_key_exists('seed', $generation)) {
            return null;
        }

        if (! is_int($generation['seed']) && ! (is_string($generation['seed']) && is_numeric($generation['seed']))) {
            $ignoredParams[] = 'generation.seed';
            return null;
        }

        $seed = (int) $generation['seed'];
        if ($seed < -1 || $seed > 4294967295) {
            $ignoredParams[] = 'generation.seed';
            return null;
        }

        $acceptedParams[] = 'generation.seed';
        return $seed;
    }

    private function firstNonEmptyString(mixed ...$candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (! is_scalar($candidate)) {
                continue;
            }

            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    /**
     * @param list<array<string, mixed>> $frames
     * @param list<string> $roles
     */
    private function extractFrameUri(array $frames, array $roles): ?string
    {
        foreach ($frames as $frame) {
            if (! is_array($frame)) {
                continue;
            }

            $role = strtolower(trim((string) ($frame['role'] ?? '')));
            if (! in_array($role, $roles, true)) {
                continue;
            }

            $uri = $this->firstNonEmptyString($frame['uri'] ?? null);
            if ($uri !== null) {
                return $uri;
            }
        }

        return null;
    }

    /**
     * 方舟 Seedance 的 mode 文案放在 adapter 原位生成，和它自己的能力配置保持同源。
     */
    private function translateInputMode(string $key, array $replace = []): string
    {
        return di(TranslatorInterface::class)->trans('video.input_modes.' . $key, $replace);
    }
}
