<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

readonly class VideoMediaMetadata
{
    public function __construct(
        private float $durationSecondsFloat,
        private int $width,
        private int $height,
    ) {
    }

    public function getDurationSecondsFloat(): float
    {
        return $this->durationSecondsFloat;
    }

    public function getWidth(): int
    {
        return $this->width;
    }

    public function getHeight(): int
    {
        return $this->height;
    }
}
