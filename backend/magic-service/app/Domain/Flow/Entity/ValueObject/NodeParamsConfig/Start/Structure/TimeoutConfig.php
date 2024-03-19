<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure;

readonly class TimeoutConfig
{
    public function __construct(
        private bool $enabled = false,
        private int $interval = 10,
        private string $unit = 'minutes'
    ) {
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function getInterval(): int
    {
        return $this->interval;
    }

    public function getUnit(): string
    {
        return $this->unit;
    }

    public function toArray(): array
    {
        return [
            'enabled' => $this->enabled,
            'interval' => $this->interval,
            'unit' => $this->unit,
        ];
    }
}
