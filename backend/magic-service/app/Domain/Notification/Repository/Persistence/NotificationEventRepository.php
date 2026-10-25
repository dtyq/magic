<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Repository\Persistence;

use App\Domain\Notification\Constant\NotificationEventStatus;
use App\Domain\Notification\Entity\NotificationEventEntity;
use App\Domain\Notification\Repository\Facade\NotificationEventRepositoryInterface;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Throwable;

final class NotificationEventRepository implements NotificationEventRepositoryInterface
{
    public function createOrGet(NotificationEventEntity $entity): NotificationEventEntity
    {
        $now = $this->now();
        if ($entity->getId() === '') {
            $entity->setId(IdGenerator::getSnowId());
        }
        $entity->setCreatedAt($entity->getCreatedAt() ?? $now);
        $entity->setUpdatedAt($entity->getUpdatedAt() ?? $now);

        try {
            Db::table('magic_notification_events')->insert($this->attributes($entity));
            return $entity;
        } catch (Throwable $throwable) {
            if (! $this->isDuplicateKey($throwable)) {
                throw $throwable;
            }

            $existing = $this->findByEventId($entity->getEventId());
            if ($existing !== null) {
                return $existing;
            }
            throw $throwable;
        }
    }

    public function findByEventId(string $eventId): ?NotificationEventEntity
    {
        $row = Db::table('magic_notification_events')->where('event_id', $eventId)->first();
        return $row === null ? null : NotificationEventEntity::fromArray((array) $row);
    }

    public function markDispatchFailed(
        string $eventId,
        string $errorCode,
        string $errorMessage,
        string $failedAt
    ): bool {
        return Db::table('magic_notification_events')
            ->where('event_id', $eventId)
            ->where('status', NotificationEventStatus::PENDING->value)
            ->update([
                // The event was accepted, but no Consumer lease was acquired.
                // Keep attempts untouched and let recovery dispatch the same event again.
                'status' => NotificationEventStatus::PENDING->value,
                'next_retry_at' => null,
                'last_error_code' => $this->normalizeErrorCode($errorCode),
                'last_error_message' => $this->truncateErrorMessage($errorMessage),
                'updated_at' => $failedAt,
            ]) > 0;
    }

    public function claimPending(
        string $eventId,
        string $processingToken,
        string $lockedUntil,
        string $startedAt
    ): bool {
        return Db::table('magic_notification_events')
            ->where('event_id', $eventId)
            ->where('status', NotificationEventStatus::PENDING->value)
            ->where(function (Builder $query) use ($startedAt): void {
                $query->whereNull('next_retry_at')->orWhere('next_retry_at', '<=', $startedAt);
            })
            ->update([
                'status' => NotificationEventStatus::PROCESSING->value,
                'processing_token' => $processingToken,
                'locked_until' => $lockedUntil,
                'last_started_at' => $startedAt,
                'updated_at' => $startedAt,
                'attempts' => Db::raw('attempts + 1'),
            ]) > 0;
    }

    public function recoverExpiredLease(
        string $eventId,
        string $processingToken,
        string $lockedUntil,
        string $startedAt
    ): bool {
        return Db::table('magic_notification_events')
            ->where('event_id', $eventId)
            ->where('status', NotificationEventStatus::PROCESSING->value)
            ->whereNotNull('locked_until')
            ->where('locked_until', '<=', $startedAt)
            ->update([
                'processing_token' => $processingToken,
                'locked_until' => $lockedUntil,
                'last_started_at' => $startedAt,
                'updated_at' => $startedAt,
                'attempts' => Db::raw('attempts + 1'),
            ]) > 0;
    }

    public function markSucceeded(
        string $eventId,
        string $processingToken,
        int $notificationCount,
        string $finishedAt
    ): bool {
        return Db::table('magic_notification_events')
            ->where('event_id', $eventId)
            ->where('status', NotificationEventStatus::PROCESSING->value)
            ->where('processing_token', $processingToken)
            ->update([
                'status' => NotificationEventStatus::SUCCEEDED->value,
                // A replay can legitimately create zero new rows because the
                // notification source key is already present. Keep the event
                // statistic stable instead of replacing the original count.
                'notification_count' => Db::raw("GREATEST(notification_count, {$notificationCount})"),
                'processing_token' => null,
                'locked_until' => null,
                'last_finished_at' => $finishedAt,
                'updated_at' => $finishedAt,
            ]) > 0;
    }

