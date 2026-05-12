<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\DTO;

use RuntimeException;

readonly class RpcHttpPassthroughResult
{
    public function __construct(
        public int $statusCode,
        public string $contentType,
        public string $contentEncoding,
        public string $vary,
        public string $bodyBase64,
        public int $bodyBytes,
    ) {
    }

    /**
     * @param array<string, mixed> $payload
     */
    public static function fromArray(array $payload): self
    {
        return new self(
            statusCode: (int) ($payload['status_code'] ?? 200),
            contentType: (string) ($payload['content_type'] ?? 'application/json; charset=utf-8'),
            contentEncoding: (string) ($payload['content_encoding'] ?? ''),
            vary: (string) ($payload['vary'] ?? ''),
            bodyBase64: (string) ($payload['body_base64'] ?? ''),
            bodyBytes: (int) ($payload['body_bytes'] ?? 0),
        );
    }

    public function decodedBody(): string
    {
        $decoded = base64_decode($this->bodyBase64, true);
        if (! is_string($decoded)) {
            throw new RuntimeException('Invalid passthrough body_base64');
        }

        return $decoded;
    }
}
