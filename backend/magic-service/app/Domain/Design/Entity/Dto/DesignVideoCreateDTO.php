<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Entity\Dto;

use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Codec\Json;

class DesignVideoCreateDTO extends AbstractDTO
{
    public const string DEFAULT_TASK = 'generate';

    public const array SUPPORTED_TASKS = ['generate', 'extend', 'edit', 'upscale'];

    public const array FRAME_ROLES = ['start', 'end'];

    public const array AUDIO_ROLES = ['reference'];

    public const array REFERENCE_IMAGE_TYPES = ['asset', 'style'];

    public const array SERVICE_TIERS = ['default', 'flex'];

    private const array TOP_LEVEL_ARRAY_FIELDS = ['inputs', 'generation', 'callbacks', 'execution', 'extensions'];

    private const array ROOT_ALLOWED_KEYS = [
        'project_id',
        'video_id',
        'model_id',
        'topic_id',
        'task_id',
        'task',
        'prompt',
        'file_dir',
        'file_name',
        'inputs',
        'generation',
        'callbacks',
        'execution',
        'extensions',
    ];

    private const array INPUT_ALLOWED_KEYS = ['frames', 'reference_images', 'video', 'mask', 'audio'];

    private const array GENERATION_ALLOWED_KEYS = [
        'size',
        'mode',
        'aspect_ratio',
        'duration_seconds',
        'resolution',
        'fps',
        'seed',
        'sample_count',
        'negative_prompt',
        'generate_audio',
        'person_generation',
        'enhance_prompt',
        'compression_quality',
        'resize_mode',
        'watermark',
        'camera_fixed',
        'return_last_frame',
    ];

    private const array CALLBACK_ALLOWED_KEYS = ['webhook_url'];

    private const array EXECUTION_ALLOWED_KEYS = ['service_tier', 'expires_after_seconds'];

    private const array FRAME_ALLOWED_KEYS = ['role', 'uri'];

    private const array MEDIA_ALLOWED_KEYS = ['uri'];

    private const array REFERENCE_IMAGE_ALLOWED_KEYS = ['uri', 'type'];

    private const string AUDIO_ROLE_REFERENCE = self::AUDIO_ROLES[0];

    protected ?int $projectId = null;

    protected string $videoId = '';

    protected string $modelId = '';

    protected string $topicId = '';

    protected string $taskId = '';

    protected string $task = self::DEFAULT_TASK;

    protected string $prompt = '';

    protected string $fileDir = '';

    protected ?string $fileName = null;

    protected array $inputs = [];

    protected array $generation = [];

    protected array $callbacks = [];

    protected array $execution = [];

    protected array $extensions = [];

    private array $rawData;

