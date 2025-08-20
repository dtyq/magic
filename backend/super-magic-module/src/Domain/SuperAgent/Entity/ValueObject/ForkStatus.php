<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Fork status enumeration.
 */
enum ForkStatus: string
{
    case RUNNING = 'running';
    case FINISHED = 'finished';
    case FAILED = 'failed';

    /**
     * Check if the fork is running.
     */
    public function isRunning(): bool
    {
        return $this === self::RUNNING;
    }

    /**
     * Check if the fork is finished.
     */
    public function isFinished(): bool
    {
        return $this === self::FINISHED;
    }

    /**
     * Check if the fork has failed.
     */
    public function isFailed(): bool
    {
        return $this === self::FAILED;
    }

    /**
     * Check if the fork is completed (either finished or failed).
     */
    public function isCompleted(): bool
    {
        return $this->isFinished() || $this->isFailed();
    }

    /**
     * Get all possible status values.
     */
    public static function getAllValues(): array
    {
        return [
            self::RUNNING->value,
            self::FINISHED->value,
            self::FAILED->value,
        ];
    }

    /**
     * Get status description.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::RUNNING => 'Fork is in progress',
            self::FINISHED => 'Fork completed successfully',
            self::FAILED => 'Fork failed with errors',
        };
    }
}
