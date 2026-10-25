<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Common\Share\Service;

use App\Application\Notification\Contract\EventEnvelope;
use App\Application\Notification\Contract\EventRecipient;
use App\Application\Notification\Contract\EventSource;
use App\Application\Notification\Contract\NotificationEventPublisherInterface;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\SuperMagic\Agent\Service\MagicClawDomainService;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Throwable;

/** 将项目、文件团队分享转换为统一站内信事件。 */
final readonly class ShareNotificationAppService
{
    private const RECIPIENT_SNAPSHOT = 'notification_recipient_user_ids';

    private const RECIPIENT_BATCH_SIZE = 500;

    public function __construct(
        private NotificationEventPublisherInterface $publisher,
        private MagicUserDomainService $users,
        private MagicDepartmentUserDomainService $departmentUsers,
        private ?ProjectDomainService $projectDomainService = null,
        private ?MagicClawDomainService $magicClawDomainService = null,
    ) {
    }

    /** 在分享保存成功后同步收件人通知：新增对象收到消息，移除对象的旧消息撤回。 */
    public function publishRecipientsAdded(
        ?ResourceShareEntity $before,
        ResourceShareEntity $after,
        string $sharerName = ''
    ): void {
        $eventType = $this->addedEventType($after);
        if ($eventType === null) {
            return;
        }

        // A soft-deleted share starts a new notification cycle when it is
        // restored. Do not carry the previous cycle's recipient snapshot into
        // the new share, otherwise re-sharing to the same user is treated as
        // an already-notified recipient and no event is published.
        $previous = $before !== null
            && $before->getDeletedAt() === null
            && $before->getShareType() === ShareAccessType::TeamShare->value
            ? $this->snapshot($before)
            : [];
        // Access scope is not a mailing list. Keep only the existing notification
        // snapshot so cancellation can still withdraw previously delivered messages.
        if ($after->getShareType() === ShareAccessType::TeamShare->value && $after->getShareRange() === 'all') {
            $extra = $after->getExtra() ?? [];
            $extra[self::RECIPIENT_SNAPSHOT] = $previous;
            $after->setExtra($extra);
            return;
        }

        $currentRecipients = $after->getShareType() === ShareAccessType::TeamShare->value
            ? $this->resolveRecipients($after)
            : [];
        // Legacy all-team snapshots may include queued events that were skipped.
        // Re-enqueue selected recipients; notification source keys remain idempotent.
        $newRecipients = $before?->getShareRange() === 'all'
            ? $currentRecipients
            : array_values(array_diff($currentRecipients, $previous));
        $removedRecipients = array_values(array_diff($previous, $currentRecipients));

        // 快照仅表示当前仍持有分享消息的对象。不能累积历史收件人，
        // 否则移除后再添加时既不会重发消息，也无法撤回旧消息。
        if ($after->getExtra() === null || $currentRecipients !== $previous) {
            $extra = $after->getExtra() ?? [];
            $extra[self::RECIPIENT_SNAPSHOT] = $currentRecipients;
            $after->setExtra($extra);
        }

        $this->publishRecipientWithdrawals($after, $removedRecipients);

        if ($newRecipients === []) {
            return;
        }

        $kind = $this->resourceKind($after);
        $payload = [
            'share_id' => (string) $after->getId(),
            'resource_name' => $after->getResourceName() !== '' ? $after->getResourceName() : $after->getResourceId(),
            'share_scope' => $after->getShareRange() === 'all' ? '全员' : '指定成员/部门',
            'sharer_name' => $sharerName !== '' ? $sharerName : $this->resolveSharerName($after),
            'resource_id' => $after->getResourceId(),
            'resource_type' => $kind,
        ];
        // Share routes accept only the persisted share code. A resource ID is
        // not a valid substitute for historical records that lack one.
        $shareCode = trim($after->getShareCode());
        if ($shareCode !== '') {
            $payload['share_code'] = $shareCode;
        }
        [$projectMode, $resourceCode] = $this->resolveProjectNotificationContext($after->getProjectId());
        $payload['project_mode'] = $projectMode;
        $payload['resource_code'] = $resourceCode;

        foreach (array_chunk($newRecipients, self::RECIPIENT_BATCH_SIZE) as $recipientBatch) {
            $recipients = [];
            foreach ($recipientBatch as $userId) {
                $recipients[] = new EventRecipient(
                    $userId,
                    sprintf('share:%s:%s:%s:%s:%s', $after->getOrganizationCode(), $kind, $after->getResourceId(), (string) $after->getId(), $userId),
                );
            }

            $this->publisher->publish(new EventEnvelope(
                eventId: (string) IdGenerator::getSnowId(),
                eventType: $eventType,
                occurredAt: date('Y-m-d H:i:s'),
                producer: 'super_magic.share',
                organizationCode: $after->getOrganizationCode(),
                source: new EventSource('share', $kind, $after->getResourceId()),
                recipients: $recipients,
                payload: $payload,
            ));
        }
    }

    /** 在分享撤回成功后发布撤回事件。 */
    public function publishWithdrawn(ResourceShareEntity $share): void
    {
        $eventType = $this->withdrawnEventType($share);
        if ($eventType === null || $share->getShareType() !== ShareAccessType::TeamShare->value) {
            return;
        }

        // Carry the original recipients so the consumer can refresh their
        // inbox counters and lists in real time after the messages withdraw.
        // Older shares may not have a snapshot; their empty-recipient event
        // deliberately retains the consumer's global-withdrawal fallback.
        $recipients = $this->snapshot($share);
        if ($recipients !== []) {
            $this->publishRecipientWithdrawals($share, $recipients);
            return;
        }

        $kind = $this->resourceKind($share);
        $this->publisher->publish(new EventEnvelope(
            eventId: (string) IdGenerator::getSnowId(),
            eventType: $eventType,
            occurredAt: date('Y-m-d H:i:s'),
            producer: 'super_magic.share',
            organizationCode: $share->getOrganizationCode(),
            source: new EventSource('share', $kind, $share->getResourceId()),
            recipients: [],
            payload: ['resource_id' => $share->getResourceId(), 'resource_type' => $kind],
        ));
    }

    /** @param list<string> $recipientUserIds */
    private function publishRecipientWithdrawals(ResourceShareEntity $share, array $recipientUserIds): void
    {
        if ($recipientUserIds === []) {
            return;
        }

        $eventType = $this->withdrawnEventType($share);
        if ($eventType === null) {
            return;
        }

        $kind = $this->resourceKind($share);
        foreach (array_chunk($recipientUserIds, self::RECIPIENT_BATCH_SIZE) as $recipientBatch) {
            $recipients = [];
            foreach ($recipientBatch as $userId) {
                $recipients[] = new EventRecipient(
                    $userId,
                    sprintf('share:%s:%s:%s:%s:%s', $share->getOrganizationCode(), $kind, $share->getResourceId(), (string) $share->getId(), $userId),
                );
            }

            $this->publisher->publish(new EventEnvelope(
                eventId: (string) IdGenerator::getSnowId(),
                eventType: $eventType,
                occurredAt: date('Y-m-d H:i:s'),
                producer: 'super_magic.share',
                organizationCode: $share->getOrganizationCode(),
                source: new EventSource('share', $kind, $share->getResourceId()),
                recipients: $recipients,
                payload: ['resource_id' => $share->getResourceId(), 'resource_type' => $kind],
            ));
        }
    }

    /** @return list<string> */
    private function resolveRecipients(ResourceShareEntity $share): array
    {
        $organizationCode = $share->getOrganizationCode();
        $userIds = [];
        if ($share->getShareRange() === 'designated') {
            $userTargetIds = [];
            $departmentIds = [];
            foreach ($share->getTargetIdsArray() as $target) {
                $type = strtolower((string) ($target['target_type'] ?? ''));
                $id = trim((string) ($target['target_id'] ?? ''));
                if ($id === '') {
                    continue;
                }
                if ($type === 'user') {
                    $userTargetIds[] = $id;
                } elseif ($type === 'department') {
                    $departmentIds[] = $id;
                }
            }
            $userIds = $userTargetIds;
            if ($departmentIds !== []) {
                foreach ($this->departmentUsers->getDepartmentUsersByDepartmentIds(
                    array_values(array_unique($departmentIds)),
                    DataIsolation::create($organizationCode),
                    100000,
                    ['user_id', 'organization_code', 'deleted_at']
                ) as $departmentUser) {
                    if ($departmentUser->getOrganizationCode() === $organizationCode) {
                        $userIds[] = $departmentUser->getUserId();
                    }
                }
            }
            $activeUsers = $this->users->getActiveUsersByIds($organizationCode, array_unique($userIds));
            $userIds = array_values(array_intersect(array_unique($userIds), array_keys($activeUsers)));
        }
        return array_values(array_unique(array_filter(array_map('strval', $userIds))));
    }

    /** @return list<string> */
    private function snapshot(ResourceShareEntity $share): array
    {
        $extra = $share->getExtra() ?? [];
        return array_values(array_unique(array_map('strval', (array) ($extra[self::RECIPIENT_SNAPSHOT] ?? []))));
    }

    private function resourceKind(ResourceShareEntity $share): ?string
    {
        return match ($share->getResourceTypeEnum()) {
            ResourceType::Project => 'project',
            ResourceType::File, ResourceType::FileCollection => 'file',
            default => null,
        };
    }

    private function addedEventType(ResourceShareEntity $share): ?string
    {
        return match ($this->resourceKind($share)) {
            'project' => 'share.project.recipients_added',
            'file' => 'share.file.recipients_added',
            default => null,
        };
    }

    private function withdrawnEventType(ResourceShareEntity $share): ?string
    {
        return match ($this->resourceKind($share)) {
            'project' => 'share.project.withdrawn',
            'file' => 'share.file.withdrawn',
            default => null,
        };
    }

    private function resolveSharerName(ResourceShareEntity $share): string
    {
        $users = $this->users->getActiveUsersByIds($share->getOrganizationCode(), [$share->getCreatedUid()]);
        return ($users[$share->getCreatedUid()] ?? null)?->getNickname() ?? $share->getCreatedUid();
    }

    /** @return array{string, string} [project_mode, resource_code] */
    private function resolveProjectNotificationContext(?string $projectId): array
    {
        $projectId = (int) $projectId;
        if ($projectId <= 0 || $this->projectDomainService === null) {
            return ['', ''];
        }

        try {
            $project = $this->projectDomainService->getProjectNotUserId($projectId);
            $projectMode = trim((string) ($project?->getProjectMode() ?? ''));
            if ($projectMode !== ProjectMode::MAGICLAW->value || $this->magicClawDomainService === null) {
                return [$projectMode, ''];
            }

            return [
                $projectMode,
                trim($this->magicClawDomainService->getByProjectId($projectId)?->getCode() ?? ''),
            ];
        } catch (Throwable) {
            return ['', ''];
        }
    }
}
