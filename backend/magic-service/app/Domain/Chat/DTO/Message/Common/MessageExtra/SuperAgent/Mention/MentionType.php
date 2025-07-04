<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention;

use InvalidArgumentException;

/**
 * Mention type enum.
 */
enum MentionType: string
{
    case PROJECT_FILE = 'project_file';
    case AGENT = 'agent';

    /**
     * Base mention type constant.
     */
    public const BASE_TYPE = 'mention';

    /**
     * Get all supported types.
     */
    public static function getAllTypes(): array
    {
        return array_map(fn ($case) => $case->value, self::cases());
    }

    /**
     * Create enum from string.
     */
    public static function fromString(string $type): self
    {
        return match ($type) {
            self::PROJECT_FILE->value => self::PROJECT_FILE,
            self::AGENT->value => self::AGENT,
            default => throw new InvalidArgumentException("Unsupported mention type: {$type}")
        };
    }

    /**
     * Get the string value of the enum.
     */
    public function toString(): string
    {
        return $this->value;
    }
}
