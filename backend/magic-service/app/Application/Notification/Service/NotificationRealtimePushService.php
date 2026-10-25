<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Service;

use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\Notification\Entity\ValueObject\NotificationDataIsolation;
use App\Domain\Notification\Repository\Facade\NotificationRepositoryInterface;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Pushes the authoritative notification counters through the existing IM
 * Socket.IO room after the notification transaction has committed.
 *
 * WebSocket delivery is intentionally best-effort: the notification tables
 * remain the source of truth and the client reconciles through HTTP.
 */
final readonly class NotificationRealtimePushService
{
    private LoggerInterface $logger;

    public function __construct(
        private NotificationRepositoryInterface $notifications,
        private MagicUserRepositoryInterface $users,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * @param list<string> $userIds
     */
    public function pushForUsers(
        string $organizationCode,
        array $userIds,
        string $reason,
        ?string $eventId = null,
    ): void {
        $userIds = array_values(array_unique(array_filter(array_map(
            static fn (mixed $userId): string => trim((string) $userId),
            $userIds
        ))));
        if ($organizationCode === '' || $userIds === []) {
            return;
        }

        try {
            $userEntities = $this->users->getUserByIdsAndOrganizations($userIds, [$organizationCode], ['user_id', 'magic_id']);
        } catch (Throwable $throwable) {
            $this->logger->warning('Notification realtime push user lookup failed', [
                'organization_code' => $organizationCode,
                'user_ids' => $userIds,
                'error' => $throwable->getMessage(),
            ]);
            return;
        }
        $users = [];
        foreach ($userEntities as $user) {
            $users[$user->getUserId()] = $user;
        }

        try {
            $countsByUser = $this->notifications->countActiveByRecipientIds(
                NotificationDataIsolation::create($organizationCode),
                array_keys($users),
            );
        } catch (Throwable $throwable) {
            $this->logger->warning('Notification realtime push count lookup failed', [
                'organization_code' => $organizationCode,
                'user_ids' => array_keys($users),
                'reason' => $reason,
                'event_id' => $eventId,
                'error' => $throwable->getMessage(),
            ]);
            return;
        }

        foreach ($userIds as $userId) {
            $user = $users[$userId] ?? null;
            $magicId = trim((string) ($user?->getMagicId() ?? ''));
            if ($magicId === '') {
                $this->logger->warning('Notification realtime push skipped user without magic id', [
                    'organization_code' => $organizationCode,
                    'user_id' => $userId,
                ]);
                continue;
            }

            try {
                $counts = $countsByUser[$userId] ?? [
                    'system_unread' => 0,
                    'authorization_pending' => 0,
                ];
                SocketIOUtil::sendIntermediate(
                    SocketEventType::Intermediate,
                    $magicId,
                    [
                        'type' => 'notification_update',
                        'notification_update' => [
                            'organization_code' => $organizationCode,
                            'counts' => [
                                'total' => $counts['system_unread'] + $counts['authorization_pending'],
                                'system_unread' => $counts['system_unread'],
                                'authorization_pending' => $counts['authorization_pending'],
                            ],
                            'reason' => $reason,
                            'event_id' => $eventId,
                        ],
                    ]
                );
            } catch (Throwable $throwable) {
                // A disconnected browser must never roll back a committed
                // notification or turn a successful API action into a 500.
                $this->logger->warning('Notification realtime push failed', [
                    'organization_code' => $organizationCode,
                    'user_id' => $userId,
                    'magic_id' => $magicId,
                    'reason' => $reason,
                    'event_id' => $eventId,
                    'error' => $throwable->getMessage(),
                ]);
            }
        }
    }

    public function pushForUser(
        NotificationDataIsolation $isolation,
        string $reason,
        ?string $eventId = null,
    ): void {
        $userId = trim($isolation->getCurrentUserId());
        if ($userId === '') {
            return;
        }

        $this->pushForUsers(
            $isolation->getCurrentOrganizationCode(),
            [$userId],
            $reason,
            $eventId,
        );
    }
}
