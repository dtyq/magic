<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Update Audio Project Tags Request DTO.
 */
class UpdateAudioProjectTagsRequestDTO extends AbstractRequestDTO
{
    /**
     * Tags array.
     */
    public array $tags = [];

    public function getTags(): array
    {
        return $this->tags;
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'tags' => 'required|array',
            'tags.*' => 'string|max:50',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'tags.required' => 'Tags cannot be empty',
            'tags.array' => 'Tags must be an array',
            'tags.*.string' => 'Each tag must be a string',
            'tags.*.max' => 'Each tag cannot exceed 50 characters',
        ];
    }
}
