<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Create message queue request DTO.
 * Used to receive request parameters for creating message queue.
 */
class CreateMessageQueueRequestDTO extends AbstractRequestDTO
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
     * Message content.
     */
    public string $messageContent = '';

    /**
     * Get project ID.
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }

    /**
     * Get topic ID.
     */
    public function getTopicId(): string
    {
        return $this->topicId;
    }

    /**
     * Get message content.
     */
    public function getMessageContent(): string
    {
        return $this->messageContent;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string',
            'topic_id' => 'required|string',
            'message_content' => 'required|string|max:65535',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_id.required' => 'Project ID cannot be empty',
            'project_id.string' => 'Project ID must be a string',
            'topic_id.required' => 'Topic ID cannot be empty',
            'topic_id.string' => 'Topic ID must be a string',
            'message_content.required' => 'Message content cannot be empty',
            'message_content.string' => 'Message content must be a string',
            'message_content.max' => 'Message content cannot exceed 65535 characters',
        ];
    }
}
