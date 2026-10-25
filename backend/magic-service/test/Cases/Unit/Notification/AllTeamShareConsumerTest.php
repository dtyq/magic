<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Notification;

use App\Application\Notification\Service\NotificationConsumerService;
use App\Application\Notification\Strategy\DefaultNotificationCatalogStrategy;
use App\Application\Notification\Validator\NotificationEventEnvelopeValidator;
use App\Domain\Notification\Entity\NotificationEventEntity;
use App\Domain\Notification\Repository\Facade\NotificationEventRepositoryInterface;
use App\Domain\Notification\Repository\Facade\NotificationRepositoryInterface;
use App\Domain\Notification\Repository\Facade\NotificationTemplateRepositoryInterface;
use App\Domain\Notification\Service\NotificationEventTypeRegistry;
use Hyperf\Config\Config;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/** @internal */
final class AllTeamShareConsumerTest extends TestCase
{
    #[DataProvider('broadcasts')]
    public function testQueuedBroadcastCompletesWithoutCreatingNotifications(string $kind, string $scope): void
    {
        $eventId = '785205968218931200';
        $event = NotificationEventEntity::fromArray([
            'event_id' => $eventId,
            'event_type' => 'share.' . $kind . '.recipients_added',
            'event_payload' => [
                'event_id' => $eventId,
                'event_type' => 'share.' . $kind . '.recipients_added',
                'occurred_at' => '2026-10-23 10:00:00',
                'producer' => 'super_magic.share',
                'organization_code' => 'MAGIC',
                'source' => ['domain' => 'share', 'type' => $kind, 'id' => '785205968218931201'],
                'recipients' => [[
                    'user_id' => '785205968218931202',
                    'source_event_key' => 'share:MAGIC:' . $kind . ':785205968218931201:785205968218931203:785205968218931202',
                ]],
                'payload' => ['share_scope' => $scope],
                'schema_version' => 1,
            ],
        ]);
        $events = $this->createMock(NotificationEventRepositoryInterface::class);
        $events->method('claimPending')->willReturn(true);
        $events->method('findByEventId')->willReturn($event);
        $events->expects(self::once())->method('markSucceeded')->with($eventId, self::isType('string'), 0, self::isType('string'))->willReturn(true);
        $events->expects(self::never())->method('markFailed');
        $notifications = $this->createMock(NotificationRepositoryInterface::class);
        $notifications->expects(self::never())->method('create');
        $templates = $this->createMock(NotificationTemplateRepositoryInterface::class);
        $templates->expects(self::never())->method('findLatestActive');
        $logger = $this->createMock(LoggerFactory::class);
        $logger->method('get')->willReturn(new NullLogger());
        $catalog = new DefaultNotificationCatalogStrategy();
        $consumer = new NotificationConsumerService(
            $events,
            $notifications,
            $templates,
            new NotificationEventEnvelopeValidator(new NotificationEventTypeRegistry($catalog)),
            $catalog,
            new Config([]),
            $logger,
        );

        $consumer->consume($eventId);
    }

    public static function broadcasts(): iterable
    {
        foreach (['project', 'file'] as $kind) {
            foreach (['全员', 'all'] as $scope) {
                yield $kind . '-' . $scope => [$kind, $scope];
            }
        }
    }
}
