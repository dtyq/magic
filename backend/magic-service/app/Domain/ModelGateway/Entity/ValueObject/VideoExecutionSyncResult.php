<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

readonly class VideoExecutionSyncResult
{
    public function __construct(
        private bool $statusChanged,
        private bool $firstSucceeded,
        private VideoOperationStatus $status,
    ) {
    }

    public function isStatusChanged(): bool
    {
        return $this->statusChanged;
    }

    public function isFirstSucceeded(): bool
    {
        return $this->firstSucceeded;
    }

    public function getStatus(): VideoOperationStatus
    {
        return $this->status;
    }
}
