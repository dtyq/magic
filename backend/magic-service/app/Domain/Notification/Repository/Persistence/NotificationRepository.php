<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Repository\Persistence;

use App\Domain\Notification\Constant\NotificationCategory;
use App\Domain\Notification\Constant\NotificationMessageStatus;
use App\Domain\Notification\Entity\NotificationEntity;
use App\Domain\Notification\Entity\ValueObject\NotificationDataIsolation;
use App\Domain\Notification\Repository\Facade\NotificationRepositoryInterface;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use InvalidArgumentException;
use Throwable;

final class NotificationRepository implements NotificationRepositoryInterface
{
    public function create(NotificationDataIsolation $dataIsolation, NotificationEntity $entity): NotificationEntity
    {
        $now = $this->now();
        $entity->setId($entity->getId() !== '' ? $entity->getId() : IdGenerator::getSnowId());
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $entity->setCreatedAt($entity->getCreatedAt() ?? $now);
        $entity->setUpdatedAt($entity->getUpdatedAt() ?? $now);

        try {
            Db::table('magic_notifications')->insert($this->attributes($entity));
            return $entity;
        } catch (Throwable $throwable) {
            if (! $this->isDuplicateKey($throwable)) {
                throw $throwable;
            }

            $existing = $this->findBySourceEventKey(
                $dataIsolation,
                $entity->getSourceEventKey(),
                $entity->getRecipientUserId()
            );
            if ($existing !== null) {
                if (
                    $entity->getSourceDomain() === 'share'
                    && $existing->getMessageStatus() === NotificationMessageStatus::WITHDRAWN
                ) {
                    // A share can be cancelled and later restored while
                    // retaining its business share ID. Start a fresh visible
                    // notification cycle without changing the idempotency key.
                    $this->restoreWithdrawn($dataIsolation, $entity);
                    $entity->setId($existing->getId());
                    return $entity;
                }
                return $existing;
            }
            throw $throwable;
        }
    }

    public function findById(
        NotificationDataIsolation $dataIsolation,
        string $id,
        bool $forUpdate = false
    ): ?NotificationEntity {
        $query = $this->scopedQuery($dataIsolation)->where('id', $id);
        if ($forUpdate) {
            $query->lockForUpdate();
        }
        $row = $query->first();
        return $row === null ? null : NotificationEntity::fromArray((array) $row);
    }

    public function findBySourceEventKey(
        NotificationDataIsolation $dataIsolation,
        string $sourceEventKey,
        string $recipientUserId
    ): ?NotificationEntity {
        $row = $this->organizationQuery($dataIsolation)
            ->where('source_event_key', $sourceEventKey)
            ->where('recipient_user_id', $recipientUserId)
            ->first();
        return $row === null ? null : NotificationEntity::fromArray((array) $row);
    }

    public function listByRecipient(
        NotificationDataIsolation $dataIsolation,
        ?NotificationCategory $category,
        ?string $cursor,
        int $pageSize
    ): array {
        $query = $this->scopedQuery($dataIsolation)
            ->where('message_status', 'active')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($category !== null) {
            $query->where('category', $category->value);
        }

        $decodedCursor = $this->decodeCursor($cursor);
        if ($decodedCursor !== null) {
            $query->where(function (Builder $cursorQuery) use ($decodedCursor): void {
                $cursorQuery
                    ->where('created_at', '<', $decodedCursor['created_at'])
                    ->orWhere(function (Builder $sameTimeQuery) use ($decodedCursor): void {
                        $sameTimeQuery
                            ->where('created_at', $decodedCursor['created_at'])
                            ->where('id', '<', $decodedCursor['id']);
                    });
            });
        }

        $rows = $query->limit($pageSize + 1)->get();
        $hasMore = $rows->count() > $pageSize;
        if ($hasMore) {
            $rows = $rows->slice(0, $pageSize);
        }

        $items = [];
        foreach ($rows as $row) {
            $items[] = NotificationEntity::fromArray((array) $row);
        }

        $last = $items === [] ? null : $items[array_key_last($items)];
        return [
            'items' => $items,
            'next_cursor' => $hasMore && $last !== null ? $this->encodeCursor($last) : null,
            'has_more' => $hasMore,
        ];
    }

    public function countUnreadSystem(NotificationDataIsolation $dataIsolation): int
    {
        return (int) $this->scopedQuery($dataIsolation)
            ->where('category', NotificationCategory::SYSTEM->value)
            ->where('message_status', 'active')
            ->whereNull('read_at')
            ->count();
    }

