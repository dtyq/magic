<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Create audio marker request DTO.
 */
class CreateAudioMarkerRequestDTO extends AbstractRequestDTO
{
    /**
     * Project ID (from route parameter).
     */
    public string $projectId = '';

    /**
     * Audio playback position in seconds.
     */
    public int $positionSeconds = 0;

    /**
     * Marker content.
     */
    public string $content = '';

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getPositionSeconds(): int
    {
        return $this->positionSeconds;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'position_seconds' => 'required|integer|min:0',
            'content' => 'required|string|max:1000',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'position_seconds.required' => 'Position cannot be empty',
            'position_seconds.integer' => 'Position must be an integer',
            'position_seconds.min' => 'Position must be greater than or equal to 0',
            'content.required' => 'Content cannot be empty',
            'content.string' => 'Content must be a string',
            'content.max' => 'Content cannot exceed 1000 characters',
        ];
    }
}
