<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputModeDefinition;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Prompt\AtStylePromptReferenceFormatter;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Contract\TranslatorInterface;

use function Hyperf\Translation\__;

readonly class VolcengineArkSeedanceVideoAdapter implements VideoGenerationConnectivityTestableInterface
{
    // 对齐方舟 Seedance 当前文档里的默认时长，缺省时我们按 5 秒回填。
    private const int DEFAULT_DURATION_SECONDS = 5;

    // 这是当前接入侧采用的保守默认值，不表示官方永远固定只会默认到 720p。
    private const string DEFAULT_RESOLUTION = '720p';

    // 视频编辑任务：输出时长与宽高比都跟随待编辑视频，因此 duration 固定 -1、ratio 固定 adaptive。
    private const int EDIT_DURATION = -1;

    private const string EDIT_ASPECT_RATIO = 'adaptive';

    // Seedance 2.5 起支持显式声明子任务类型，可把参数校验提前到提交阶段。
    private const string EDIT_TASK_TYPE = 'edit';

    /**
     * 当前按方舟 Seedance 文档支持范围声明，后续如果官方扩容需要同步这里。
     *
     * @var list<string>
     */
    private const array SUPPORTED_ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];

    /**
     * @var list<string>
     */
    private const array PRO_SUPPORTED_RESOLUTIONS = ['480p', '720p', '1080p', '4k'];

    /**
     * 非 Seedance 2.0 Pro 视频模型的兼容分辨率，不开放 4K。
     *
     * @var list<string>
     */
    private const array STANDARD_SUPPORTED_RESOLUTIONS = ['480p', '720p', '1080p'];

    /**
     * Seedance 2.5 当前支持到 1080p，但不开放 4K。
     *
     * @var list<string>
     */
    private const array TWO_POINT_FIVE_SUPPORTED_RESOLUTIONS = ['480p', '720p', '1080p'];

    /**
     * 目前根据 provider 实际返回，Seedance 2.0 Fast 的 t2v 仅开放到 720p。
     *
     * @var list<string>
     */
    private const array FAST_SUPPORTED_RESOLUTIONS = ['480p', '720p'];

    /**
     * 当前接入的 Seedance 尺寸基表。
     * 这里用于 featured 能力下发给前端；不同模型再按能力过滤。
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
        ['label' => '16:9', 'value' => '3840x2160', 'width' => 3840, 'height' => 2160, 'resolution' => '4k'],
        ['label' => '4:3', 'value' => '3328x2496', 'width' => 3328, 'height' => 2496, 'resolution' => '4k'],
        ['label' => '1:1', 'value' => '2880x2880', 'width' => 2880, 'height' => 2880, 'resolution' => '4k'],
        ['label' => '3:4', 'value' => '2496x3328', 'width' => 2496, 'height' => 3328, 'resolution' => '4k'],
        ['label' => '9:16', 'value' => '2160x3840', 'width' => 2160, 'height' => 3840, 'resolution' => '4k'],
        ['label' => '21:9', 'value' => '4410x1890', 'width' => 4410, 'height' => 1890, 'resolution' => '4k'],
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

        $capabilityProfile = $this->resolveCapabilityProfile($modelVersion, $modelId);
        $referenceLimits = $capabilityProfile['reference_limits'] ?? ['images' => 9, 'videos' => 3, 'audios' => 3];

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
                'max_count' => $referenceLimits['images'],
                'reference_types' => ['asset'],
                'style_supported' => false,
            ],
            'generation' => [
                ...$capabilityProfile['generation'],
            ],
            'input_modes' => [
                'standard' => [
                    'description' => $this->translateInputMode('standard'),
                    'supported_fields' => [],
                ],
                'image_reference' => [
                    'description' => $this->translateInputMode('image_reference.multiple', [
                        'max_count' => $referenceLimits['images'],
                    ]),
                    'supported_fields' => ['reference_images'],
                    'reference_images' => [
                        'max_count' => $referenceLimits['images'],
                        'reference_types' => ['asset'],
                        'style_supported' => false,
                    ],
                ],
                'omni_reference' => [
                    'description' => $this->translateInputMode('omni_reference', [
                        'max_count' => $referenceLimits['images'] + $referenceLimits['videos'] + $referenceLimits['audios'],
                    ]),
                    'supported_fields' => ['reference_images', 'reference_videos', 'reference_audios'],
                    'max_count' => $referenceLimits['images'] + $referenceLimits['videos'] + $referenceLimits['audios'],
                    'variants' => [[
                        'code' => 'multimodal_reference_limits',
                        'limits' => [
                            'reference_images' => ['min' => 0, 'max' => $referenceLimits['images']],
                            'reference_videos' => ['min' => 0, 'max' => $referenceLimits['videos']],
                            'reference_audios' => ['min' => 0, 'max' => $referenceLimits['audios']],
                        ],
                    ]],
                ],
                'keyframe_guided' => [
                    'description' => $this->translateInputMode('keyframe_guided.start_end'),
                    'supported_fields' => ['frames'],
                    'frame_roles' => ['start', 'end'],
                ],
                // 视频编辑：至少一个参考视频，可搭配参考图片；时长与比例跟随待编辑视频，不暴露给前端。
                VideoInputMode::VideoEdit->value => array_merge(
                    VideoInputModeDefinition::videoEdit(
                        description: $this->translateInputMode('video_edit'),
                        supportedFields: ['reference_images', 'reference_videos'],
                        maxCount: $referenceLimits['images'] + $referenceLimits['videos'],
                        variants: [[
                            'code' => 'image_and_video',
                            'description' => $this->translateInputMode('video_edit'),
                            'limits' => [
                                'reference_images' => ['min' => 0, 'max' => $referenceLimits['images']],
                                'reference_videos' => ['min' => 1, 'max' => $referenceLimits['videos']],
                                'reference_audios' => ['min' => 0, 'max' => $referenceLimits['audios']],
                            ],
                        ]],
                    )->toArray(),
                    ['generation_constraints' => ['durations' => [], 'aspect_ratios' => []]],
                ),
            ],
        ]);
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
        $isVideoEdit = $this->normalizeInputMode($request['input_mode'] ?? null) === VideoInputMode::VideoEdit->value;

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
        $modelVersion = $this->firstNonEmptyString($operation->getModelVersion(), $modelId) ?? $modelId;
        $capabilityProfile = $this->resolveCapabilityProfile($modelVersion, $modelId);
        $generationConfig = $capabilityProfile['generation'];
        $payload = [
            'model' => $modelVersion,
            'content' => $content,
        ];

        $payload['resolution'] = $this->resolveResolution(
            $generation,
            $acceptedParams,
            $ignoredParams,
            $generationConfig['resolutions'],
            $generationConfig['default_resolution'],
        );

        $payload['duration'] = $this->resolveDuration(
            $generation,
            $acceptedParams,
            $ignoredParams,
            $generationConfig['duration_type'] ?? 'options',
            $generationConfig['durations'],
            $generationConfig['default_duration_seconds'],
        );

        $aspectRatio = $this->resolveAspectRatio(
            $generation,
            $acceptedParams,
            $ignoredParams,
            $generationConfig['aspect_ratios'],
        );
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
        $payload['generate_audio'] = array_key_exists('generate_audio', $generation)
            ? (bool) $generation['generate_audio']
            : true;
        if (array_key_exists('generate_audio', $generation)) {
            $acceptedParams[] = 'generation.generate_audio';
        }
        if (($generation['web_search'] ?? false) === true) {
            $payload['tools'] = [['type' => 'web_search']];
            $acceptedParams[] = 'generation.web_search';
        }
        if (array_key_exists('enhance_prompt', $generation)) {
            $payload['enhance_prompt'] = (bool) $generation['enhance_prompt'];
            $acceptedParams[] = 'generation.enhance_prompt';
        }
        if (array_key_exists('watermark', $generation)) {
            $payload['watermark'] = (bool) $generation['watermark'];
            $acceptedParams[] = 'generation.watermark';
        }

        // 视频编辑任务：时长与宽高比必须跟随待编辑视频，这里统一替换为固定值，
        // 并把调用方传入的对应参数记为未生效，避免同时出现在 accepted 列表里。
        if ($isVideoEdit) {
            $payload['duration'] = self::EDIT_DURATION;
            $payload['ratio'] = self::EDIT_ASPECT_RATIO;
            $acceptedParams = array_diff($acceptedParams, ['generation.duration_seconds', 'generation.aspect_ratio']);
            foreach (['duration_seconds', 'aspect_ratio'] as $field) {
                if (array_key_exists($field, $generation)) {
                    $ignoredParams[] = 'generation.' . $field;
                }
            }
            // 只有 2.5 支持显式声明子任务类型；2.0 系列由模型按素材与提示词自行判定。
            if ($this->isSeedanceTwoPointFiveModel($modelVersion, $modelId)) {
                $payload['omni_reference_task_type'] = self::EDIT_TASK_TYPE;
            }
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
                'web_search',
                'watermark',
                'enhance_prompt',
            ], true)) {
                continue;
            }

            $ignoredParams[] = 'generation.' . $field;
        }

        foreach (array_keys($request) as $field) {
            if (in_array($field, ['model_id', 'task', 'input_mode', 'prompt', 'inputs', 'generation', 'callbacks', 'execution'], true)) {
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
            throw new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, 'volcengine ark seedance submit succeeded but task id missing');
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

        $errorCode = $message = null;
        if ($resultStatus === 'failed') {
            $resolvedError = ProviderVideoErrorMapper::resolveVolcengine(null, $detail);
            $errorCode = $resolvedError['errorCode'];
            $message = $resolvedError['message'];
        }

        return [
            'status' => $resultStatus,
            'provider_result' => $detail,
            'output' => array_filter([
                'video_url' => $videoUrl,
                'last_frame_url' => $lastFrameUrl,
                'provider_task_id' => $providerTaskId,
            ], static fn (mixed $value): bool => $value !== null && $value !== ''),
            'error' => $errorCode === null ? null : [
                'code' => (string) $errorCode->value,
                'message' => $message,
            ],
        ];
    }

    /**
     * 执行连通性测试。
     *
     * 使用真实模型版本提交非法分辨率，只有命中预期参数校验错误才视为连通成功。
     */
    public function testConnection(QueueExecutorConfig $config, string $modelVersion): bool
    {
        $payload = [
            'model' => $modelVersion,
            'content' => [['type' => 'text', 'text' => 'connectivity-test']],
            'resolution' => '720p',
            'duration' => 0,
            'ratio' => '1:1',
        ];

        try {
            $this->client->requestJson(
                'post',
                $config->getBaseUrl(),
                $config->getApiKey(),
                '/contents/generations/tasks',
                $payload,
                ['connectivity_test' => true],
            );
        } catch (RequestException $exception) {
            $response = $exception->getResponse();
            $errorMessage = trim((string) $response?->getBody());
            $result = Json::decode($errorMessage);
            $error = is_array($result) && is_array($result['error'] ?? null) ? $result['error'] : [];
            if (($error['code'] ?? null) === 'InvalidParameter') {
                return true;
            }

            throw new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, (string) ($error['message'] ?? 'Volcengine Ark connectivity test failed'), $exception);
        }

        throw new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, 'Volcengine Ark connectivity test did not receive the expected validation error');
    }

    /**
     * @param array<string, mixed> $request
     */
    private function buildPrompt(array $request): string
    {
        return (new AtStylePromptReferenceFormatter())->format(trim((string) ($request['prompt'] ?? '')));
    }

    /**
     * 领域层已完成 input_mode 校验，这里只做缺省归一化，未传时按普通生成处理。
     */
    private function normalizeInputMode(mixed $mode): string
    {
        $mode = is_string($mode) ? strtolower(trim($mode)) : '';

        return $mode === '' ? VideoInputMode::OmniReference->value : $mode;
    }

    /**
     * @param array<string, mixed> $generation
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     */
    private function resolveResolution(
        array $generation,
        array &$acceptedParams,
        array &$ignoredParams,
        array $supportedResolutions,
        string $defaultResolution,
    ): string {
        if (! array_key_exists('resolution', $generation)) {
            return $defaultResolution;
        }

        $resolution = trim((string) $generation['resolution']);
        if (! in_array($resolution, $supportedResolutions, true)) {
            $ignoredParams[] = 'generation.resolution';
            return $defaultResolution;
        }

        $acceptedParams[] = 'generation.resolution';
        return $resolution;
    }

    /**
     * @param array<string, mixed> $generation
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     */
    private function resolveDuration(
        array $generation,
        array &$acceptedParams,
        array &$ignoredParams,
        string $durationType,
        array $supportedDurations,
        int $defaultDurationSeconds,
    ): int {
        if (! array_key_exists('duration_seconds', $generation)) {
            return $defaultDurationSeconds;
        }

        $duration = (int) $generation['duration_seconds'];
        $valid = $durationType === 'range'
            ? $this->isDurationInRange($duration, $supportedDurations)
            : in_array($duration, $supportedDurations, true);
        if (! $valid) {
            $ignoredParams[] = 'generation.duration_seconds';
            return $defaultDurationSeconds;
        }

        $acceptedParams[] = 'generation.duration_seconds';
        return $duration;
    }

    private function isDurationInRange(int $duration, array $range): bool
    {
        $min = (int) ($range['min'] ?? 0);
        $max = (int) ($range['max'] ?? 0);
        $step = max(1, (int) ($range['step'] ?? 1));

        return $min > 0 && $max >= $min && $duration >= $min && $duration <= $max
            && (($duration - $min) % $step === 0);
    }

    /**
     * @param array<string, mixed> $generation
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     */
    private function resolveAspectRatio(
        array $generation,
        array &$acceptedParams,
        array &$ignoredParams,
        array $supportedAspectRatios,
    ): ?string {
        if (! array_key_exists('aspect_ratio', $generation)) {
            return null;
        }

        $aspectRatio = trim((string) $generation['aspect_ratio']);
        if (! in_array($aspectRatio, $supportedAspectRatios, true)) {
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

    /**
     * @return array{
     *   generation: array{
     *     aspect_ratios: list<string>,
     *     duration_type: 'options'|'range',
     *     durations: array{min:int,max:int,step:int}|list<int>,
     *     default_duration_seconds: int,
     *     resolutions: list<string>,
     *     sizes: list<array{label: string, value: string, width: int, height: int, resolution: string}>,
     *     default_resolution: string,
     *     supports_seed: bool,
     *     seed_range: list<int>,
     *     supports_watermark: bool,
     *     supports_generate_audio: bool,
     *   },
     *   reference_limits: array{images:int,videos:int,audios:int},
     *   validation: array{
     *     explicit_resolution_errors?: array<string, array{key: string, replace: array<string, string>}>
     *   }
     * }
     */
    private function resolveCapabilityProfile(string $modelVersion, string $modelId): array
    {
        $baseGenerationConfig = $this->baseGenerationConfig();

        if ($this->isSeedanceTwoFastModel($modelVersion, $modelId)) {
            return [
                'generation' => array_merge($baseGenerationConfig, [
                    'duration_type' => 'range',
                    'durations' => ['min' => 4, 'max' => 15, 'step' => 1],
                    'resolutions' => self::FAST_SUPPORTED_RESOLUTIONS,
                    'sizes' => $this->filterSizesByResolution(self::FAST_SUPPORTED_RESOLUTIONS),
                ]),
                'reference_limits' => ['images' => 9, 'videos' => 3, 'audios' => 3],
                'validation' => [],
            ];
        }

        if ($this->isSeedanceTwoPointFiveModel($modelVersion, $modelId)) {
            return [
                'generation' => array_merge($baseGenerationConfig, [
                    'duration_type' => 'range',
                    'durations' => ['min' => 4, 'max' => 30, 'step' => 1],
                    'resolutions' => self::TWO_POINT_FIVE_SUPPORTED_RESOLUTIONS,
                    'sizes' => $this->filterSizesByResolution(self::TWO_POINT_FIVE_SUPPORTED_RESOLUTIONS),
                ]),
                'reference_limits' => ['images' => 30, 'videos' => 10, 'audios' => 10],
                'validation' => [],
            ];
        }

        if ($this->isSeedanceTwoProModel($modelVersion, $modelId)) {
            return [
                'generation' => array_merge($baseGenerationConfig, [
                    'duration_type' => 'range',
                    'durations' => ['min' => 4, 'max' => 15, 'step' => 1],
                    'resolutions' => self::PRO_SUPPORTED_RESOLUTIONS,
                    'sizes' => self::SUPPORTED_SIZES,
                ]),
                'reference_limits' => ['images' => 9, 'videos' => 3, 'audios' => 3],
                'validation' => [],
            ];
        }

        return [
            'generation' => array_merge($baseGenerationConfig, [
                'duration_type' => 'range',
                'durations' => ['min' => 4, 'max' => 15, 'step' => 1],
                'resolutions' => self::STANDARD_SUPPORTED_RESOLUTIONS,
                'sizes' => $this->filterSizesByResolution(self::STANDARD_SUPPORTED_RESOLUTIONS),
            ]),
            'reference_limits' => ['images' => 9, 'videos' => 3, 'audios' => 3],
            'validation' => [],
        ];
    }

    /**
     * @return array{
     *   aspect_ratios: list<string>,
     *   duration_type: 'options'|'range',
     *   durations: array{min:int,max:int,step:int}|list<int>,
     *   default_duration_seconds: int,
     *   default_resolution: string,
     *   supports_seed: bool,
     *   seed_range: list<int>,
     *   supports_watermark: bool,
     *   supports_generate_audio: bool,
     * }
     */
    private function baseGenerationConfig(): array
    {
        return [
            'aspect_ratios' => self::SUPPORTED_ASPECT_RATIOS,
            'duration_type' => 'range',
            'durations' => ['min' => 4, 'max' => 15, 'step' => 1],
            'default_duration_seconds' => self::DEFAULT_DURATION_SECONDS,
            'default_resolution' => self::DEFAULT_RESOLUTION,
            'supports_seed' => true,
            'seed_range' => [-1, 4294967295],
            'supports_watermark' => true,
            'supports_generate_audio' => true,
            'supports_person_generation' => false,
            'supports_enhance_prompt' => false,
            'supports_compression_quality' => false,
            'supports_resize_mode' => false,
            'supports_sample_count' => false,
            'generate_audio' => [
                'type' => 'switch',
                'default' => true,
                'name' => __('video.generation.generate_audio.name'),
                'description' => __('video.generation.generate_audio.description'),
            ],
            /*'web_search' => [
                'type' => 'switch',
                'default' => false,
                'name' => __('video.generation.web_search.name'),
                'description' => __('video.generation.web_search.description'),
            ],*/
        ];
    }

    private function isSeedanceTwoFastModel(string $modelVersion, string $modelId): bool
    {
        foreach ([$modelVersion, $modelId] as $identifier) {
            $normalizedIdentifier = strtolower(trim($identifier));
            if ($normalizedIdentifier === '' || ! str_contains($normalizedIdentifier, 'seedance-')) {
                continue;
            }

            foreach (['seedance-2.0-mini', 'seedance-2-0-mini', 'seedance-2.0-fast', 'seedance-2-0-fast'] as $marker) {
                if (str_contains($normalizedIdentifier, $marker)) {
                    return true;
                }
            }
        }

        return false;
    }

    private function isSeedanceTwoPointFiveModel(string $modelVersion, string $modelId): bool
    {
        foreach ([$modelVersion, $modelId] as $identifier) {
            $normalizedIdentifier = strtolower(trim($identifier));
            if ($normalizedIdentifier === '' || ! str_contains($normalizedIdentifier, 'seedance-')) {
                continue;
            }

            if (str_contains($normalizedIdentifier, 'seedance-2.5')
                || str_contains($normalizedIdentifier, 'seedance-2-5')) {
                return true;
            }
        }

        return false;
    }

    private function isSeedanceTwoProModel(string $modelVersion, string $modelId): bool
    {
        foreach ([$modelVersion, $modelId] as $identifier) {
            $normalizedIdentifier = strtolower(trim($identifier));
            if ($normalizedIdentifier === '' || ! str_contains($normalizedIdentifier, 'seedance-')) {
                continue;
            }

            if (str_contains($normalizedIdentifier, 'seedance-2.0')
                || str_contains($normalizedIdentifier, 'seedance-2-0')) {
                return ! $this->isSeedanceTwoFastModel($modelVersion, $modelId);
            }
        }

        return false;
    }

    /**
     * @param list<string> $resolutions
     * @return list<array{label: string, value: string, width: int, height: int, resolution: string}>
     */
    private function filterSizesByResolution(array $resolutions): array
    {
        return array_values(array_filter(
            self::SUPPORTED_SIZES,
            static fn (array $size): bool => in_array($size['resolution'], $resolutions, true),
        ));
    }
}
