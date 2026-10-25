<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Notification;

use App\Application\Notification\Contract\EventEnvelope;
use App\Application\Notification\Contract\NotificationEventPublisherInterface;
use App\Application\SuperMagic\Common\Share\Service\ShareNotificationAppService;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use PHPUnit\Framework\TestCase;

/** @internal */
final class ShareNotificationAppServiceTest extends TestCase
{
    public function testAllTeamSharesNeverEnumerateOrNotifyOrganizationMembers(): void
    {
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::never())->method('publish');
        $users = $this->createMock(MagicUserDomainService::class);
        $users->expects(self::never())->method('getActiveUserIdsByOrganization');
        $users->expects(self::never())->method('getActiveUsersByIds');
        $service = new ShareNotificationAppService($publisher, $users, new MagicDepartmentUserDomainService(
            $this->createMock(MagicDepartmentUserRepositoryInterface::class)
        ));

        foreach ([12, 13, 15] as $type) {
            $share = $this->share('resource-1', $type, 'Resource', 'all');
            $service->publishRecipientsAdded(null, $share);
            self::assertSame([], $share->getExtra()['notification_recipient_user_ids']);

            $before = $this->share('resource-1', $type, 'Resource', 'designated');
            $before->setExtra(['notification_recipient_user_ids' => ['user-a']]);
            $service->publishRecipientsAdded($before, $share);
            self::assertSame(['user-a'], $share->getExtra()['notification_recipient_user_ids']);
        }
    }

    public function testAllToDesignatedRechecksSelectedRecipientsAndWithdrawsOthers(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::exactly(2))->method('publish')->willReturnCallback(
            function (array|EventEnvelope $envelope) use (&$published): array {
                $published[] = $envelope;
                return ['event_id' => $envelope->eventId, 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            }
        );
        $users = $this->createMock(MagicUserDomainService::class);
        $users->expects(self::never())->method('getActiveUserIdsByOrganization');
        $users->method('getActiveUsersByIds')->willReturn(['user-a' => null]);
        $service = new ShareNotificationAppService($publisher, $users, new MagicDepartmentUserDomainService(
            $this->createMock(MagicDepartmentUserRepositoryInterface::class)
        ));
        $before = $this->share('project-1', 12, 'Project', 'all');
        $before->setExtra(['notification_recipient_user_ids' => ['user-a', 'user-b']]);
        $after = $this->share('project-1', 12, 'Project', 'designated');
        $service->publishRecipientsAdded($before, $after);

        self::assertSame('share.project.withdrawn', $published[0]->eventType);
        self::assertSame('user-b', $published[0]->recipients[0]->userId);
        self::assertSame('share.project.recipients_added', $published[1]->eventType);
        self::assertSame('user-a', $published[1]->recipients[0]->userId);
        self::assertSame(['user-a'], $after->getExtra()['notification_recipient_user_ids']);
    }

    public function testDesignatedSharePublishesOnlyFirstRecipientSet(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())
            ->method('publish')
            ->willReturnCallback(function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => $envelope->eventId, 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            });

        $users = $this->createMock(MagicUserDomainService::class);
        $users->expects(self::never())->method('getActiveUserIdsByOrganization');
        $users->method('getActiveUsersByIds')->willReturn(['user-a' => null, 'user-b' => null]);
        $departments = new MagicDepartmentUserDomainService(
            $this->createMock(MagicDepartmentUserRepositoryInterface::class)
        );
        $service = new ShareNotificationAppService($publisher, $users, $departments);

        $share = $this->share('project-1', 12, 'Project 1', 'designated');
        $share->setShareCode('project-share-code');
        $service->publishRecipientsAdded(null, $share);
        $service->publishRecipientsAdded($share, $share);

        self::assertCount(1, $published);
        self::assertSame('share.project.recipients_added', $published[0]->eventType);
        self::assertSame(['user-a', 'user-b'], array_map(
            static fn ($recipient): string => $recipient->userId,
            $published[0]->recipients
        ));
        self::assertSame(
            'share:ORG:project:project-1:12:user-a',
            $published[0]->recipients[0]->sourceEventKey
        );
        self::assertSame('project-share-code', $published[0]->payload['share_code']);
        self::assertSame(['user-a', 'user-b'], $share->getExtra()['notification_recipient_user_ids']);
    }

    public function testUpdateWithNoNewRecipientsDoesNotPublishEvent(): void
    {
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::never())->method('publish');
        $users = $this->createMock(MagicUserDomainService::class);
        $users->expects(self::never())->method('getActiveUserIdsByOrganization');
        $users->method('getActiveUsersByIds')->willReturn(['user-a' => null]);
        $service = new ShareNotificationAppService(
            $publisher,
            $users,
            new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class))
        );

        $before = $this->share('file-1', 15, 'File 1', 'designated');
        $before->setExtra(['notification_recipient_user_ids' => ['user-a']]);
        $after = $this->share('file-1', 15, 'File 1', 'designated');
        $after->setExtra(['notification_recipient_user_ids' => ['user-a']]);

        $service->publishRecipientsAdded($before, $after);
        self::assertSame(['user-a'], $after->getExtra()['notification_recipient_user_ids']);
    }

    public function testUpdateWithdrawsRemovedRecipientsAndKeepsOnlyCurrentSnapshot(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())
            ->method('publish')
            ->willReturnCallback(function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => $envelope->eventId, 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            });
        $users = $this->createMock(MagicUserDomainService::class);
        $users->expects(self::never())->method('getActiveUserIdsByOrganization');
        $users->method('getActiveUsersByIds')->willReturn(['user-a' => null]);
        $service = new ShareNotificationAppService(
            $publisher,
            $users,
            new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class))
        );

        $before = $this->share('project-1', 12, 'Project 1', 'designated');
        $before->setExtra(['notification_recipient_user_ids' => ['user-a', 'user-b']]);
        $after = $this->share('project-1', 12, 'Project 1', 'designated');

        $service->publishRecipientsAdded($before, $after);

        self::assertSame('share.project.withdrawn', $published[0]->eventType);
        self::assertSame(['user-b'], array_map(
            static fn ($recipient): string => $recipient->userId,
            $published[0]->recipients
        ));
        self::assertSame(['user-a'], $after->getExtra()['notification_recipient_user_ids']);
    }

    public function testCancellingSharePublishesRecipientsForRealtimeRefresh(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())
            ->method('publish')
            ->willReturnCallback(function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => $envelope->eventId, 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            });
        $service = new ShareNotificationAppService(
            $publisher,
            $this->createMock(MagicUserDomainService::class),
            new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class))
        );

        $share = $this->share('project-1', 12, 'Project 1', 'designated');
        $share->setExtra(['notification_recipient_user_ids' => ['user-a']]);
        $service->publishWithdrawn($share);

        self::assertSame('share.project.withdrawn', $published[0]->eventType);
        self::assertSame(['user-a'], array_map(
            static fn ($recipient): string => $recipient->userId,
            $published[0]->recipients
        ));
    }

    public function testCancellingLegacyShareStillPublishesGlobalWithdrawal(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())
            ->method('publish')
            ->willReturnCallback(function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => $envelope->eventId, 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            });
        $service = new ShareNotificationAppService(
            $publisher,
            $this->createMock(MagicUserDomainService::class),
            new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class))
        );

        $service->publishWithdrawn($this->share('project-1', 12, 'Project 1', 'designated'));

        self::assertSame('share.project.withdrawn', $published[0]->eventType);
        self::assertSame([], $published[0]->recipients);
    }

    public function testRestoredShareStartsANewRecipientNotificationCycle(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())
            ->method('publish')
            ->willReturnCallback(function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => $envelope->eventId, 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            });

        $users = $this->createMock(MagicUserDomainService::class);
        $users->expects(self::never())->method('getActiveUserIdsByOrganization');
        $users->method('getActiveUsersByIds')->willReturn(['user-a' => null]);
        $service = new ShareNotificationAppService(
            $publisher,
            $users,
            new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class))
        );

        $before = $this->share('project-1', 12, 'Project 1', 'designated');
        $before->setExtra(['notification_recipient_user_ids' => ['user-a']]);
        $before->setDeletedAt('2026-10-16 10:00:00');
        $after = $this->share('project-1', 12, 'Project 1', 'designated');

        $service->publishRecipientsAdded($before, $after);

        self::assertCount(1, $published);
        self::assertSame(['user-a'], array_map(
            static fn ($recipient): string => $recipient->userId,
            $published[0]->recipients
        ));
        self::assertSame(['user-a'], $after->getExtra()['notification_recipient_user_ids']);
    }

    public function testEmptyResourceNameFallsBackToResourceId(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())->method('publish')->willReturnCallback(
            function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => '1', 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            }
        );
        $users = $this->createMock(MagicUserDomainService::class);
        $users->expects(self::never())->method('getActiveUserIdsByOrganization');
        $users->method('getActiveUsersByIds')->willReturn(['user-a' => null]);
        $service = new ShareNotificationAppService(
            $publisher,
            $users,
            new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class))
        );

        $service->publishRecipientsAdded(null, $this->share('project-1', 12, '', 'designated'));

        self::assertSame('project-1', $published[0]->payload['resource_name']);
        self::assertNotSame('', $published[0]->payload['sharer_name']);
    }

    public function testFileSharePayloadUsesShareCodeRatherThanTheShareRowId(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())->method('publish')->willReturnCallback(
            function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => '1', 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            }
        );
        $users = $this->createMock(MagicUserDomainService::class);
        $users->expects(self::never())->method('getActiveUserIdsByOrganization');
        $users->method('getActiveUsersByIds')->willReturn(['user-a' => null]);
        $service = new ShareNotificationAppService(
            $publisher,
            $users,
            new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class))
        );

        $share = $this->share('file-resource-id', 15, 'File 1', 'designated');
        $share->setShareCode('file-share-code');
        $service->publishRecipientsAdded(null, $share);

        self::assertSame('share.file.recipients_added', $published[0]->eventType);
        self::assertSame('file-share-code', $published[0]->payload['share_code']);
        self::assertSame('15', $published[0]->payload['share_id']);
    }

    public function testShareWithoutPersistedCodeDoesNotFabricateShareRoute(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())->method('publish')->willReturnCallback(
            function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => '1', 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            }
        );
        $users = $this->createMock(MagicUserDomainService::class);
        $users->expects(self::never())->method('getActiveUserIdsByOrganization');
        $users->method('getActiveUsersByIds')->willReturn(['user-a' => null]);
        $service = new ShareNotificationAppService(
            $publisher,
            $users,
            new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class))
        );

        $share = $this->share('file-resource-id', 15, 'File 1', 'designated');
        $share->setShareCode('');
        $service->publishRecipientsAdded(null, $share);

        self::assertArrayNotHasKey('share_code', $published[0]->payload);
    }

    public function testDesignatedShareSplitsLargeRecipientSetsIntoBoundedEvents(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::exactly(2))
            ->method('publish')
            ->willReturnCallback(function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => $envelope->eventId, 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            });

        $firstBatch = array_map(static fn (int $id): string => 'user-' . $id, range(1, 500));
        $secondBatch = ['user-501'];
        $users = $this->createMock(MagicUserDomainService::class);
        $users->expects(self::never())->method('getActiveUserIdsByOrganization');
        $users->method('getActiveUsersByIds')->willReturn(array_fill_keys(array_merge($firstBatch, $secondBatch), null));
        $service = new ShareNotificationAppService(
            $publisher,
            $users,
            new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class))
        );

        $share = $this->share('project-1', 12, 'Project 1', 'designated');
        $share->setTargetIdsArray(array_map(static fn (string $id): array => ['target_type' => 'User', 'target_id' => $id], array_merge($firstBatch, $secondBatch)));
        $service->publishRecipientsAdded(null, $share);

        self::assertCount(2, $published);
        self::assertCount(500, $published[0]->recipients);
        self::assertCount(1, $published[1]->recipients);
    }

    private function share(string $resourceId, int $resourceType, string $name, string $range): ResourceShareEntity
    {
        return new ResourceShareEntity([
            'id' => $resourceType,
            'resource_id' => $resourceId,
            'resource_type' => $resourceType,
            'resource_name' => $name,
            'share_code' => $resourceId,
            'organization_code' => 'ORG',
            'created_uid' => 'owner',
            'share_type' => 2,
            'share_range' => $range,
            'target_ids' => json_encode([['target_type' => 'User', 'target_id' => 'user-a'], ['target_type' => 'User', 'target_id' => 'user-b']], JSON_THROW_ON_ERROR),
        ]);
    }
}
