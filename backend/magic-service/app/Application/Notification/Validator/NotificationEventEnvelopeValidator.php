<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Validator;

use App\Application\Notification\Contract\EventEnvelope;
use App\Application\Notification\Exception\NotificationEventValidationException;
use App\Domain\Notification\Service\NotificationEventTypeRegistry;
use App\ErrorCode\NotificationErrorCode;
use DateTimeImmutable;

final readonly class NotificationEventEnvelopeValidator
{
    public function __construct(private NotificationEventTypeRegistry $registry)
    {
    }

    /**
     * Validate the boundary contract before an event is persisted.
     *
     * @param array<string, mixed>|EventEnvelope $envelope
     * @return array<string, mixed>
     */
    public function validate(array|EventEnvelope $envelope): array
    {
        $data = $envelope instanceof EventEnvelope ? $envelope->toArray() : $envelope;
        foreach (['event_id', 'event_type', 'occurred_at', 'producer', 'organization_code', 'source', 'recipients', 'payload', 'schema_version'] as $field) {
            if (! array_key_exists($field, $data)) {
                $this->invalid("Missing event field: {$field}");
            }
        }

        $this->assertSnowflake('event_id', $data['event_id']);
        if ((int) $data['schema_version'] !== 1) {
            throw new NotificationEventValidationException(
                NotificationErrorCode::UNSUPPORTED_SCHEMA_VERSION,
                'Unsupported schema_version',
            );
        }
        $eventType = trim((string) $data['event_type']);
        if ($eventType === '' || ! $this->registry->exists($eventType)) {
            throw new NotificationEventValidationException(
                NotificationErrorCode::EVENT_TYPE_NOT_REGISTERED,
                "Unknown event_type: {$eventType}",
            );
        }
        foreach (['occurred_at', 'producer', 'organization_code'] as $field) {
            if (trim((string) $data[$field]) === '') {
                $this->invalid("{$field} cannot be empty");
            }
        }
        $occurredAt = (string) $data['occurred_at'];
        $occurredDate = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $occurredAt);
        if ($occurredDate === false || $occurredDate->format('Y-m-d H:i:s') !== $occurredAt) {
            $this->invalid('occurred_at must use YYYY-MM-dd HH:mm:ss');
        }

        $source = $data['source'];
        if (! is_array($source)) {
            $this->invalid('source must be an object');
        }
        foreach (['domain', 'type', 'id'] as $field) {
            if (! isset($source[$field]) || trim((string) $source[$field]) === '') {
                $this->invalid("source.{$field} is required");
            }
        }
        $this->assertSnowflake('source.id', $source['id']);
        if (array_key_exists('version', $source) && $source['version'] !== null && trim((string) $source['version']) === '') {
            $this->invalid('source.version cannot be empty');
        }
        $this->assertSourceDomain($eventType, (string) $source['domain']);

        if (! is_array($data['recipients'])) {
            $this->invalid('recipients must be an array');
        }
        $seen = [];
        foreach ($data['recipients'] as $recipient) {
            if (! is_array($recipient)) {
                $this->invalid('recipient must be an object');
            }
            if (! isset($recipient['user_id']) || trim((string) $recipient['user_id']) === '') {
                $this->invalid('recipient.user_id is required');
            }
            $userId = (string) $recipient['user_id'];
            if (isset($seen[$userId])) {
                $this->invalid('Duplicate recipient user_id');
            }
            $seen[$userId] = true;
            $sourceEventKey = (string) ($recipient['source_event_key'] ?? '');
            if ($sourceEventKey === '' || strlen($sourceEventKey) > 255 || preg_match('/[\x00-\x1F\x7F]/', $sourceEventKey)) {
                $this->invalid('recipient.source_event_key is invalid');
            }
            $this->assertSourceEventKey($eventType, $sourceEventKey, $userId);
            if (isset($recipient['payload']) && ! is_array($recipient['payload'])) {
                $this->invalid('recipient.payload must be an object');
            }
        }

        $isWithdrawal = str_ends_with($eventType, '.withdrawn');
        if ($data['recipients'] === [] && ! $isWithdrawal) {
            $this->invalid('At least one recipient is required');
        }
        if (! is_array($data['payload'])) {
            $this->invalid('payload must be an object');
        }

        return $data;
    }

    private function assertSnowflake(string $field, mixed $value): void
    {
        if (! is_string($value) && ! is_int($value)) {
            $this->invalid("{$field} must be a decimal snowflake string");
        }
        if (! preg_match('/^[0-9]+$/', (string) $value)) {
            $this->invalid("{$field} must be a decimal snowflake string");
        }
    }

    private function assertSourceDomain(string $eventType, string $domain): void
    {
        $expected = explode('.', $eventType, 2)[0];
        if ($expected !== $domain) {
            $this->invalid("source.domain does not match event_type: {$eventType}");
        }
    }

    private function assertSourceEventKey(string $eventType, string $sourceEventKey, string $recipientUserId): void
    {
        $rule = match (true) {
            // recipient_user_id is the string user_id from magic_contact_users.
            // It is not required to be a numeric snowflake (the current system
            // uses values such as usi_dg_dashboard_admin), but it must remain a
            // single key segment so the source-event-key grammar is unambiguous.
            $eventType === 'task.finished' => ['/^task:[^:]+:[0-9]+:([^:]+):finished$/', 1],
            $eventType === 'task.error' => ['/^task:[^:]+:[0-9]+:([^:]+):error$/', 1],
            $eventType === 'share.project.recipients_added' => ['/^share:[^:]+:project:[0-9]+:[^:]+:([^:]+)$/', 1],
            $eventType === 'share.file.recipients_added' => ['/^share:[^:]+:file:[0-9]+:[^:]+:([^:]+)$/', 1],
            $eventType === 'review.skill.version_approved' => ['/^review:[^:]+:skill:[0-9]+:[0-9]+:([^:]+):approved$/', 1],
            $eventType === 'review.agent.version_approved' => ['/^review:[^:]+:agent:[0-9]+:[0-9]+:([^:]+):approved$/', 1],
            default => null,
        };
        if ($rule === null) {
            return;
        }
        [$pattern, $userGroup] = $rule;
        $matches = [];
        if (preg_match($pattern, $sourceEventKey, $matches) !== 1) {
            $this->invalid("source_event_key does not match event_type: {$eventType}");
        }
        if (($matches[$userGroup] ?? null) !== $recipientUserId) {
            $this->invalid('source_event_key user_id does not match recipient.user_id');
        }
    }

    private function invalid(string $message): never
    {
        throw new NotificationEventValidationException(NotificationErrorCode::EVENT_PAYLOAD_INVALID, $message);
    }
}
