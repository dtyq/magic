<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\JsonRpc;

final readonly class RpcClientLastError
{
    public function __construct(
        public ?string $type,
        public string $message,
        public string $at,
    ) {
    }

    /**
     * @param null|array<string, mixed> $error
     */
    public static function fromNullableArray(?array $error): ?self
    {
        if ($error === null) {
            return null;
        }

        return new self(
            type: isset($error['type']) ? (string) $error['type'] : null,
            message: (string) ($error['message'] ?? ''),
            at: (string) ($error['at'] ?? ''),
        );
    }

    /**
     * @return array<string, null|string>
     */
    public function toArray(): array
    {
        return [
            'type' => $this->type,
            'message' => $this->message,
            'at' => $this->at,
        ];
    }
}
