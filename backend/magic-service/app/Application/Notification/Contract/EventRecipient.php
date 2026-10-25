<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Contract;

final readonly class EventRecipient
{
    /** @param array<string, mixed> $payload */
    public function __construct(
        public string $userId,
        public string $sourceEventKey,
        public array $payload = [],
    ) {
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            (string) ($data['user_id'] ?? ''),
            (string) ($data['source_event_key'] ?? ''),
            (array) ($data['payload'] ?? []),
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        $data = [
            'user_id' => $this->userId,
            'source_event_key' => $this->sourceEventKey,
        ];
        if ($this->payload !== []) {
            $data['payload'] = $this->payload;
        }
        return $data;
    }
}
