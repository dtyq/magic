<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Service;

use App\Domain\Notification\Constant\NotificationCategory;
use App\Domain\Notification\Constant\NotificationMessageStatus;
use App\Domain\Notification\Entity\NotificationEntity;
use App\Domain\Notification\Entity\ValueObject\NotificationDataIsolation;
use App\Domain\Notification\Repository\Facade\NotificationRepositoryInterface;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\NotificationErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Throwable;
use ValueError;

final readonly class NotificationAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private NotificationRepositoryInterface $notifications,
        private ?NotificationRealtimePushService $realtimePush = null,
        ?LoggerFactory $loggerFactory = null,
    ) {
        $this->logger = $loggerFactory?->get(self::class) ?? new NullLogger();
    }

    /** @return array{items:list<array<string,mixed>>, next_cursor:?string, has_more:bool} */
    public function list(
        NotificationDataIsolation $isolation,
        ?string $category,
        ?string $cursor,
        int $pageSize
    ): array {
        if ($pageSize < 1 || $pageSize > 100) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'page_size must be between 1 and 100');
        }
        $categoryEnum = null;
        if ($category !== null && $category !== '' && $category !== 'all') {
            try {
                $categoryEnum = NotificationCategory::from($category);
            } catch (ValueError) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'category is invalid');
            }
        }

        try {
            $page = $this->notifications->listByRecipient($isolation, $categoryEnum, $cursor, $pageSize);
        } catch (InvalidArgumentException $exception) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, $exception->getMessage());
        }
        return [
            'items' => array_map(fn (NotificationEntity $item): array => $this->toArray($item), $page['items']),
            'next_cursor' => $page['next_cursor'],
            'has_more' => $page['has_more'],
        ];
    }

    /** @return array{total:int,system_unread:int,authorization_pending:int} */
    public function counts(NotificationDataIsolation $isolation): array
    {
        $systemUnread = $this->notifications->countUnreadSystem($isolation);
        $authorizationPending = $this->notifications->countPendingAuthorization($isolation);
        return [
            'total' => $systemUnread + $authorizationPending,
            'system_unread' => $systemUnread,
            'authorization_pending' => $authorizationPending,
        ];
    }

    /** @return array{notification_id:string,read_status:string,read_at:?string} */
    public function markRead(NotificationDataIsolation $isolation, string $notificationId): array
    {
        $notification = $this->notifications->findById($isolation, $notificationId);
        $this->assertExistsAndActive($notification);
        if ($notification->getCategory() !== NotificationCategory::SYSTEM) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'Only system notifications can be marked as read');
        }
        if ($notification->getReadAt() === null) {
            $readAt = date('Y-m-d H:i:s');
            $this->notifications->markRead($isolation, $notificationId, $readAt);
            $notification->setReadAt($readAt);
            $this->pushRealtimeUpdate($isolation, 'read');
        }
        return [
            'notification_id' => $notification->getId(),
            'read_status' => 'read',
            'read_at' => $notification->getReadAt(),
        ];
    }

    private function pushRealtimeUpdate(NotificationDataIsolation $isolation, string $reason): void
    {
        try {
            if ($this->realtimePush !== null) {
                $this->realtimePush->pushForUser($isolation, $reason);
                return;
            }
            di(NotificationRealtimePushService::class)->pushForUser($isolation, $reason);
        } catch (Throwable $throwable) {
            // WebSocket delivery is best effort; the committed read state is authoritative.
            $this->logger->warning('Notification realtime push failed after read', [
                'organization_code' => $isolation->getCurrentOrganizationCode(),
                'user_id' => $isolation->getCurrentUserId(),
                'reason' => $reason,
                'error' => $throwable->getMessage(),
            ]);
        }
    }

    private function assertExistsAndActive(?NotificationEntity $notification): void
    {
        if ($notification === null) {
            ExceptionBuilder::throw(NotificationErrorCode::NOT_FOUND);
        }
        if ($notification->getMessageStatus() === NotificationMessageStatus::WITHDRAWN) {
            ExceptionBuilder::throw(NotificationErrorCode::WITHDRAWN);
        }
    }

    /** @return array<string,mixed> */
    private function toArray(NotificationEntity $entity): array
    {
        return [
            'notification_id' => $entity->getId(),
            'category' => $entity->getCategory()?->value,
            'type' => $entity->getType()?->value,
            'template_version' => $entity->getTemplateVersion(),
            'payload' => NotificationResourcePayload::forNotification($entity),
            'can_open_resource' => NotificationResourcePayload::canOpenResource($entity),
            'message_status' => $entity->getMessageStatus()->value,
            'read_status' => $entity->getReadAt() === null ? 'unread' : 'read',
            'read_at' => $entity->getReadAt(),
            'action_status' => $entity->getActionStatus()->value,
            'actioned_at' => $entity->getActionedAt(),
            'created_at' => $entity->getCreatedAt(),
        ];
    }
}
