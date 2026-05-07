<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Workspace type enumeration.
 * Defines different types of workspaces for various business scenarios.
 */
enum WorkspaceType: string
{
    /**
     * Default workspace type for general purpose use.
     */
    case Default = 'default';

    /**
     * Finance workspace type for financial analysis and operations.
     */
    case Finance = 'finance';

    /**
     * Audio workspace type for audio recording and processing.
     */
    case Audio = 'audio';

    /**
     * Chat workspace type for conversation sessions.
     * Each user has at most one chat workspace per organization.
     * Managed programmatically; not user-selectable via API.
     */
    case Chat = 'chat';

    /**
     * Get all available workspace types (including internal types).
     *
     * @return array<string>
     */
    public static function getAllTypes(): array
    {
        return [
            self::Default->value,
            self::Finance->value,
            self::Audio->value,
            self::Chat->value,
        ];
    }

    /**
     * Get workspace types available for user-facing API operations.
     * Excludes internal types such as Chat.
     *
     * @return array<string>
     */
    public static function getPublicTypes(): array
    {
        return [
            self::Default->value,
            self::Finance->value,
            self::Audio->value,
        ];
    }

    /**
     * Check if a given value is a valid workspace type.
     */
    public static function isValid(string $value): bool
    {
        return in_array($value, self::getAllTypes(), true);
    }
}