    public function markFailed(
        string $eventId,
        string $processingToken,
        string $errorCode,
        string $errorMessage,
        bool $retryable,
        ?string $nextRetryAt,
        string $finishedAt
    ): bool {
        return Db::table('magic_notification_events')
            ->where('event_id', $eventId)
            ->where('status', NotificationEventStatus::PROCESSING->value)
            ->where('processing_token', $processingToken)
            ->update([
                'status' => $retryable ? NotificationEventStatus::PENDING->value : NotificationEventStatus::FAILED->value,
                'next_retry_at' => $retryable ? $nextRetryAt : null,
                'last_error_code' => $this->normalizeErrorCode($errorCode),
                'last_error_message' => $this->truncateErrorMessage($errorMessage),
                'processing_token' => null,
                'locked_until' => null,
                'last_finished_at' => $finishedAt,
                'updated_at' => $finishedAt,
            ]) > 0;
    }

    public function resetForManualRetry(
        string $eventId,
        string $operatorId,
        string $reason,
        string $retryAt,
        bool $force = false
    ): bool {
        $query = Db::table('magic_notification_events')
            ->where('event_id', $eventId)
            ->where('status', '<>', NotificationEventStatus::PROCESSING->value);

        if (! $force) {
            $query->whereIn('status', [
                NotificationEventStatus::PENDING->value,
                NotificationEventStatus::FAILED->value,
            ]);
        }

        return $query->update([
            'status' => NotificationEventStatus::PENDING->value,
            'next_retry_at' => $retryAt,
            'processing_token' => null,
            'locked_until' => null,
            'last_retry_operator_id' => $operatorId,
            'last_retry_reason' => $reason,
            'last_retry_at' => $retryAt,
            'manual_retry_count' => Db::raw('manual_retry_count + 1'),
            'updated_at' => $retryAt,
        ]) > 0;
    }

    public function listRecoverable(string $now, int $limit): array
    {
        $rows = Db::table('magic_notification_events')
            ->where(function (Builder $query) use ($now): void {
                $query
                    ->where(function (Builder $pending) use ($now): void {
                        $pending
                            ->where('status', NotificationEventStatus::PENDING->value)
                            ->where(function (Builder $retry) use ($now): void {
                                $retry->whereNull('next_retry_at')->orWhere('next_retry_at', '<=', $now);
                            });
                    })
                    ->orWhere(function (Builder $processing) use ($now): void {
                        $processing
                            ->where('status', NotificationEventStatus::PROCESSING->value)
                            ->whereNotNull('locked_until')
                            ->where('locked_until', '<=', $now);
                    });
            })
            ->orderBy('id')
            ->limit($limit)
            ->get();

        $events = [];
        foreach ($rows as $row) {
            $events[] = NotificationEventEntity::fromArray((array) $row);
        }
        return $events;
    }

    /** @return array<string, mixed> */
    private function attributes(NotificationEventEntity $entity): array
    {
        return [
            'id' => $entity->getId(),
            'event_id' => $entity->getEventId(),
            'event_type' => $entity->getEventType(),
            'organization_code' => $entity->getOrganizationCode(),
            'source_domain' => $entity->getSourceDomain(),
            'source_type' => $entity->getSourceType(),
            'source_id' => $entity->getSourceId(),
            'source_version' => $entity->getSourceVersion(),
            'event_payload' => json_encode($entity->getEventPayload(), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'status' => $entity->getStatus()->value,
            'attempts' => $entity->getAttempts(),
            'manual_retry_count' => $entity->getManualRetryCount(),
            'recipient_count' => $entity->getRecipientCount(),
            'notification_count' => $entity->getNotificationCount(),
            'next_retry_at' => $entity->getNextRetryAt(),
            'last_error_code' => $entity->getLastErrorCode(),
            'last_error_message' => $entity->getLastErrorMessage(),
            'processing_token' => $entity->getProcessingToken(),
            'locked_until' => $entity->getLockedUntil(),
            'last_started_at' => $entity->getLastStartedAt(),
            'last_finished_at' => $entity->getLastFinishedAt(),
            'last_retry_operator_id' => $entity->getLastRetryOperatorId(),
            'last_retry_reason' => $entity->getLastRetryReason(),
            'last_retry_at' => $entity->getLastRetryAt(),
            'created_at' => $entity->getCreatedAt(),
            'updated_at' => $entity->getUpdatedAt(),
        ];
    }

    private function now(): string
    {
        return date('Y-m-d H:i:s');
    }

    private function truncateErrorMessage(string $message): string
    {
        $message = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $message) ?? '';
        $message = preg_replace('/\s+/u', ' ', trim($message)) ?? '';
        return mb_substr($message, 0, 500);
    }

    private function normalizeErrorCode(string $errorCode): string
    {
        return preg_match('/^\d+$/', $errorCode) === 1 ? $errorCode : '0';
    }

    private function isDuplicateKey(Throwable $throwable): bool
    {
        if ((string) $throwable->getCode() === '23000') {
            return true;
        }
        $errorInfo = property_exists($throwable, 'errorInfo') ? $throwable->errorInfo : null;
        return is_array($errorInfo) && (($errorInfo[1] ?? null) === 1062);
    }
}