    public function __construct(?array $data = null)
    {
        $this->rawData = is_array($data) ? $data : [];
        $this->hydrate($this->rawData);
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
        $this->task = $normalized === '' ? self::DEFAULT_TASK : $normalized;
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

    public function getVideo(): ?string
    {
        $inputs = $this->getInputs();
        $video = $inputs['video'] ?? null;
        if (! is_array($video)) {
            return null;
        }

        $uri = trim((string) ($video['uri'] ?? ''));
        return $uri === '' ? null : $uri;
    }

    public function setVideo(?string $uri): void
    {
        if ($uri === null || trim($uri) === '') {
            unset($this->inputs['video']);
            return;
        }

        $this->inputs['video'] = ['uri' => trim($uri)];
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

    public function getAudioInputs(): array
    {
        $inputs = $this->getInputs();
        $audio = $inputs['audio'] ?? [];
        return is_array($audio) ? array_values($audio) : [];
    }

    public function setAudioInputs(mixed $audio): void
    {
        $this->inputs['audio'] = array_values($this->normalizeJsonArrayInput($audio));
    }

    public function valid(): void
    {
        if (($this->projectId ?? 0) <= 0) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'project_id is required');
        }
        if ($this->videoId === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'video_id is required');
        }
        if ($this->modelId === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
        }
        if (! in_array($this->task, self::SUPPORTED_TASKS, true)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'task is invalid');
        }
        if ($this->prompt === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'prompt is required');
        }
        if ($this->fileDir === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'file_dir is required');
        }

        foreach (self::TOP_LEVEL_ARRAY_FIELDS as $field) {
            $this->assertTopLevelArrayField($field);
        }

        $this->assertAllowedKeys($this->rawData, self::ROOT_ALLOWED_KEYS, 'root');
        $this->assertAllowedKeys($this->inputs, self::INPUT_ALLOWED_KEYS, 'inputs');
        $this->assertAllowedKeys($this->generation, self::GENERATION_ALLOWED_KEYS, 'generation');
        $this->assertAllowedKeys($this->callbacks, self::CALLBACK_ALLOWED_KEYS, 'callbacks');
        $this->assertAllowedKeys($this->execution, self::EXECUTION_ALLOWED_KEYS, 'execution');

        $seenRoles = [];
        foreach ($this->getFrames() as $index => $frame) {
            if (! is_array($frame)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.frames.%d must be an object', $index));
            }

            $this->assertAllowedKeys($frame, self::FRAME_ALLOWED_KEYS, sprintf('inputs.frames.%d', $index));

            $role = trim((string) ($frame['role'] ?? ''));
            if (! in_array($role, self::FRAME_ROLES, true)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.frames.%d.role is invalid', $index));
            }
            if (isset($seenRoles[$role])) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.frames.%d.role is duplicated', $index));
            }
            $seenRoles[$role] = true;

            $uri = trim((string) ($frame['uri'] ?? ''));
            if ($uri === '') {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.frames.%d.uri is required', $index));
            }
        }

        foreach ($this->getReferenceImages() as $index => $referenceImage) {
            if (! is_array($referenceImage)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.reference_images.%d must be an object', $index));
            }

            $this->assertAllowedKeys($referenceImage, self::REFERENCE_IMAGE_ALLOWED_KEYS, sprintf('inputs.reference_images.%d', $index));

            $uri = trim((string) ($referenceImage['uri'] ?? ''));
            if ($uri === '') {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.reference_images.%d.uri is required', $index));
            }

            $type = trim((string) ($referenceImage['type'] ?? ''));
            if ($type !== '' && ! in_array($type, self::REFERENCE_IMAGE_TYPES, true)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.reference_images.%d.type is invalid', $index));
            }
        }

        $this->assertMediaObject($this->inputs['video'] ?? null, 'inputs.video');
        $this->assertMediaObject($this->inputs['mask'] ?? null, 'inputs.mask');

        foreach ($this->getAudioInputs() as $index => $item) {
            if (! is_array($item)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.audio.%d must be an object', $index));
            }

            $this->assertAllowedKeys($item, self::FRAME_ALLOWED_KEYS, sprintf('inputs.audio.%d', $index));

            $role = trim((string) ($item['role'] ?? ''));
            if ($role !== self::AUDIO_ROLE_REFERENCE) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.audio.%d.role is invalid', $index));
            }

            $uri = trim((string) ($item['uri'] ?? ''));
            if ($uri === '') {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.audio.%d.uri is required', $index));
            }
        }

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
        $this->assertOptionalStringField($this->generation, 'person_generation', 'generation.person_generation', 50);
        $this->assertOptionalBoolField($this->generation, 'enhance_prompt', 'generation.enhance_prompt');
        $this->assertOptionalStringField($this->generation, 'compression_quality', 'generation.compression_quality', 50);
        $this->assertOptionalStringField($this->generation, 'resize_mode', 'generation.resize_mode', 50);
        $this->assertOptionalBoolField($this->generation, 'camera_fixed', 'generation.camera_fixed');
        $this->assertOptionalBoolField($this->generation, 'return_last_frame', 'generation.return_last_frame');

        $this->assertOptionalStringField($this->callbacks, 'webhook_url', 'callbacks.webhook_url', 4096);
        $this->assertOptionalStringField($this->execution, 'service_tier', 'execution.service_tier', 20);
        if (array_key_exists('service_tier', $this->execution)
            && $this->execution['service_tier'] !== null
            && ! in_array($this->execution['service_tier'], self::SERVICE_TIERS, true)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'execution.service_tier is invalid');
        }
        $this->assertOptionalPositiveIntField($this->execution, 'expires_after_seconds', 'execution.expires_after_seconds');

        foreach ($this->extensions as $namespace => $extension) {
            if (! is_array($extension)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('extensions.%s must be an object', $namespace));
            }
        }
    }

    public function getType(): string
    {
        return 'video';
    }

    private function assertAllowedKeys(array $data, array $allowedKeys, string $path): void
    {
        foreach (array_keys($data) as $key) {
            if (! is_string($key) || ! in_array($key, $allowedKeys, true)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s.%s is not supported', $path, $key));
            }
        }
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

    private function hydrate(array $data): void
    {
        $this->setProjectId($data['project_id'] ?? null);
        $this->setVideoId($data['video_id'] ?? null);
        $this->setModelId($data['model_id'] ?? null);
        $this->setTopicId($data['topic_id'] ?? null);
        $this->setTaskId($data['task_id'] ?? null);
        $this->setTask($data['task'] ?? null);
        $this->setPrompt($data['prompt'] ?? null);
        $this->setFileDir($data['file_dir'] ?? null);
        $this->setFileName($data['file_name'] ?? null);
        $this->setInputs($data['inputs'] ?? null);
        $this->setGeneration($data['generation'] ?? null);
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

    private function assertMediaObject(mixed $value, string $path): void
    {
        if ($value === null) {
            return;
        }

        if (! is_array($value)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be an object', $path));
        }

        $this->assertAllowedKeys($value, self::MEDIA_ALLOWED_KEYS, $path);

        $uri = trim((string) ($value['uri'] ?? ''));
        if ($uri === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s.uri is required', $path));
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
