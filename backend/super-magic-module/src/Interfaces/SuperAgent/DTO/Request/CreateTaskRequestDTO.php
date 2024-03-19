<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Create task request DTO.
 */
class CreateTaskRequestDTO extends AbstractRequestDTO
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
     * Message type (e.g., rich_text, text).
     */
    public string $messageType = '';

    /**
     * Message content.
     */
    public array $messageContent = [];

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function getMessageType(): string
    {
        return $this->messageType;
    }

    public function getMessageContent(): array
    {
        return $this->messageContent;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string',
            'topic_id' => 'required|string',
            'message_type' => 'required|string|in:text,rich_text',
            'message_content' => 'required|array',
            'message_content.content' => 'required|string|max:65000',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_id.required' => 'Project ID is required',
            'topic_id.required' => 'Topic ID is required',
            'message_type.required' => 'Message type is required',
            'message_type.in' => 'Message type must be text or rich_text',
            'message_content.required' => 'Message content is required',
            'message_content.content.required' => 'Message content cannot be empty',
            'message_content.content.max' => 'Message content cannot exceed 65000 characters',
        ];
    }
}
