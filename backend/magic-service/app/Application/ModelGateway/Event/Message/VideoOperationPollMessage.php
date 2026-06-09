<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event\Message;

final readonly class VideoOperationPollMessage
{
    public function __construct(
        public string $operationId,
        public array $businessParams = [],
        public int $attempt = 0,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'operation_id' => $this->operationId,
            'business_params' => $this->businessParams,
            'attempt' => $this->attempt,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        $businessParams = $data['business_params'] ?? [];

        return new self(
            (string) ($data['operation_id'] ?? ''),
            is_array($businessParams) ? $businessParams : [],
            max(0, (int) ($data['attempt'] ?? 0)),
        );
    }

    public function nextAttempt(): self
    {
        return new self($this->operationId, $this->businessParams, $this->attempt + 1);
    }
}
