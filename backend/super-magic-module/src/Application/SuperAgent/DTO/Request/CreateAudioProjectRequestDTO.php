<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Create Audio Project Request DTO.
 */
class CreateAudioProjectRequestDTO extends AbstractRequestDTO
{
    /**
     * Project name.
     */
    public string $projectName = '';

    /**
     * Workspace ID.
     */
    public string $workspaceId = '';

    /**
     * Recording source: app | device.
     */
    public string $source = 'app';

    /**
     * Device ID (optional).
     */
    public string $deviceId = '';

    /**
     * Whether the project is hidden (default: true for audio projects).
     */
    public bool $isHidden = true;

    /**
     * ASR task key (unique identifier, required).
     */
    public string $taskKey = '';

    /**
     * Whether to auto summary (default: true).
     */
    public bool $autoSummary = true;

    /**
     * AI model ID for summary (optional).
     */
    public string $modelId = '';

    /**
     * Audio source: recorded | imported.
     */
    public string $audioSource = 'recorded';

    // Getters

    public function getProjectName(): string
    {
        return $this->projectName;
    }

    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }

    public function getSource(): string
    {
        return $this->source;
    }

    public function getDeviceId(): string
    {
        return $this->deviceId;
    }

    public function getIsHidden(): bool
    {
        return $this->isHidden;
    }

    public function getTaskKey(): string
    {
        return $this->taskKey;
    }

    public function getAutoSummary(): bool
    {
        return $this->autoSummary;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function getAudioSource(): string
    {
        return $this->audioSource;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_name' => 'required|string|max:255',
            'workspace_id' => 'nullable|string',
            'source' => 'required|string|in:app,device',
            'device_id' => 'nullable|string|max:100',
            'is_hidden' => 'nullable|boolean',
            'task_key' => 'required|string|max:128',
            'auto_summary' => 'nullable|boolean',
            'model_id' => 'nullable|string|max:128',
            'audio_source' => 'required|string|in:recorded,imported',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_name.required' => 'Project name cannot be empty',
            'project_name.max' => 'Project name cannot exceed 255 characters',
            'source.required' => 'Source cannot be empty',
            'source.in' => 'Source must be either app or device',
            'device_id.max' => 'Device ID cannot exceed 100 characters',
            'is_hidden.boolean' => 'Is hidden must be a boolean value',
            'task_key.required' => 'Task key is required',
            'task_key.max' => 'Task key cannot exceed 128 characters',
            'auto_summary.boolean' => 'Auto summary must be a boolean value',
            'model_id.max' => 'Model ID cannot exceed 128 characters',
            'audio_source.required' => 'Audio source cannot be empty',
            'audio_source.in' => 'Audio source must be either recorded or imported',
        ];
    }
}
