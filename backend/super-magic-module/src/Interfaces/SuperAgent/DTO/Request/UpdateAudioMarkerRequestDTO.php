<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * Update audio marker request DTO.
 */
class UpdateAudioMarkerRequestDTO extends AbstractRequestDTO
{
    /**
     * Marker ID (from route parameter).
     */
    public string $markerId = '';

    /**
     * Audio playback position in seconds.
     */
    public ?int $positionSeconds = null;

    /**
     * Marker content.
     */
    public ?string $content = null;

    public function getMarkerId(): string
    {
        return $this->markerId;
    }

    public function getPositionSeconds(): ?int
    {
        return $this->positionSeconds;
    }

    public function getContent(): ?string
    {
        return $this->content;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            // marker_id is from route parameter, not validated here
            'position_seconds' => 'nullable|integer|min:0',
            'content' => 'nullable|string|max:1000',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'position_seconds.integer' => 'Position must be an integer',
            'position_seconds.min' => 'Position must be greater than or equal to 0',
            'content.string' => 'Content must be a string',
            'content.max' => 'Content cannot exceed 1000 characters',
        ];
    }
}
