<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Repository\Facade;

use App\Domain\Notification\Constant\NotificationCategory;
use App\Domain\Notification\Entity\NotificationEntity;
use App\Domain\Notification\Entity\ValueObject\NotificationDataIsolation;

interface NotificationRepositoryInterface
{
    public function create(NotificationDataIsolation $dataIsolation, NotificationEntity $entity): NotificationEntity;

    public function findById(
        NotificationDataIsolation $dataIsolation,
        string $id,
        bool $forUpdate = false
    ): ?NotificationEntity;

    public function findBySourceEventKey(
        NotificationDataIsolation $dataIsolation,
        string $sourceEventKey,
        string $recipientUserId
    ): ?NotificationEntity;

    /** @return array{items: list<NotificationEntity>, next_cursor: ?string, has_more: bool} */
    public function listByRecipient(
        NotificationDataIsolation $dataIsolation,
        ?NotificationCategory $category,
        ?string $cursor,
        int $pageSize
    ): array;

    public function countUnreadSystem(NotificationDataIsolation $dataIsolation): int;

    public function countPendingAuthorization(NotificationDataIsolation $dataIsolation): int;

    /**
     * @param list<string> $recipientUserIds
     * @return array<string, array{system_unread:int, authorization_pending:int}>
     */
    public function countActiveByRecipientIds(NotificationDataIsolation $dataIsolation, array $recipientUserIds): array;

    public function markRead(NotificationDataIsolation $dataIsolation, string $id, string $readAt): bool;

    public function updateActionIfPending(
        NotificationDataIsolation $dataIsolation,
        string $id,
        string $actionStatus,
        string $actionedAt,
        string $actionedBy
    ): bool;

    /**
     * Withdraw by business identity. The isolation object may have no user ID
     * because a producer retracts all recipients for the organization.
     */
    public function withdrawBySourceIdentity(
        NotificationDataIsolation $dataIsolation,
        string $sourceDomain,
        string $sourceType,
        string $sourceId,
        ?string $sourceVersion,
        string $updatedAt
    ): int;

    /** Withdraw one version of a business identity for one recipient. */
    public function withdrawBySourceIdentityAndRecipient(
        NotificationDataIsolation $dataIsolation,
        string $sourceDomain,
        string $sourceType,
        string $sourceId,
        ?string $sourceVersion,
        string $recipientUserId,
        string $updatedAt
    ): int;

    /** Withdraw every active version of one business identity. */
    public function withdrawAllBySourceIdentity(
        NotificationDataIsolation $dataIsolation,
        string $sourceDomain,
        string $sourceType,
        string $sourceId,
        string $updatedAt
    ): int;

    /** Withdraw every active version of one business identity for one recipient. */
    public function withdrawAllBySourceIdentityAndRecipient(
        NotificationDataIsolation $dataIsolation,
        string $sourceDomain,
        string $sourceType,
        string $sourceId,
        string $recipientUserId,
        string $updatedAt
    ): int;
}
