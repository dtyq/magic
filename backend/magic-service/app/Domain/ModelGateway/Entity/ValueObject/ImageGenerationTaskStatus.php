<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

enum ImageGenerationTaskStatus: string
{
    case RUNNING = 'running';
    case SUCCEEDED = 'succeeded';
    case FAILED = 'failed';

    public function isRunning(): bool
    {
        return $this === self::RUNNING;
    }

    public function isDone(): bool
    {
        return $this === self::SUCCEEDED || $this === self::FAILED;
    }
}
