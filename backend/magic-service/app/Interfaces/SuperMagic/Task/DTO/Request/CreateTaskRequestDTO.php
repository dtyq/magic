<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Task\DTO\Request;

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

    /**
     * Interrupt the current task instead of queuing this message.
     */
    public bool $forceInterrupt = false;

    public static function fromValidatedArray(array $data): self
    {
        self::checkParams($data);
        return new self($data);
    }

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

    public function isForceInterrupt(): bool
    {
        return $this->forceInterrupt;
    }

    public function setForceInterrupt(null|bool|int|string $forceInterrupt): void
    {
        $this->forceInterrupt = in_array($forceInterrupt, [true, 1, '1'], true);
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'required|string',
            'topic_id' => 'required|string',
            'message_type' => 'required|string|in:text,rich_text',
            'message_content' => 'required|array',
            'message_content.content' => 'required|string|max:65000',
            'force_interrupt' => 'nullable|boolean',
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
            'force_interrupt.boolean' => 'Force interrupt must be a boolean value',
        ];
    }
}
