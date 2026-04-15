<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Entity\ValueObject;

enum DesignGenerationStatus: string
{
    case PENDING = 'pending';
    case PROCESSING = 'processing';
    case COMPLETED = 'completed';
    case FAILED = 'failed';

    public function isFinal(): bool
    {
        return $this === self::COMPLETED || $this === self::FAILED;
    }
}
