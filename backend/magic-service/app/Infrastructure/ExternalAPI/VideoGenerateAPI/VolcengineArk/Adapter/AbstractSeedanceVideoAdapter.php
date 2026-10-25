<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Prompt\AtStylePromptReferenceFormatter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoErrorMapper;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability\AbstractSeedanceGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use InvalidArgumentException;

/**
 * 方舟 Seedance 各家族共享的 payload 构造与 provider 交互。
 *
 * 三个家族的请求形状完全一致，差异只有能力档位，因此这里承接全部共用逻辑，
 * 能力声明由构造注入的 capabilityProvider 决定；具体家族见同目录下的三个 adapter。
 */
abstract readonly class AbstractSeedanceVideoAdapter implements VideoGenerationConnectivityTestableInterface
{
    // 视频编辑任务：输出时长与宽高比都跟随待编辑视频，因此 duration 固定 -1、ratio 固定 adaptive。
    private const int EDIT_DURATION = -1;

    private const string EDIT_ASPECT_RATIO = 'adaptive';

    // Seedance 2.5 起支持显式声明子任务类型，可把参数校验提前到提交阶段。
    private const string EDIT_TASK_TYPE = 'edit';

    // 样片成片：方舟用 content.type=draft_task 承载样片任务 ID，其余参数全部继承样片。
    private const string DRAFT_TASK_CONTENT_TYPE = 'draft_task';

    public function __construct(
        protected AbstractSeedanceGenerationCapabilityProvider $capabilityProvider,
        protected VolcengineArkVideoClient $client,
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
        $inputMode = $this->normalizeInputMode($request['input_mode'] ?? null);
        $isVideoEdit = $inputMode === VideoInputMode::VideoEdit->value;
        $isDraftTask = $inputMode === VideoInputMode::DraftTask->value;

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
        $capability = $this->capabilityProvider->resolveGenerationConfig($modelVersion, $modelId);
        if ($capability === null) {
            throw new InvalidArgumentException(sprintf(
                'unsupported Seedance video model: %s (%s)',
                $operation->getModel(),
                $operation->getModelVersion(),
            ));
        }
        $generationConfig = $capability->toArray()['generation'];
        $payload = [
            'model' => $modelVersion,
            'content' => $content,
        ];

        // 样片成片（draft_task）：方舟只认 content.type=draft_task + 样片任务 ID + 目标分辨率 + draft=false，
        // 提示词、参考素材、时长、比例全部从样片任务继承，重复下发会被判为非法参数。
        if ($isDraftTask) {
            return $this->buildDraftTaskProviderPayload(
                $operation,
                $modelVersion,
                $inputs,
                $generation,
            );
        }

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

        // 首帧/首尾帧生成：方舟规定输出比例跟随首帧图片，显式下发 ratio 会被判为非法参数，
        // 因此只要检测到首帧就不下发，并把调用方传入的比例记为未生效。
        if ($startFrameUri === null) {
            $aspectRatio = $this->resolveAspectRatio(
                $generation,
                $acceptedParams,
                $ignoredParams,
                $generationConfig['aspect_ratios'],
            );
            if ($aspectRatio !== null) {
                $payload['ratio'] = $aspectRatio;
            }
        } elseif (array_key_exists('aspect_ratio', $generation)) {
            $ignoredParams[] = 'generation.aspect_ratio';
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
        // 样片模式：方舟顶层布尔位，仅 Seedance 2.5 声明该能力，领域层已按能力裁剪过。
        if (array_key_exists('draft', $generation)) {
            $payload['draft'] = (bool) $generation['draft'];
            $acceptedParams[] = 'generation.draft';
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
            if ($this->capabilityProvider->supportsEditTaskType()) {
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
                'draft',
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
     * 构造样片成片请求体。
     *
     * 方舟的成片接口只接受样片任务 ID 与目标分辨率，提示词、参考素材、时长、比例都由样片任务继承，
     * 因此这里不复用常规 payload 构造，只下发协议要求的字段。
     *
     * @param array<string, mixed> $inputs
     * @param array<string, mixed> $generation
     * @return array<string, mixed>
     */
    private function buildDraftTaskProviderPayload(
        VideoQueueOperationEntity $operation,
        string $modelVersion,
        array $inputs,
        array $generation,
    ): array {
        $draftTaskId = $this->firstNonEmptyString($inputs['draft_task']['id'] ?? null);
        if ($draftTaskId === null) {
            throw new InvalidArgumentException('inputs.draft_task.id is required for draft_task mode');
        }

        $acceptedParams = ['inputs.draft_task.id'];
        $ignoredParams = [];
        // 成片固定出正式档位：调用方传入的分辨率按成片档位裁剪，缺省即取成片默认档位。
        $draftTaskResolutions = $this->capabilityProvider->resolveDraftTaskResolutions();
        $resolution = $this->resolveResolution(
            $generation,
            $acceptedParams,
            $ignoredParams,
            $draftTaskResolutions,
            $draftTaskResolutions[0],
        );

        // 除分辨率外的 generation 参数一律由样片任务继承，显式下发反而会被判为非法参数。
        foreach (array_keys($generation) as $field) {
            if ($field !== 'resolution') {
                $ignoredParams[] = 'generation.' . $field;
            }
        }

        $operation->setAcceptedParams(array_values(array_unique($acceptedParams)));
        $operation->setIgnoredParams(array_values(array_unique($ignoredParams)));

        return [
            'model' => $modelVersion,
            'content' => [[
                'type' => self::DRAFT_TASK_CONTENT_TYPE,
                'draft_task' => ['id' => $draftTaskId],
            ]],
            'resolution' => $resolution,
            'draft' => false,
        ];
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
}
