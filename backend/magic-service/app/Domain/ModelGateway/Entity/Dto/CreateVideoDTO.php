<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use JsonException;

class CreateVideoDTO extends AbstractRequestDTO
{
    private const array SUPPORTED_TASKS = ['generate', 'extend', 'edit', 'upscale'];

    private const array TOP_LEVEL_ARRAY_FIELDS = ['inputs', 'generation', 'callbacks', 'execution', 'extensions'];

    protected string $task = '';

    protected string $prompt = '';

    protected array $inputs = [];

    protected array $generation = [];

    protected array $callbacks = [];

    protected array $execution = [];

    protected array $extensions = [];

    private array $rawData;

    public function __construct(?array $data = null)
    {
        $this->rawData = is_array($data) ? $data : [];
        $hydrateData = $this->rawData;
        $this->hydrateExplicitFields($hydrateData);

        parent::__construct($hydrateData);
        $this->callMethod = 'create_video';
    }

    public function setPrompt(mixed $prompt): void
    {
        $this->prompt = is_string($prompt) ? trim($prompt) : '';
    }

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function setModelId(mixed $modelId): void
    {
        $normalized = match (true) {
            is_string($modelId) => trim($modelId),
            is_int($modelId) => (string) $modelId,
            default => '',
        };

        $this->setModel($normalized);
        if ($normalized !== '') {
            $this->setOriginalModelId($normalized);
        }
    }

    public function setTask(mixed $task): void
    {
        $normalized = is_string($task) ? trim($task) : '';
        $this->task = $normalized === '' ? self::SUPPORTED_TASKS[0] : $normalized;
    }

    public function getTask(): string
    {
        return $this->task;
    }

    public function setInputs(mixed $inputs): void
    {
        $this->inputs = $this->normalizeArrayField($inputs);
    }

    public function getInputs(): array
    {
        return $this->inputs;
    }

    public function setGeneration(mixed $generation): void
    {
        $this->generation = $this->normalizeArrayField($generation);
    }

    public function getGeneration(): array
    {
        return $this->generation;
    }

    public function setCallbacks(mixed $callbacks): void
    {
        $this->callbacks = $this->normalizeArrayField($callbacks);
    }

    public function getCallbacks(): array
    {
        return $this->callbacks;
    }

    public function setExecution(mixed $execution): void
    {
        $this->execution = $this->normalizeArrayField($execution);
    }

    public function getExecution(): array
    {
        return $this->execution;
    }

    public function setExtensions(mixed $extensions): void
    {
        $this->extensions = $this->normalizeArrayField($extensions);
    }

    public function getExtensions(): array
    {
        return $this->extensions;
    }

    public function valid(): void
    {
        if ($this->model === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
        }

        if (! in_array($this->task, self::SUPPORTED_TASKS, true)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'task is invalid');
        }

        if ($this->prompt === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'prompt is required');
        }

        foreach (self::TOP_LEVEL_ARRAY_FIELDS as $field) {
            $this->assertTopLevelArrayField($field);
        }

        // 这里不再拦未知字段或 provider 级非法参数，统一交给 domain 做“宽进严出”归一化。
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

        if (! is_string($value)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be an array or valid json object', $field));
        }

        $decoded = $this->decodeJsonValue($value, $field);
        if (! is_array($decoded)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be an array or valid json object', $field));
        }
    }

    private function hydrateExplicitFields(array &$hydrateData): void
    {
        $hydrators = [
            'model_id' => $this->setModelId(...),
            'prompt' => $this->setPrompt(...),
            'task' => $this->setTask(...),
            'inputs' => $this->setInputs(...),
            'generation' => $this->setGeneration(...),
            'callbacks' => $this->setCallbacks(...),
            'execution' => $this->setExecution(...),
            'extensions' => $this->setExtensions(...),
        ];

        foreach ($hydrators as $field => $hydrator) {
            if (! array_key_exists($field, $hydrateData)) {
                continue;
            }

            $hydrator($hydrateData[$field]);
            unset($hydrateData[$field]);
        }
    }

    private function normalizeArrayField(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value)) {
            return [];
        }

        $decoded = $this->decodeJsonValue($value);
        return is_array($decoded) ? $decoded : [];
    }

    private function decodeJsonValue(string $value, ?string $field = null): mixed
    {
        if (! json_validate($value)) {
            if ($field !== null) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be an array or valid json object', $field));
            }

            return [];
        }

        try {
            return json_decode($value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            if ($field !== null) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s must be an array or valid json object', $field));
            }

            return [];
        }
    }
}
