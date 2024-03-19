<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Transfer status enumeration.
 *
 * Defines the status of a transfer operation.
 */
enum TransferStatus: int
{
    case PENDING = 0;
    case SUCCESS = 1;
    case FAILED = 2;

    /**
     * Get the human-readable label.
     */
    public function label(): string
    {
        return match ($this) {
            self::PENDING => 'pending',
            self::SUCCESS => 'success',
            self::FAILED => 'failed',
        };
    }

    /**
     * Check if the transfer was successful.
     */
    public function isSuccess(): bool
    {
        return $this === self::SUCCESS;
    }

    /**
     * Check if the transfer failed.
     */
    public function isFailed(): bool
    {
        return $this === self::FAILED;
    }

    /**
     * Check if the transfer is pending.
     */
    public function isPending(): bool
    {
        return $this === self::PENDING;
    }
}