    public function countPendingAuthorization(NotificationDataIsolation $dataIsolation): int
    {
        return (int) $this->scopedQuery($dataIsolation)
            ->where('category', NotificationCategory::AUTHORIZATION->value)
            ->where('message_status', 'active')
            ->where('action_status', 'pending')
            ->count();
    }

    public function countActiveByRecipientIds(NotificationDataIsolation $dataIsolation, array $recipientUserIds): array
    {
        $recipientUserIds = array_values(array_unique(array_filter(array_map(
            static fn (mixed $userId): string => trim((string) $userId),
            $recipientUserIds
        ))));
        if ($recipientUserIds === []) {
            return [];
        }

        $rows = $this->organizationQuery($dataIsolation)
            ->selectRaw(
                'recipient_user_id,
                SUM(CASE WHEN category = ? AND read_at IS NULL THEN 1 ELSE 0 END) AS system_unread,
                SUM(CASE WHEN category = ? AND action_status = ? THEN 1 ELSE 0 END) AS authorization_pending',
                [
                    NotificationCategory::SYSTEM->value,
                    NotificationCategory::AUTHORIZATION->value,
                    'pending',
                ]
            )
            ->whereIn('recipient_user_id', $recipientUserIds)
            ->where('message_status', NotificationMessageStatus::ACTIVE->value)
            ->whereIn('category', [NotificationCategory::SYSTEM->value, NotificationCategory::AUTHORIZATION->value])
            ->groupBy('recipient_user_id')
            ->get();

        $counts = [];
        foreach ($rows as $row) {
            $row = (array) $row;
            $counts[(string) $row['recipient_user_id']] = [
                'system_unread' => (int) $row['system_unread'],
                'authorization_pending' => (int) $row['authorization_pending'],
            ];
        }
        return $counts;
    }

    public function markRead(NotificationDataIsolation $dataIsolation, string $id, string $readAt): bool
    {
        return $this->scopedQuery($dataIsolation)
            ->where('id', $id)
            ->where('category', NotificationCategory::SYSTEM->value)
            ->where('message_status', 'active')
            ->whereNull('read_at')
            ->update(['read_at' => $readAt, 'updated_at' => $readAt]) > 0;
    }

    public function updateActionIfPending(
        NotificationDataIsolation $dataIsolation,
        string $id,
        string $actionStatus,
        string $actionedAt,
        string $actionedBy
    ): bool {
        return $this->scopedQuery($dataIsolation)
            ->where('id', $id)
            ->where('category', NotificationCategory::AUTHORIZATION->value)
            ->where('message_status', 'active')
            ->where('action_status', 'pending')
            ->update([
                'action_status' => $actionStatus,
                'actioned_at' => $actionedAt,
                'actioned_by' => $actionedBy,
                'updated_at' => $actionedAt,
            ]) > 0;
    }

    public function withdrawBySourceIdentity(
        NotificationDataIsolation $dataIsolation,
        string $sourceDomain,
        string $sourceType,
        string $sourceId,
        ?string $sourceVersion,
        string $updatedAt
    ): int {
        $query = $this->organizationQuery($dataIsolation)
            ->where('source_domain', $sourceDomain)
            ->where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->where('message_status', 'active');

        if ($sourceVersion === null) {
            $query->whereNull('source_version');
        } else {
            $query->where('source_version', $sourceVersion);
        }

        return $query->update([
            'message_status' => 'withdrawn',
            'updated_at' => $updatedAt,
        ]);
    }

    public function withdrawBySourceIdentityAndRecipient(
        NotificationDataIsolation $dataIsolation,
        string $sourceDomain,
        string $sourceType,
        string $sourceId,
        ?string $sourceVersion,
        string $recipientUserId,
        string $updatedAt
    ): int {
        $query = $this->organizationQuery($dataIsolation)
            ->where('recipient_user_id', $recipientUserId)
            ->where('source_domain', $sourceDomain)
            ->where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->where('message_status', NotificationMessageStatus::ACTIVE->value);

        if ($sourceVersion === null) {
            $query->whereNull('source_version');
        } else {
            $query->where('source_version', $sourceVersion);
        }

        return $query->update([
            'message_status' => NotificationMessageStatus::WITHDRAWN->value,
            'updated_at' => $updatedAt,
        ]);
    }

