<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention;

use InvalidArgumentException;

/**
 * Mention data factory.
 */
class MentionDataFactory
{
    /**
     * Create a corresponding data object based on the type.
     */
    public static function create(string $type, ?array $data = null): MentionData
    {
        return match ($type) {
            MentionType::PROJECT_FILE->value => new ProjectFileData($data),
            MentionType::AGENT->value => new AgentData($data),
            default => throw new InvalidArgumentException("Unsupported mention data type: {$type}")
        };
    }

    /**
     * Create a corresponding data object based on the enum type.
     */
    public static function createFromEnum(MentionType $type, ?array $data = null): MentionData
    {
        return match ($type) {
            MentionType::PROJECT_FILE => new ProjectFileData($data),
            MentionType::AGENT => new AgentData($data),
        };
    }

    /**
     * Get the list of supported data types.
     */
    public static function getSupportedTypes(): array
    {
        return MentionType::getAllTypes();
    }
}
