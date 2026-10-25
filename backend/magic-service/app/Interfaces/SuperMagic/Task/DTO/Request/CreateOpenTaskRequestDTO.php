<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Task\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractRequestDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\Utils\TiptapBuilder;
use App\Interfaces\SuperMagic\File\DTO\Request\FileReferenceSelectorDTO;
use JsonException;

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

    public string $contentType = 'text';

    public ?array $richContent = null;

    public array $fileIds = [];

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

    /**
     * Interrupt the current task instead of queuing this message.
     */
    public bool $forceInterrupt = false;

    /**
     * Hire the resolved task employee from the market when not already usable.
     */
    public bool $autoHireAgent = false;

    /**
     * Optional extra message subscription config (single item).
     * Will be appended to the system subscription list when initializing the sandbox.
     * Supported fields: method, url, auth_scheme, headers.
     */
    public ?array $messageSubscriptionConfig = null;

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

    public function getContentType(): string
    {
        return $this->contentType;
    }

    public function getRichContent(): ?array
    {
        return $this->richContent;
    }

    public function getFileIds(): array
    {
        return $this->fileIds;
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

    public function setEnableWebSearch(null|bool|int|string $enableWebSearch): void
    {
        $this->enableWebSearch = $enableWebSearch === null || in_array($enableWebSearch, [true, 1, '1'], true);
    }

    public function isForceInterrupt(): bool
    {
        return $this->forceInterrupt;
    }

    public function setForceInterrupt(null|bool|int|string $forceInterrupt): void
    {
        $this->forceInterrupt = in_array($forceInterrupt, [true, 1, '1'], true);
    }

    public function setAutoHireAgent(bool|int|string $autoHireAgent): void
    {
        // Normalize the boolean representations accepted by Hyperf validation.
        $this->autoHireAgent = in_array($autoHireAgent, [true, 1, '1'], true);
    }

    public function isAutoHireAgent(): bool
    {
        return $this->autoHireAgent;
    }

    public function getMessageSubscriptionConfig(): ?array
    {
        return $this->messageSubscriptionConfig;
    }

    /**
     * Convert this Open API DTO to the internal CreateTaskRequestDTO format.
     *
     * All format differences (plain text → Tiptap, model/agent config placement)
     * are handled here so callers stay clean.
     */
    public function toCreateTaskRequestDTO(): CreateTaskRequestDTO
    {
        if ($this->contentType === 'rich_text') {
            return new CreateTaskRequestDTO([
                'project_id' => $this->projectId,
                'topic_id' => $this->topicId,
                'message_type' => 'rich_text',
                'message_content' => $this->richContent,
                'force_interrupt' => $this->forceInterrupt,
            ]);
        }
        $superAgent = [
            'mentions' => [],
            'chat_mode' => 'normal',
            'topic_pattern' => $this->agentMode ?: 'general',
            'enable_web_search' => $this->enableWebSearch,
        ];

        if ($this->modelId !== '') {
            $superAgent['model'] = ['model_id' => $this->modelId];
        }
        if ($this->imageModelId !== '') {
            $superAgent['image_model'] = ['model_id' => $this->imageModelId];
        }
        if ($this->videoModelId !== '') {
            $superAgent['video_model'] = ['model_id' => $this->videoModelId];
        }

        return new CreateTaskRequestDTO([
            'project_id' => $this->projectId,
            'topic_id' => $this->topicId,
            'message_type' => 'rich_text',
            'force_interrupt' => $this->forceInterrupt,
            'message_content' => [
                'content' => TiptapBuilder::plainTextToJson($this->content),
                'instructs' => [['value' => 'normal']],
                'extra' => ['super_agent' => $superAgent],
            ],
        ]);
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string',
            'topic_id' => 'required|string',
            'content_type' => 'sometimes|string|in:text,rich_text',
            'content' => 'sometimes|string|max:65000',
            'rich_content' => 'nullable|array',
            'rich_content.content' => 'required_if:content_type,rich_text|string|max:65000',
            'rich_content.instructs' => 'nullable|array',
            'rich_content.instructs.*.value' => 'required|string',
            'rich_content.instructs.*.instruction' => 'nullable|array',
            'rich_content.attachments' => 'nullable|array',
            'rich_content.attachments.*' => 'array',
            'rich_content.extra' => 'nullable|array',
            'rich_content.extra.super_agent' => 'nullable|array',
            'rich_content.extra.super_agent.chat_mode' => 'nullable|string',
            'rich_content.extra.super_agent.topic_pattern' => 'nullable|string',
            'rich_content.extra.super_agent.agent_code' => 'nullable|string',
            'rich_content.extra.super_agent.mentions' => 'nullable|array',
            'rich_content.extra.super_agent.mentions.*' => 'array',
            'rich_content.extra.super_agent.dynamic_params' => 'nullable|array',
            'rich_content.extra.super_agent.enable_web_search' => 'nullable|boolean',
            'rich_content.extra.super_agent.model' => 'nullable|array',
            'rich_content.extra.super_agent.model.model_id' => 'nullable|string',
            'rich_content.extra.super_agent.model.model_name' => 'nullable|string',
            'rich_content.extra.super_agent.model.model_icon' => 'nullable|string',
            'rich_content.extra.super_agent.image_model' => 'nullable|array',
            'rich_content.extra.super_agent.image_model.model_id' => 'nullable|string',
            'rich_content.extra.super_agent.image_model.model_name' => 'nullable|string',
            'rich_content.extra.super_agent.image_model.model_icon' => 'nullable|string',
            'rich_content.extra.super_agent.video_model' => 'nullable|array',
            'rich_content.extra.super_agent.video_model.model_id' => 'nullable|string',
            'rich_content.extra.super_agent.video_model.model_name' => 'nullable|string',
            'rich_content.extra.super_agent.video_model.model_icon' => 'nullable|string',
            'file_ids' => 'sometimes|array|max:100',
            'file_ids.*' => ['required', 'string', 'regex:/^[1-9][0-9]*$/D'],
            'agent_mode' => 'nullable|string|max:50',
            'model_id' => 'nullable|string|max:100',
            'image_model_id' => 'nullable|string|max:100',
            'video_model_id' => 'nullable|string|max:100',
            'enable_web_search' => 'nullable|boolean',
            'force_interrupt' => 'nullable|boolean',
            'auto_hire_agent' => 'sometimes|boolean',
            'message_subscription_config' => 'nullable|array',
            'message_subscription_config.method' => 'required_with:message_subscription_config|string',
            'message_subscription_config.url' => 'required_with:message_subscription_config|string',
            'message_subscription_config.auth_scheme' => 'nullable|string',
            'message_subscription_config.headers' => 'nullable|array',
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
            'force_interrupt.boolean' => 'Force interrupt must be a boolean value',
            'auto_hire_agent.boolean' => 'Auto hire agent must be a boolean value',
            'message_subscription_config.array' => 'Message subscription config must be an array',
            'message_subscription_config.method.required_with' => 'Subscription config method is required',
            'message_subscription_config.method.string' => 'Subscription config method must be a string',
            'message_subscription_config.url.required_with' => 'Subscription config URL is required',
            'message_subscription_config.url.string' => 'Subscription config URL must be a string',
        ];
    }

    protected static function checkParams(array $params): array
    {
        $params = parent::checkParams($params);
        $type = $params['content_type'] ?? 'text';
        if ($type === 'text') {
            if (trim($params['content'] ?? '') === '' || ($params['rich_content'] ?? null) !== null) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.invalid_text_content');
            }
        } elseif ($type === 'rich_text') {
            if (($params['content'] ?? '') !== '' || ($params['file_ids'] ?? []) !== []) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.content_conflict');
            }
            foreach (['agent_mode', 'model_id', 'image_model_id', 'video_model_id', 'enable_web_search'] as $field) {
                if (array_key_exists($field, $params)) {
                    ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.configuration_conflict');
                }
            }
            self::assertTiptapDocument($params['rich_content']['content']);
        } else {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.invalid_content_type');
        }
        if (! array_is_list($params['file_ids'] ?? [])) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.invalid_file_ids');
        }
        foreach ($params['file_ids'] ?? [] as $id) {
            if (! FileReferenceSelectorDTO::fromInput(['file_id' => $id])->isValid()) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.invalid_file_ids');
            }
        }
        return $params;
    }

    private static function assertTiptapDocument(string $content): void
    {
        try {
            $document = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.invalid_rich_content');
        }
        if (! is_array($document) || ($document['type'] ?? '') !== 'doc' || ! is_array($document['content'] ?? null)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'task.open_api.invalid_rich_content');
        }
    }
}
