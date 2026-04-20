<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Protocol\Contract;

use App\Infrastructure\Rpc\Protocol\Request;

interface DataFormatterInterface
{
    public function formatRequest(Request $request): array;

    public function formatResponse(mixed $data, mixed $id = null): array;

    public function formatErrorResponse(mixed $id, int $code, string $message, mixed $data = null): array;
}
