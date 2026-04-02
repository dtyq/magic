<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Create open task request DTO (simplified for open API).
 * This DTO provides a simplified interface for external API calls,
 * converting simple parameters to the complex internal message structure.
 */
class CreateOpenTaskRequestDTO extends AbstractRequestDTO
{
    /**
     * Project ID.
     */
    public string $projectId = '';

    /**
     * Topic ID.
     */
    public string $topicId = '';

    /**
     * Message content (plain text, will be converted to Tiptap format).
     */
    public string $content = '';

    /**
     * Agent mode (topic pattern).
     * Frontend can define custom values like: general, debug, etc.
     */
    public string $agentMode = 'general';

    /**
     * LLM model ID (optional).
     */
    public string $modelId = '';

    /**
     * Image model ID (optional).
     */
    public string $imageModelId = '';

    /**
     * Video model ID (optional).
     */
    public string $videoModelId = '';

    /**
     * Enable web search.
     */
    public bool $enableWebSearch = true;

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function getAgentMode(): string
    {
        return $this->agentMode;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function getImageModelId(): string
    {
        return $this->imageModelId;
    }

    public function getVideoModelId(): string
    {
        return $this->videoModelId;
    }

    public function getEnableWebSearch(): bool
    {
        return $this->enableWebSearch;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string',
            'topic_id' => 'required|string',
            'content' => 'required|string|max:65000',
            'agent_mode' => 'nullable|string|max:50',
            'model_id' => 'nullable|string|max:100',
            'image_model_id' => 'nullable|string|max:100',
            'video_model_id' => 'nullable|string|max:100',
            'enable_web_search' => 'nullable|boolean',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_id.required' => 'Project ID is required',
            'project_id.string' => 'Project ID must be a string',
            'topic_id.required' => 'Topic ID is required',
            'topic_id.string' => 'Topic ID must be a string',
            'content.required' => 'Message content is required',
            'content.string' => 'Message content must be a string',
            'content.max' => 'Message content cannot exceed 65000 characters',
            'agent_mode.string' => 'Agent mode must be a string',
            'agent_mode.max' => 'Agent mode cannot exceed 50 characters',
            'model_id.string' => 'Model ID must be a string',
            'model_id.max' => 'Model ID cannot exceed 100 characters',
            'image_model_id.string' => 'Image model ID must be a string',
            'image_model_id.max' => 'Image model ID cannot exceed 100 characters',
            'video_model_id.string' => 'Video model ID must be a string',
            'video_model_id.max' => 'Video model ID cannot exceed 100 characters',
            'enable_web_search.boolean' => 'Enable web search must be a boolean value',
        ];
    }
}
