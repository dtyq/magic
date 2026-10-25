<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity\ValueObject;

enum ProviderAssetStatus: string
{
    case UNVERIFIED = 'UNVERIFIED';
    case PROCESSING = 'PROCESSING';
    case PASS = 'PASS';
    case FAILED = 'FAILED';

    public static function fromValue(mixed $value): self
    {
        return self::from(strtoupper(trim((string) $value)));
    }

    public function isPassed(): bool
    {
        return $this === self::PASS;
    }

    public function isProcessing(): bool
    {
        return $this === self::UNVERIFIED || $this === self::PROCESSING;
    }
}
