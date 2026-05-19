<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Create special project request DTO.
 * Used to receive request parameters for creating or getting a special project by key.
 */
class CreateSpecialProjectRequestDTO extends AbstractRequestDTO
{
    /**
     * Special project unique key.
     */
    public string $key = '';

    /**
     * Project name.
     */
    public string $projectName = '';

    /**
     * Project mode.
     */
    public string $projectMode = '';

    /**
     * Topic mode.
     */
    public string $topicMode = '';

    /**
     * Dynamic parameters.
     */
    public array $dynamicParams = [];

    public function getKey(): string
    {
        return $this->key;
    }

    public function getProjectName(): string
    {
        return $this->projectName ?: $this->key;
    }

    public function getProjectMode(): string
    {
        return $this->projectMode;
    }

    public function getTopicMode(): string
    {
        return $this->topicMode;
    }

    public function getDynamicParams(): array
    {
        return $this->dynamicParams;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'key' => 'required|string|max:255',
            'project_name' => 'nullable|string|max:100',
            'project_mode' => 'nullable|string',
            'topic_mode' => 'nullable|string',
            'dynamic_params' => 'nullable|array',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'key.required' => 'Special project key cannot be empty',
            'key.max' => 'Special project key cannot exceed 255 characters',
            'project_name.max' => 'Project name cannot exceed 100 characters',
        ];
    }
}
