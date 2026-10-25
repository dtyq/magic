<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Entity\Dto;

use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\ValueObject\VideoTaskType;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Codec\Json;

class DesignVideoCreateDTO extends AbstractDTO
{
    public const array FRAME_ROLES = ['start', 'end'];

    public const array REFERENCE_IMAGE_TYPES = ['asset', 'style'];

    public const array SERVICE_TIERS = ['default', 'flex'];

    private const array TOP_LEVEL_ARRAY_FIELDS = ['inputs', 'generation', 'callbacks', 'execution', 'extensions'];

    // Design 创建入口统一使用参考输入，视频和音频参考都通过复数数组字段传入。

    private const array VIDEO_IMAGE_SOURCE_TYPES = ['workspace_path', 'base64'];

    private const array VIDEO_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    protected string $inputMode = '';

    protected ?int $projectId = null;

    protected string $videoId = '';

    protected string $generationType = '';

    protected string $modelId = '';

    protected string $topicId = '';

    protected string $taskId = '';

    protected string $task = '';

    protected string $prompt = '';

    protected string $fileDir = '';

    protected ?string $fileName = null;

    protected array $inputs = [];

    protected array $generation = [];

    /** @var array{videos?: list<array{path: string}>, audios?: list<array{path: string}>} */
    protected array $composition = [];

    protected array $callbacks = [];

    protected array $execution = [];

    protected array $extensions = [];

    private array $rawData;

    public function __construct(?array $data = null)
    {
        $this->rawData = is_array($data) ? $data : [];
        $this->hydrate($this->rawData);
        $this->setTask($this->task);
    }

    /**
     * @return list<string>
     */
    public static function supportedTasks(): array
    {
        return VideoTaskType::values();
    }

    /**
     * @return list<string>
     */
    public static function inputModes(): array
    {
        return VideoInputMode::requestValues();
    }

    public function getProjectId(): int
    {
        return $this->projectId ?? 0;
    }

    public function setProjectId(null|int|string $projectId): void
    {
        if (is_string($projectId) && is_numeric($projectId)) {
            $projectId = (int) $projectId;
        }

        $this->projectId = is_int($projectId) ? $projectId : null;
    }

    public function getVideoId(): string
    {
        return $this->videoId;
    }

    /** 获取视频业务生成类型。 */
    public function getGenerationType(): string
    {
        return $this->generationType;
    }

    /** 设置视频业务生成类型。 */
    public function setGenerationType(mixed $generationType): void
    {
        $value = is_string($generationType) ? trim($generationType) : '';
        $type = DesignGenerationType::tryFrom($value);
        $this->generationType = $type === null ? '' : $type->value;
    }