    public function withdrawAllBySourceIdentity(
        NotificationDataIsolation $dataIsolation,
        string $sourceDomain,
        string $sourceType,
        string $sourceId,
        string $updatedAt
    ): int {
        return $this->organizationQuery($dataIsolation)
            ->where('source_domain', $sourceDomain)
            ->where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->where('message_status', NotificationMessageStatus::ACTIVE->value)
            ->update([
                'message_status' => NotificationMessageStatus::WITHDRAWN->value,
                'updated_at' => $updatedAt,
            ]);
    }

    public function withdrawAllBySourceIdentityAndRecipient(
        NotificationDataIsolation $dataIsolation,
        string $sourceDomain,
        string $sourceType,
        string $sourceId,
        string $recipientUserId,
        string $updatedAt
    ): int {
        return $this->organizationQuery($dataIsolation)
            ->where('recipient_user_id', $recipientUserId)
            ->where('source_domain', $sourceDomain)
            ->where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->where('message_status', NotificationMessageStatus::ACTIVE->value)
            ->update([
                'message_status' => NotificationMessageStatus::WITHDRAWN->value,
                'updated_at' => $updatedAt,
            ]);
    }

    private function restoreWithdrawn(
        NotificationDataIsolation $dataIsolation,
        NotificationEntity $entity
    ): void {
        $this->organizationQuery($dataIsolation)
            ->where('source_event_key', $entity->getSourceEventKey())
            ->where('recipient_user_id', $entity->getRecipientUserId())
            ->where('message_status', NotificationMessageStatus::WITHDRAWN->value)
            ->update([
                'category' => $entity->getCategory()?->value,
                'type' => $entity->getType()?->value,
                'template_version' => $entity->getTemplateVersion(),
                'payload' => json_encode($entity->getPayload(), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'source_domain' => $entity->getSourceDomain(),
                'source_type' => $entity->getSourceType(),
                'source_id' => $entity->getSourceId(),
                'source_version' => $entity->getSourceVersion(),
                'message_status' => NotificationMessageStatus::ACTIVE->value,
                'read_at' => null,
                'action_status' => $entity->getActionStatus()->value,
                'actioned_at' => null,
                'actioned_by' => null,
                'created_at' => $this->now(),
                'updated_at' => $this->now(),
            ]);
    }

    private function scopedQuery(NotificationDataIsolation $dataIsolation): Builder
    {
        return $this->organizationQuery($dataIsolation)
            ->where('recipient_user_id', $dataIsolation->getCurrentUserId());
    }

    private function organizationQuery(NotificationDataIsolation $dataIsolation): Builder
    {
        return Db::table('magic_notifications')
            ->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
    }

    /** @return array<string, mixed> */
    private function attributes(NotificationEntity $entity): array
    {
        return [
            'id' => $entity->getId(),
            'organization_code' => $entity->getOrganizationCode(),
            'recipient_user_id' => $entity->getRecipientUserId(),
            'category' => $entity->getCategory()?->value,
            'type' => $entity->getType()?->value,
            'template_version' => $entity->getTemplateVersion(),
            'payload' => json_encode($entity->getPayload(), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'source_event_key' => $entity->getSourceEventKey(),
            'source_domain' => $entity->getSourceDomain(),
            'source_type' => $entity->getSourceType(),
            'source_id' => $entity->getSourceId(),
            'source_version' => $entity->getSourceVersion(),
            'message_status' => $entity->getMessageStatus()->value,
            'read_at' => $entity->getReadAt(),
            'action_status' => $entity->getActionStatus()->value,
            'actioned_at' => $entity->getActionedAt(),
            'actioned_by' => $entity->getActionedBy(),
            'created_at' => $entity->getCreatedAt(),
            'updated_at' => $entity->getUpdatedAt(),
        ];
    }

    private function now(): string
    {
        return date('Y-m-d H:i:s');
    }

    /** @return null|array{created_at:string,id:string} */
    private function decodeCursor(?string $cursor): ?array
    {
        if ($cursor === null || $cursor === '') {
            return null;
        }

        $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
        $data = $decoded === false ? json_decode($cursor, true) : json_decode($decoded, true);
        if (! is_array($data) || ! isset($data['created_at'], $data['id'])) {
            throw new InvalidArgumentException('cursor is invalid');
        }

        $createdAt = (string) $data['created_at'];
        $id = (string) $data['id'];
        if ($createdAt === '' || $id === '' || ! preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $createdAt)) {
            throw new InvalidArgumentException('cursor is invalid');
        }

        return ['created_at' => $createdAt, 'id' => $id];
    }

    private function encodeCursor(NotificationEntity $entity): string
    {
        $json = json_encode([
            'created_at' => $entity->getCreatedAt(),
            'id' => $entity->getId(),
        ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        return rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
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
