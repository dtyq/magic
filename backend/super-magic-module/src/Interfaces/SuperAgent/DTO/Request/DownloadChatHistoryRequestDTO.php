<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Download chat history request DTO
 * Used to receive request parameters for downloading topic chat history.
 */
class DownloadChatHistoryRequestDTO extends AbstractRequestDTO
{
    /**
     * Topic ID.
     */
    public string $topicId = '';

    /**
     * Get topic ID.
     */
    public function getTopicId(): int
    {
        return (int) $this->topicId;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'topic_id' => 'required|string',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'topic_id.required' => 'Topic ID cannot be empty',
            'topic_id.string' => 'Topic ID must be a string',
        ];
    }
}
