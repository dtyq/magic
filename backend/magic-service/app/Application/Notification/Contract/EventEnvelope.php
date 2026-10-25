<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Contract;

final readonly class EventEnvelope
{
    /**
     * @param list<EventRecipient> $recipients
     * @param array<string, mixed> $payload
     */
    public function __construct(
        public string $eventId,
        public string $eventType,
        public string $occurredAt,
        public string $producer,
        public string $organizationCode,
        public EventSource $source,
        public array $recipients,
        public array $payload,
        public int $schemaVersion = 1,
    ) {
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $recipients = [];
        foreach ((array) ($data['recipients'] ?? []) as $recipient) {
            $recipients[] = EventRecipient::fromArray((array) $recipient);
        }

        return new self(
            (string) ($data['event_id'] ?? ''),
            (string) ($data['event_type'] ?? ''),
            (string) ($data['occurred_at'] ?? ''),
            (string) ($data['producer'] ?? ''),
            (string) ($data['organization_code'] ?? ''),
            EventSource::fromArray((array) ($data['source'] ?? [])),
            $recipients,
            (array) ($data['payload'] ?? []),
            (int) ($data['schema_version'] ?? 1),
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'event_id' => $this->eventId,
            'event_type' => $this->eventType,
            'occurred_at' => $this->occurredAt,
            'producer' => $this->producer,
            'organization_code' => $this->organizationCode,
            'source' => $this->source->toArray(),
            'recipients' => array_map(
                static fn (EventRecipient $recipient): array => $recipient->toArray(),
                $this->recipients
            ),
            'payload' => $this->payload,
            'schema_version' => $this->schemaVersion,
        ];
    }
}
