<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Design\Contract;

interface VideoGatewayClientInterface
{
    /**
     * @param array<string, mixed> $payload
     * @param array<string, string> $businessParams
     * @return array<string, mixed>
     */
    public function submitVideo(array $payload, array $businessParams): array;

    /**
     * @param array<string, string> $businessParams
     * @return array<string, mixed>
     */
    public function queryVideo(string $operationId, array $businessParams): array;
}
