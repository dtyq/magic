<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Get file tree request DTO.
 */
class GetFileTreeRequestDTO extends AbstractRequestDTO
{
    /**
     * Topic ID (priority parameter).
     */
    public string $topicId = '';

    /**
     * Sandbox ID (fallback parameter).
     */
    public string $sandboxId = '';

    /**
     * Directory tree depth (optional)
     * - null or -1: Return complete tree structure (default 10 levels)
     * - 1: Return only root node and its direct children
     * - 2: Return two levels
     * - n: Return n levels.
     */
    public ?int $depth = null;

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function getDepth(): ?int
    {
        return $this->depth;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'topic_id' => 'required_without:sandbox_id|string',
            'sandbox_id' => 'required_without:topic_id|string',
            'depth' => 'sometimes|nullable|integer|min:-1',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'topic_id.required_without' => 'Topic ID or Sandbox ID must be provided',
            'topic_id.string' => 'Topic ID must be a string',
            'sandbox_id.required_without' => 'Sandbox ID or Topic ID must be provided',
            'sandbox_id.string' => 'Sandbox ID must be a string',
            'depth.integer' => 'Depth must be an integer',
            'depth.min' => 'Depth must be -1 or greater',
        ];
    }
}
