<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ImageRemoveBackgroundTestResultDTO extends AbstractDTO
{
    protected bool $success = false;

    protected int $latencyMs = 0;

    protected string $message = '';

    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'latency_ms' => $this->latencyMs,
            'message' => $this->message,
        ];
    }
}
