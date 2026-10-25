<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Entity\ValueObject;

/**
 * Transfer type enumeration.
 *
 * Defines the types of resources that can be transferred.
 */
enum TransferType: int
{
    case WORKSPACE = 1;
    case PROJECT = 2;
    case AGENT = 3;
    case SKILL = 4;

    /**
     * Get the human-readable label.
     */
    public function label(): string
    {
        return match ($this) {
            self::WORKSPACE => 'workspace',
            self::PROJECT => 'project',
            self::AGENT => 'agent',
            self::SKILL => 'skill',
        };
    }

    /**
     * Check if this is a workspace transfer.
     */
    public function isWorkspace(): bool
    {
        return $this === self::WORKSPACE;
    }

    /**
     * Check if this is a project transfer.
     */
    public function isProject(): bool
    {
        return $this === self::PROJECT;
    }
}