    public function setVideoId(mixed $videoId): void
    {
        $this->videoId = is_string($videoId) ? trim($videoId) : '';
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(mixed $modelId): void
    {
        if (is_string($modelId)) {
            $normalized = trim($modelId);
        } elseif (is_int($modelId)) {
            $normalized = (string) $modelId;
        } else {
            $normalized = '';
        }

        $this->modelId = $normalized;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(mixed $topicId): void
    {
        $this->topicId = is_string($topicId) ? trim($topicId) : '';
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function setTaskId(mixed $taskId): void
    {
        $this->taskId = is_string($taskId) ? trim($taskId) : '';
    }

    public function getTask(): string
    {
        return $this->task;
    }

    public function setTask(mixed $task): void
    {
        $normalized = is_string($task) ? trim($task) : '';
        $this->task = $normalized === '' ? VideoTaskType::Generate->value : $normalized;
    }

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function setPrompt(mixed $prompt): void
    {
        $this->prompt = is_string($prompt) ? trim($prompt) : '';
    }

    public function getFileDir(): string
    {
        return $this->fileDir;
    }

    public function setFileDir(mixed $fileDir): void
    {
        $this->fileDir = is_string($fileDir) ? trim($fileDir) : '';
    }

    public function getFileName(): ?string
    {
        return $this->fileName;
    }

    public function setFileName(mixed $fileName): void
    {
        $fileName = is_string($fileName) ? trim($fileName) : '';
        $this->fileName = $fileName === '' ? null : $fileName;
    }

    public function setInputMode(mixed $inputMode): void
    {
        $this->inputMode = is_string($inputMode) ? trim($inputMode) : '';
    }

    public function getInputMode(): string
    {
        if (VideoInputMode::isRequestValid($this->inputMode)) {
            return $this->inputMode;
        }

        // 样片成片只靠 task 就能确定模式，且没有任何 frames / 参考素材可供推断。
        if ($this->isDraftTask()) {
            return VideoInputMode::DraftTask->value;
        }

        // 旧调用不传 input_mode 时，仍按输入形态推断，避免 reference_images / frames 被误判。
        if ($this->getFrames() !== []) {
            return VideoInputMode::KeyframeGuided->value;
        }
        if ($this->getReferenceVideos() !== [] || $this->getReferenceAudios() !== []) {
            return VideoInputMode::OmniReference->value;
        }
        if ($this->getReferenceImages() !== []) {
            return VideoInputMode::ImageReference->value;
        }

        return VideoInputMode::Standard->value;
    }

    public function setInputs(mixed $inputs): void
    {
        $this->inputs = $this->normalizeJsonArrayInput($inputs);
    }

    public function getInputs(): array
    {
        return $this->inputs;
    }

    public function setGeneration(mixed $generation): void
    {
        $this->generation = $this->normalizeJsonArrayInput($generation);
    }

    public function getGeneration(): array
    {
        return $this->generation;
    }

    /** 设置文件列表合成参数。 */
    public function setComposition(mixed $composition): void
    {
        $this->composition = $this->normalizeJsonArrayInput($composition);
    }

    /** 获取文件列表合成参数。 */
    public function getComposition(): array
    {
        return $this->composition;
    }

    public function setCallbacks(mixed $callbacks): void
    {
        $this->callbacks = $this->normalizeJsonArrayInput($callbacks);
    }

    public function getCallbacks(): array
    {
        return $this->callbacks;
    }

    public function setExecution(mixed $execution): void
    {
        $this->execution = $this->normalizeJsonArrayInput($execution);
    }

    public function getExecution(): array
    {
        return $this->execution;
    }

    public function setExtensions(mixed $extensions): void
    {
        $this->extensions = $this->normalizeJsonArrayInput($extensions);
    }

    public function getExtensions(): array
    {
        return $this->extensions;
    }

    /**
     * 样片成片引用。
     *
     * `video_id` 为样片的视频业务 ID，`uri` 为样片的工作区相对路径；二者至少其一，
     * 同时存在时以 `video_id` 为准，由 Design 层解析成方舟样片任务 ID。
     *
     * @return array<string, mixed>
     */
    public function getDraftTask(): array
    {
        $draftTask = $this->inputs['draft_task'] ?? [];
        return is_array($draftTask) ? $draftTask : [];
    }

    public function getMask(): ?string
    {
        $inputs = $this->getInputs();
        $mask = $inputs['mask'] ?? null;
        if (! is_array($mask)) {
            return null;
        }

        $uri = trim((string) ($mask['uri'] ?? ''));
        return $uri === '' ? null : $uri;
    }

    public function setMask(?string $uri): void
    {
        if ($uri === null || trim($uri) === '') {
            unset($this->inputs['mask']);
            return;
        }

        $this->inputs['mask'] = ['uri' => trim($uri)];
    }

    public function getReferenceImages(): array
    {
        $inputs = $this->getInputs();
        $referenceImages = $inputs['reference_images'] ?? [];
        return is_array($referenceImages) ? array_values($referenceImages) : [];
    }

    public function setReferenceImages(mixed $referenceImages): void
    {
        $this->inputs['reference_images'] = array_values($this->normalizeJsonArrayInput($referenceImages));
    }

    public function getFrames(): array
    {
        $inputs = $this->getInputs();
        $frames = $inputs['frames'] ?? [];
        return is_array($frames) ? array_values($frames) : [];
    }

    public function setFrames(mixed $frames): void
    {
        $this->inputs['frames'] = array_values($this->normalizeJsonArrayInput($frames));
    }

    public function getReferenceAudios(): array
    {
        $inputs = $this->getInputs();
        $referenceAudios = $inputs['reference_audios'] ?? [];
        return is_array($referenceAudios) ? array_values($referenceAudios) : [];
    }

    public function setReferenceAudios(mixed $referenceAudios): void
    {
        $this->inputs['reference_audios'] = array_values($this->normalizeJsonArrayInput($referenceAudios));
    }

    public function getReferenceVideos(): array
    {
        $inputs = $this->getInputs();
        $referenceVideos = $inputs['reference_videos'] ?? [];
        return is_array($referenceVideos) ? array_values($referenceVideos) : [];
    }

    public function setReferenceVideos(mixed $referenceVideos): void
    {
        $this->inputs['reference_videos'] = array_values($this->normalizeJsonArrayInput($referenceVideos));
    }

    public function valid(): void
    {
        if (($this->projectId ?? 0) <= 0) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'project_id is required');
        }
        if ($this->videoId === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'video_id is required');
        }
        $isCanvasComposition = $this->generationType === DesignGenerationType::CANVAS_COMPOSITION->value;
        if (! $isCanvasComposition && $this->modelId === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
        }
        if (! VideoTaskType::isValid($this->task)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'task is invalid');
        }
        // 样片成片的提示词从样片任务继承，调用方不需要也不应该重新提供。
        if (! $isCanvasComposition && ! $this->isDraftTask() && $this->prompt === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'prompt is required');
        }
        if (! $isCanvasComposition && $this->fileDir === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'file_dir is required');
        }
        if ($this->generationType !== '' && DesignGenerationType::tryFrom($this->generationType) === null) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'generation_type is invalid');
        }

        foreach (self::TOP_LEVEL_ARRAY_FIELDS as $field) {
            $this->assertTopLevelArrayField($field);
        }

        $this->assertVideoInputFields();
        $this->assertGenerationFields();
        $this->assertCallbackAndExecutionFields();
        $this->assertExtensionFields();
    }

    public function validForEstimate(): void
    {
        if (($this->projectId ?? 0) <= 0) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'project_id is required');
        }
        if ($this->modelId === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
        }
        if (! VideoTaskType::isValid($this->task)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'task is invalid');
        }

        foreach (self::TOP_LEVEL_ARRAY_FIELDS as $field) {
            $this->assertTopLevelArrayField($field);
        }

        $this->assertVideoInputFields();
        $this->assertGenerationFields();
        $this->assertCallbackAndExecutionFields();
        $this->assertExtensionFields();
    }

    /** 校验画布合成任务的业务字段，避免把页面请求误交给 Provider。 */
    public function validForCanvasComposition(): void
    {
        if (($this->projectId ?? 0) <= 0 || $this->videoId === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'project_id and video_id are required');
        }
        if ($this->generationType !== DesignGenerationType::CANVAS_COMPOSITION->value) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'generation_type is invalid');
        }
        if ($this->fileDir === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'file_dir is required');
        }
        $videos = $this->composition['videos'] ?? null;
        if (! is_array($videos) || $videos === []) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'design.video_generation.composition_videos_required');
        }
        foreach ($videos as $index => $video) {
            $this->assertCompositionMedia($video, sprintf('composition.videos.%d', $index));
        }
        $audios = $this->composition['audios'] ?? [];
        if (! is_array($audios)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'composition.audios must be an array');
        }
        if (count($audios) > 1) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'composition supports at most one audio');
        }
        foreach ($audios as $index => $audio) {
            $this->assertCompositionMedia($audio, sprintf('composition.audios.%d', $index));
        }
        $this->assertGenerationFields();
    }

    /**
     * 构建模型网关请求基础 payload，只包含 DTO 自身承载的网关字段。
     *
     * @return array<string, mixed>
     */
    public function toModelGatewayPayload(): array
    {
        $payload = [
            'model_id' => $this->getModelId(),
            'task' => $this->getTask(),
            'input_mode' => $this->getInputMode(),
            'prompt' => $this->getPrompt(),
            'inputs' => $this->getInputs(),
            'generation' => $this->getGeneration(),
            'callbacks' => $this->getCallbacks(),
            'execution' => $this->getExecution(),
            'extensions' => $this->getExtensions(),
        ];

        if ($this->getComposition() !== []) {
            $payload['composition'] = $this->getComposition();
        }

        if ($this->getTopicId() !== '') {
            $payload['topic_id'] = $this->getTopicId();
        }
        if ($this->getTaskId() !== '') {
            $payload['task_id'] = $this->getTaskId();
        }

        return $payload;
    }

    public function getType(): string
    {
        return 'video';
    }

    private function assertTopLevelArrayField(string $field): void
    {
        if (! array_key_exists($field, $this->rawData) || $this->rawData[$field] === null) {
            return;
        }

        $value = $this->rawData[$field];
        if (is_array($value)) {
            return;
        }

        if (! is_string($value) || ! json_validate($value)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be an array or valid json object', $field));
        }

        $decoded = Json::decode($value, true);
        if (! is_array($decoded)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be an array or valid json object', $field));
        }
    }

    private function assertVideoInputFields(): void
    {
        $seenRoles = [];
        foreach ($this->getFrames() as $index => $frame) {
            if (! is_array($frame)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.frames.%d must be an object', $index));
            }

            $role = trim((string) ($frame['role'] ?? ''));
            if (! in_array($role, self::FRAME_ROLES, true)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.frames.%d.role is invalid', $index));
            }
            if (isset($seenRoles[$role])) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.frames.%d.role is duplicated', $index));
            }
            $seenRoles[$role] = true;

            $this->assertImageInputSource($frame, sprintf('inputs.frames.%d', $index));
        }

        foreach ($this->getReferenceImages() as $index => $referenceImage) {
            if (! is_array($referenceImage)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.reference_images.%d must be an object', $index));
            }

            $this->assertImageInputSource($referenceImage, sprintf('inputs.reference_images.%d', $index));

            $type = trim((string) ($referenceImage['type'] ?? ''));
            if ($type !== '' && ! in_array($type, self::REFERENCE_IMAGE_TYPES, true)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.reference_images.%d.type is invalid', $index));
            }
        }

        if ($this->inputMode !== '' && ! VideoInputMode::isRequestValid($this->getInputMode())) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'input_mode is invalid');
        }

        $this->assertMediaObject($this->inputs['mask'] ?? null, 'inputs.mask');
        $this->assertMediaObjectList($this->getReferenceVideos(), 'inputs.reference_videos');
        $this->assertMediaObjectList($this->getReferenceAudios(), 'inputs.reference_audios');
        $this->assertDraftTaskInput();
    }

    /**
     * 校验样片成片引用：单个对象，必须给出 video_id 或 uri 之一。
     */
    private function assertDraftTaskInput(): void
    {
        $draftTask = $this->getDraftTask();
        if ($draftTask === []) {
            if ($this->isDraftTask()) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'inputs.draft_task is required');
            }
            return;
        }

        // 样片引用是单个对象（与 inputs.mask 同构），不是列表。误传成列表时两个字段整体读不到，
        // 不先拦下来只会退化成「video_id or uri is required」这种指向错误的提示。
        if (array_is_list($draftTask)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'inputs.draft_task must be an object');
        }

        $videoId = trim((string) ($draftTask['video_id'] ?? ''));
        $uri = trim((string) ($draftTask['uri'] ?? ''));
        if ($videoId === '' && $uri === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'inputs.draft_task.video_id or inputs.draft_task.uri is required');
        }
        if ($uri !== '' && (str_contains($uri, '://') || str_contains($uri, "\0"))) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'inputs.draft_task.uri is invalid');
        }
    }

    /**
     * 是否为样片成片请求：只由 input_mode 判定，task 保持 generate 即可。
     */
    private function isDraftTask(): bool
    {
        return $this->inputMode === VideoInputMode::DraftTask->value;
    }

    private function assertGenerationFields(): void
    {
        $this->assertOptionalStringField($this->generation, 'aspect_ratio', 'generation.aspect_ratio', 20);
        $this->assertOptionalStringField($this->generation, 'size', 'generation.size', 50);
        $this->assertOptionalStringField($this->generation, 'mode', 'generation.mode', 20);
        $this->assertOptionalPositiveIntField($this->generation, 'duration_seconds', 'generation.duration_seconds');
        $this->assertOptionalStringField($this->generation, 'resolution', 'generation.resolution', 20);
        $this->assertOptionalPositiveIntField($this->generation, 'fps', 'generation.fps');
        if (array_key_exists('seed', $this->generation) && $this->generation['seed'] !== null && ! is_int($this->generation['seed'])) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'generation.seed must be an integer');
        }
        $this->assertOptionalPositiveIntField($this->generation, 'sample_count', 'generation.sample_count');
        $this->assertOptionalBoolField($this->generation, 'watermark', 'generation.watermark');
        $this->assertOptionalStringField($this->generation, 'negative_prompt', 'generation.negative_prompt', 4096);
        $this->assertOptionalBoolField($this->generation, 'generate_audio', 'generation.generate_audio');
        $this->assertOptionalBoolField($this->generation, 'web_search', 'generation.web_search');
        $this->assertOptionalBoolField($this->generation, 'draft', 'generation.draft');
        $this->assertOptionalStringField($this->generation, 'person_generation', 'generation.person_generation', 50);
        $this->assertOptionalBoolField($this->generation, 'enhance_prompt', 'generation.enhance_prompt');
        $this->assertOptionalStringField($this->generation, 'compression_quality', 'generation.compression_quality', 50);
        $this->assertOptionalStringField($this->generation, 'resize_mode', 'generation.resize_mode', 50);
        $this->assertOptionalBoolField($this->generation, 'camera_fixed', 'generation.camera_fixed');
        $this->assertOptionalBoolField($this->generation, 'return_last_frame', 'generation.return_last_frame');
    }

    private function assertCallbackAndExecutionFields(): void
    {
        $this->assertOptionalStringField($this->callbacks, 'webhook_url', 'callbacks.webhook_url', 4096);
        $this->assertOptionalStringField($this->execution, 'service_tier', 'execution.service_tier', 20);
        if (array_key_exists('service_tier', $this->execution)
            && $this->execution['service_tier'] !== null
            && ! in_array($this->execution['service_tier'], self::SERVICE_TIERS, true)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'execution.service_tier is invalid');
        }
        $this->assertOptionalPositiveIntField($this->execution, 'expires_after_seconds', 'execution.expires_after_seconds');
    }

    private function assertExtensionFields(): void
    {
        foreach ($this->extensions as $namespace => $extension) {
            if (! is_array($extension)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('extensions.%s must be an object', $namespace));
            }
        }
    }

    private function hydrate(array $data): void
    {
        $this->setProjectId($data['project_id'] ?? null);
        $this->setVideoId($data['video_id'] ?? null);
        $this->setGenerationType($data['generation_type'] ?? null);
        $this->setModelId($data['model_id'] ?? null);
        $this->setTopicId($data['topic_id'] ?? null);
        $this->setTaskId($data['task_id'] ?? null);
        $this->setTask($data['task'] ?? null);
        $this->setInputMode($data['input_mode'] ?? null);
        $this->setPrompt($data['prompt'] ?? null);
        $this->setFileDir($data['file_dir'] ?? null);
        $this->setFileName($data['file_name'] ?? null);
        $this->setInputs($data['inputs'] ?? null);
        $this->setGeneration($data['generation'] ?? null);
        $this->setComposition($data['composition'] ?? null);
        $this->setCallbacks($data['callbacks'] ?? null);
        $this->setExecution($data['execution'] ?? null);
        $this->setExtensions($data['extensions'] ?? null);
    }

    private function normalizeJsonArrayInput(mixed $value): array
    {
        if (is_string($value) && json_validate($value)) {
            $value = Json::decode($value, true);
        }

        return is_array($value) ? $value : [];
    }

    /** 校验合成媒体对象只包含非空 workspace-relative 路径。 */
    private function assertCompositionMedia(mixed $value, string $path): void
    {
        if (! is_array($value)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be an object', $path));
        }
        $mediaPath = trim((string) ($value['path'] ?? ''));
        if ($mediaPath === '' || str_contains($mediaPath, '://') || str_contains($mediaPath, "\0")) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s.path is invalid', $path));
        }
        $segments = explode('/', trim($mediaPath, '/'));
        if (in_array('.', $segments, true) || in_array('..', $segments, true)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s.path is invalid', $path));
        }
    }

    private function assertMediaObject(mixed $value, string $path): void
    {
        if ($value === null) {
            return;
        }

        if (! is_array($value)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be an object', $path));
        }

        $uri = trim((string) ($value['uri'] ?? ''));
        if ($uri === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s.uri is required', $path));
        }
    }

    /**
     * 校验视频图片输入来源，兼容工作区路径和 Base64 图片两种协议。
     *
     * @param array<string, mixed> $input
     */
    private function assertImageInputSource(array $input, string $path): void
    {
        $sourceType = trim((string) ($input['source_type'] ?? ''));
        $uri = trim((string) ($input['uri'] ?? ''));
        $base64Data = trim((string) ($input['base64_data'] ?? ''));
        $mimeType = strtolower(trim((string) ($input['mime_type'] ?? '')));

        if ($sourceType !== '' && ! in_array($sourceType, self::VIDEO_IMAGE_SOURCE_TYPES, true)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s.source_type is invalid', $path));
        }

        $hasBase64 = $base64Data !== '' || $mimeType !== '' || $sourceType === 'base64';
        if ($hasBase64) {
            if ($sourceType !== 'base64' || $uri !== '' || $base64Data === '' || $mimeType === '') {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s Base64 source is invalid', $path));
            }
            if (! in_array($mimeType, self::VIDEO_IMAGE_MIME_TYPES, true)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s.mime_type is invalid', $path));
            }
            $normalizedBase64 = preg_replace('/\s+/', '', $base64Data);
            if (! is_string($normalizedBase64) || $normalizedBase64 === '' || base64_decode($normalizedBase64, true) === false) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s.base64_data is invalid', $path));
            }
            return;
        }

        if ($uri === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s.uri is required', $path));
        }
    }

    /**
     * @param list<mixed> $values
     */
    private function assertMediaObjectList(array $values, string $path): void
    {
        foreach ($values as $index => $value) {
            $this->assertMediaObject($value, sprintf('%s.%d', $path, $index));
        }
    }

    private function assertOptionalStringField(array $data, string $field, string $path, int $maxLength): void
    {
        if (! array_key_exists($field, $data) || $data[$field] === null) {
            return;
        }

        if (! is_string($data[$field])) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be a string', $path));
        }

        if (mb_strlen($data[$field]) > $maxLength) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s is too long', $path));
        }
    }

    private function assertOptionalPositiveIntField(array $data, string $field, string $path): void
    {
        if (! array_key_exists($field, $data) || $data[$field] === null) {
            return;
        }

        if (! is_int($data[$field]) || $data[$field] < 1) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be a positive integer', $path));
        }
    }

    private function assertOptionalBoolField(array $data, string $field, string $path): void
    {
        if (! array_key_exists($field, $data) || $data[$field] === null) {
            return;
        }

        if (! is_bool($data[$field])) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be a boolean', $path));
        }
    }
}
