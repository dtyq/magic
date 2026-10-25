<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Repository\Facade;

use App\Domain\Notification\Entity\NotificationEventEntity;

interface NotificationEventRepositoryInterface
{
    /** Return the existing event when event_id was already accepted. */
    public function createOrGet(NotificationEventEntity $entity): NotificationEventEntity;

    public function findByEventId(string $eventId): ?NotificationEventEntity;

    /** Record a dispatch failure without changing the pending event attempt count. */
    public function markDispatchFailed(
        string $eventId,
        string $errorCode,
        string $errorMessage,
        string $failedAt
    ): bool;

    public function claimPending(
        string $eventId,
        string $processingToken,
        string $lockedUntil,
        string $startedAt
    ): bool;

    public function recoverExpiredLease(
        string $eventId,
        string $processingToken,
        string $lockedUntil,
        string $startedAt
    ): bool;

    public function markSucceeded(
        string $eventId,
        string $processingToken,
        int $notificationCount,
        string $finishedAt
    ): bool;

    public function markFailed(
        string $eventId,
        string $processingToken,
        string $errorCode,
        string $errorMessage,
        bool $retryable,
        ?string $nextRetryAt,
        string $finishedAt
    ): bool;

    public function resetForManualRetry(
        string $eventId,
        string $operatorId,
        string $reason,
        string $retryAt,
        bool $force = false
    ): bool;

    /** @return list<NotificationEventEntity> */
    public function listRecoverable(string $now, int $limit): array;
}
