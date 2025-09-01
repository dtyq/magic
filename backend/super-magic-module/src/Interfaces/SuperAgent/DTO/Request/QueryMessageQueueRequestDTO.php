<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Query message queue request DTO.
 * Used to receive request parameters for querying message queue.
 */
class QueryMessageQueueRequestDTO extends AbstractRequestDTO
{
    /**
     * Project ID (optional filter).
     */
    public string $projectId = '';

    /**
     * Topic ID (optional filter).
     */
    public string $topicId = '';

    /**
     * Page number for pagination.
     */
    public int $page = 1;

    /**
     * Page size for pagination.
     */
    public int $pageSize = 10;

    /**
     * Message type (optional filter).
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
     * Get page number.
     */
    public function getPage(): int
    {
        return $this->page;
    }

    /**
     * Get page size.
     */
    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    /**
     * Get message type.
     */
    public function getMessageType(): string
    {
        return $this->messageType;
    }

    /**
     * Check if project ID filter is applied.
     */
    public function hasProjectFilter(): bool
    {
        return ! empty($this->projectId);
    }

    /**
     * Check if topic ID filter is applied.
     */
    public function hasTopicFilter(): bool
    {
        return ! empty($this->topicId);
    }

    /**
     * Check if message type filter is applied.
     */
    public function hasMessageTypeFilter(): bool
    {
        return ! empty($this->messageType);
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'project_id' => 'nullable|string',
            'topic_id' => 'nullable|string',
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'message_type' => 'nullable|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'project_id.string' => 'Project ID must be a string',
            'topic_id.string' => 'Topic ID must be a string',
            'page.integer' => 'Page must be an integer',
            'page.min' => 'Page must be greater than 0',
            'page_size.integer' => 'Page size must be an integer',
            'page_size.min' => 'Page size must be greater than 0',
            'page_size.max' => 'Page size cannot exceed 100',
            'message_type.string' => 'Message type must be a string',
        ];
    }
}
