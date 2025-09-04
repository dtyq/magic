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
    public array $messageContent = [];

    /**
     * Message type.
     */
    public string $messageType = '';

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
    public function getMessageContent(): array
    {
        return $this->messageContent;
    }

    /**
     * Get message type.
     */
    public function getMessageType(): string
    {
        return $this->messageType;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string',
            'topic_id' => 'required|string',
            'message_content' => 'required|array',
            'message_type' => 'required|string',
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
            'message_content.array' => 'Message content must be an array',
            'message_type.required' => 'Message type cannot be empty',
            'message_type.string' => 'Message type must be a string',
        ];
    }
}
