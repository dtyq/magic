<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Contract;

final readonly class EventSource
{
    public function __construct(
        public string $domain,
        public string $type,
        public string $id,
        public ?string $version = null,
    ) {
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            (string) ($data['domain'] ?? ''),
            (string) ($data['type'] ?? ''),
            (string) ($data['id'] ?? ''),
            isset($data['version']) ? (string) $data['version'] : null,
        );
    }

    /** @return array<string, string> */
    public function toArray(): array
    {
        $data = [
            'domain' => $this->domain,
            'type' => $this->type,
            'id' => $this->id,
        ];
        if ($this->version !== null) {
            $data['version'] = $this->version;
        }
        return $data;
    }
}
