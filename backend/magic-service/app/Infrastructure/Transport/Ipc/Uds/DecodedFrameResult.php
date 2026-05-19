<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Transport\Ipc\Uds;

readonly class DecodedFrameResult
{
    public function __construct(
        public string $payload,
        public int $rawJsonBytes,
        public int $frameBytes,
        public string $frameCodec,
    ) {
    }
}
