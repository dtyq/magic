<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Notification;

use App\Application\Notification\Crontab\NotificationEventRecoveryCrontab;
use App\Application\Notification\Event\NotificationEventConsumeRequested;
use App\Domain\Notification\Entity\NotificationEventEntity;
use App\Domain\Notification\Repository\Facade\NotificationEventRepositoryInterface;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Crontab\Annotation\Crontab;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use ReflectionClass;

/** @internal */
final class NotificationEventRecoveryCrontabTest extends TestCase
{
    public function testRecoveryUsesConfiguredBatchSizeAndOriginalEventIds(): void
    {
        $eventIds = ['785205968218931300', '785205968218931301'];
        $events = $this->createMock(NotificationEventRepositoryInterface::class);
        $events->expects(self::once())
            ->method('listRecoverable')
            ->with(self::isType('string'), 50)
            ->willReturn(array_map(static function (string $eventId): NotificationEventEntity {
                $event = new NotificationEventEntity();
                $event->setEventId($eventId);
                return $event;
            }, $eventIds));

        $dispatchedIds = [];
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects(self::exactly(2))
            ->method('dispatch')
            ->willReturnCallback(function (object $event) use (&$dispatchedIds): object {
                self::assertInstanceOf(NotificationEventConsumeRequested::class, $event);
                $dispatchedIds[] = $event->eventId;
                return $event;
            });

        $config = $this->createMock(ConfigInterface::class);
        $config->expects(self::once())
            ->method('get')
            ->with('notification.recovery_batch_size', 100)
            ->willReturn(50);

        $this->crontab($events, $dispatcher, $config)->execute();

        self::assertSame($eventIds, $dispatchedIds);
    }

    public function testNonPositiveBatchSizeIsClampedToOne(): void
    {
        $events = $this->createMock(NotificationEventRepositoryInterface::class);
        $events->expects(self::once())
            ->method('listRecoverable')
            ->with(self::isType('string'), 1)
            ->willReturn([]);

        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects(self::never())->method('dispatch');
        $config = $this->createMock(ConfigInterface::class);
        $config->expects(self::once())
            ->method('get')
            ->with('notification.recovery_batch_size', 100)
            ->willReturn(0);

        $this->crontab($events, $dispatcher, $config)->execute();
    }

    public function testCrontabKeepsFixedRecoveryScheduleAndDistributedLockOptions(): void
    {
        $attributes = (new ReflectionClass(NotificationEventRecoveryCrontab::class))
            ->getAttributes(Crontab::class);
        self::assertCount(1, $attributes);

        $crontab = $attributes[0]->newInstance();
        self::assertSame('* * * * *', $crontab->rule);
        self::assertTrue($crontab->singleton);
        self::assertTrue($crontab->onOneServer);
        self::assertSame(55, $crontab->mutexExpires);
    }

    private function crontab(
        NotificationEventRepositoryInterface $events,
        EventDispatcherInterface $dispatcher,
        ConfigInterface $config,
    ): NotificationEventRecoveryCrontab {
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::never())->method('error');

        return new NotificationEventRecoveryCrontab(
            $events,
            $dispatcher,
            $logger,
            $config,
        );
    }
}
