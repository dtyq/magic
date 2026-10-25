<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Workspace\Entity\ValueObject;

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
     * Micro app workspace type for HTML micro app projects.
     * Each user has at most one micro app workspace per organization.
     * Managed programmatically; not user-selectable via API.
     */
    case MicroApp = 'micro-app';

    /**
     * UserSpecial workspace type for special projects.
     * Used by storeSpecial API to isolate special projects from default workspace.
     */
    case UserSpecial = 'user_special';

    /**
     * AI canvas workspace type for the dedicated AI canvas entry.
     * Each user has at most one AI canvas workspace per organization.
     * Managed programmatically via the app workspace endpoint; not user-selectable via API.
     */
    case AiCanvas = 'ai-canvas';

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
            self::MicroApp->value,
            self::Chat->value,
            self::MicroApp->value,
            self::UserSpecial->value,
            self::AiCanvas->value,
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
