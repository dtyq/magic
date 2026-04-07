<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

enum VideoOperationStatus: string
{
    case QUEUED = 'QUEUED';
    case RUNNING = 'RUNNING';
    case PROVIDER_RUNNING = 'PROVIDER_RUNNING';
    case SUCCEEDED = 'SUCCEEDED';
    case FAILED = 'FAILED';
    case CANCELED = 'CANCELED';

    public static function fromStorage(string $value): self
    {
        return match ($value) {
            'UPSTREAM_RUNNING' => self::PROVIDER_RUNNING,
            default => self::from($value),
        };
    }

    public function isDone(): bool
    {
        return in_array($this, [self::SUCCEEDED, self::FAILED, self::CANCELED], true);
    }

    public function isQueued(): bool
    {
        return $this === self::QUEUED;
    }
}
