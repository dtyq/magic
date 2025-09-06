<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Message queue status value object.
 */
enum MessageQueueStatus: int
{
    /**
     * Pending processing.
     */
    case PENDING = 0;

    /**
     * Completed.
     */
    case COMPLETED = 1;

    /**
     * Execution failed.
     */
    case FAILED = 2;

    /**
     * In progress.
     */
    case IN_PROGRESS = 3;

    /**
     * Get status description.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::PENDING => 'Pending',
            self::COMPLETED => 'Completed',
            self::FAILED => 'Failed',
            self::IN_PROGRESS => 'In Progress',
        };
    }

    /**
     * Get all status list.
     *
     * @return array<int, string> Status value and description mapping
     */
    public static function getList(): array
    {
        return [
            self::PENDING->value => self::PENDING->getDescription(),
            self::COMPLETED->value => self::COMPLETED->getDescription(),
            self::FAILED->value => self::FAILED->getDescription(),
            self::IN_PROGRESS->value => self::IN_PROGRESS->getDescription(),
        ];
    }

    /**
     * Check if status is final (cannot be changed).
     */
    public function isFinal(): bool
    {
        return in_array($this, [self::COMPLETED, self::FAILED], true);
    }

    /**
     * Check if status allows modification.
     */
    public function allowsModification(): bool
    {
        return $this === self::PENDING;
    }

    /**
     * Check if status can be consumed.
     */
    public function canBeConsumed(): bool
    {
        return $this === self::PENDING;
    }

    /**
     * Get next valid statuses.
     */
    public function getNextValidStatuses(): array
    {
        return match ($this) {
            self::PENDING => [self::IN_PROGRESS, self::FAILED, self::COMPLETED],
            self::IN_PROGRESS => [self::COMPLETED, self::FAILED],
            self::COMPLETED, self::FAILED => [],
        };
    }
}
