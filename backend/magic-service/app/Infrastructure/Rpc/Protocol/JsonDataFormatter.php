<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Protocol;

use App\Infrastructure\Rpc\Protocol\Contract\DataFormatterInterface;

class JsonDataFormatter implements DataFormatterInterface
{
    public function formatRequest(Request $request): array
    {
        $payload = [
            'jsonrpc' => '2.0',
            'method' => $request->getMethod(),
            'params' => $request->getParams(),
            'id' => $request->getId(),
        ];

        $context = $request->getContext();
        if ($context !== []) {
            $payload['context'] = $context;
        }

        return $payload;
    }

    public function formatResponse(mixed $data, mixed $id = null): array
    {
        return [
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => $data,
        ];
    }

    public function formatErrorResponse(mixed $id, int $code, string $message, mixed $data = null): array
    {
        $error = [
            'code' => $code,
            'message' => $message,
        ];
        if ($data !== null) {
            $error['data'] = $data;
        }

        return [
            'jsonrpc' => '2.0',
            'id' => $id,
            'error' => $error,
        ];
    }
}
