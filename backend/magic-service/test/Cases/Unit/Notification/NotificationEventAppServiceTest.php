<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Notification;

use App\Application\Notification\Service\NotificationErrorFormatter;
use App\Application\Notification\Service\NotificationEventAppService;
use App\Application\Notification\Strategy\DefaultNotificationCatalogStrategy;
use App\Application\Notification\Validator\NotificationEventEnvelopeValidator;
use App\Domain\Notification\Entity\NotificationEventEntity;
use App\Domain\Notification\Repository\Facade\NotificationEventRepositoryInterface;
use App\Domain\Notification\Service\NotificationEventTypeRegistry;
use App\ErrorCode\EventErrorCode;
use App\ErrorCode\NotificationErrorCode;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;

/** @internal */
final class NotificationEventAppServiceTest extends TestCase
{
    public function testDispatchFailureKeepsAcceptedEventPendingWithoutConsumerAttempt(): void
    {
        $validator = new NotificationEventEnvelopeValidator(
            new NotificationEventTypeRegistry(new DefaultNotificationCatalogStrategy())
        );
        $events = $this->createMock(NotificationEventRepositoryInterface::class);
        $events->expects(self::once())->method('findByEventId')->willReturn(null);
        $events->expects(self::once())->method('createOrGet')->willReturnCallback(
            static fn (NotificationEventEntity $event): NotificationEventEntity => $event
        );
        $events->expects(self::once())
            ->method('markDispatchFailed')
            ->with(
                '785205968218931250',
                (string) EventErrorCode::EVENT_DELIVERY_FAILED->value,
                'AMQP channel unavailable',
                self::isType('string'),
            )
            ->willReturn(true);

        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects(self::once())
            ->method('dispatch')
            ->willThrowException(new RuntimeException('AMQP channel unavailable'));

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())->method('error');
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        $result = (new NotificationEventAppService($validator, $events, $dispatcher, $loggerFactory))
            ->publish($this->envelope());

        self::assertSame('785205968218931250', $result['event_id']);
        self::assertSame('pending', $result['status']);
        self::assertTrue($result['accepted']);
        self::assertFalse($result['duplicate']);
        self::assertFalse($result['queued']);
        self::assertSame(NotificationErrorCode::EVENT_DISPATCH_FAILED->value, $result['code']);
    }

    public function testErrorSummaryUsesNumericFallbackAndIsTruncated(): void
    {
        $exception = new RuntimeException(str_repeat("temporary\nsecret ", 100));

        self::assertSame((string) EventErrorCode::EVENT_DELIVERY_FAILED->value, NotificationErrorFormatter::code(
            $exception,
            EventErrorCode::EVENT_DELIVERY_FAILED->value
        ));
        self::assertSame(500, mb_strlen(NotificationErrorFormatter::message($exception)));
        self::assertStringNotContainsString("\n", NotificationErrorFormatter::message($exception));
    }

    /** @return array<string, mixed> */
    private function envelope(): array
    {
        return [
            'event_id' => '785205968218931250',
            'event_type' => 'task.finished',
            'occurred_at' => '2026-10-10 10:00:00',
            'producer' => 'notification-test',
            'organization_code' => 'NOTIFICATION_TEST',
            'source' => [
                'domain' => 'task',
                'type' => 'task',
                'id' => '785205968218931251',
            ],
            'recipients' => [[
                'user_id' => 'usi_notification_dispatch_failure',
                'source_event_key' => 'task:NOTIFICATION_TEST:785205968218931251:usi_notification_dispatch_failure:finished',
                'payload' => ['task_name' => 'AMQP failure'],
            ]],
            'payload' => ['status' => 'finished'],
            'schema_version' => 1,
        ];
    }
}
