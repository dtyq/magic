<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Integration\Notification;

use App\Application\Notification\Contract\EventEnvelope;
use App\Application\Notification\Service\NotificationConsumerService;
use App\Application\Notification\Strategy\DefaultNotificationCatalogStrategy;
use App\Application\Notification\Validator\NotificationEventEnvelopeValidator;
use App\Domain\Notification\Constant\NotificationActionStatus;
use App\Domain\Notification\Constant\NotificationCategory;
use App\Domain\Notification\Constant\NotificationEventStatus;
use App\Domain\Notification\Constant\NotificationMessageStatus;
use App\Domain\Notification\Entity\NotificationEntity;
use App\Domain\Notification\Entity\NotificationEventEntity;
use App\Domain\Notification\Entity\ValueObject\NotificationDataIsolation;
use App\Domain\Notification\Repository\Facade\NotificationRepositoryInterface;
use App\Domain\Notification\Repository\Facade\NotificationTemplateRepositoryInterface;
use App\Domain\Notification\Repository\Persistence\NotificationEventRepository;
use App\Domain\Notification\Repository\Persistence\NotificationRepository;
use App\Domain\Notification\Repository\Persistence\NotificationTemplateRepository;
use App\Domain\Notification\Service\NotificationEventTypeRegistry;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Throwable;

/** @internal */
final class NotificationAmqpFailureIntegrationTest extends TestCase
{
    /** @var list<string> */
    private array $eventIds = [];

    /** @var list<string> */
    private array $notificationIds = [];

    /** @var list<int> */
    private array $asyncEventIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        if (! Schema::hasTable('magic_notification_events') || ! Schema::hasTable('magic_notifications')) {
            self::markTestSkipped('notification tables are not migrated');
        }
    }

    protected function tearDown(): void
    {
        if ($this->eventIds !== []) {
            Db::table('magic_notification_events')->whereIn('event_id', $this->eventIds)->delete();
        }
        if ($this->notificationIds !== []) {
            Db::table('magic_notifications')->whereIn('id', $this->notificationIds)->delete();
        }
        if ($this->asyncEventIds !== [] && Schema::hasTable('async_event_records')) {
            Db::table('async_event_records')->whereIn('id', $this->asyncEventIds)->delete();
        }
        parent::tearDown();
    }

    public function testRetryableFailureReturnsPendingAndSeparatesBusinessAttemptFromAsyncRetry(): void
    {
        $event = $this->persistEvent();
        $asyncEventId = $this->persistAsyncEvent($event->getEventId(), 2);

        $notifications = $this->createMock(NotificationRepositoryInterface::class);
        $notifications->method('findBySourceEventKey')
            ->willThrowException(new RuntimeException('temporary notification database failure', 9012));
        $templates = $this->templatesWithPublicTaskTemplate();
        $consumer = $this->consumer($notifications, $templates);

        try {
            $consumer->consume($event->getEventId());
            self::fail('A temporary failure must be rethrown to async-event.');
        } catch (RuntimeException $exception) {
            self::assertSame(9012, $exception->getCode());
        }

        $stored = $this->eventRepository()->findByEventId($event->getEventId());
        self::assertNotNull($stored);
        self::assertSame(NotificationEventStatus::PENDING, $stored->getStatus());
        self::assertSame(1, $stored->getAttempts());
        self::assertNotNull($stored->getNextRetryAt());
        self::assertSame('9012', $stored->getLastErrorCode());
        self::assertSame('temporary notification database failure', $stored->getLastErrorMessage());
        self::assertSame(0, $stored->getNotificationCount());
        self::assertSame(2, (int) Db::table('async_event_records')->where('id', $asyncEventId)->value('retry_times'));
        self::assertSame(0, (int) Db::table('magic_notifications')->where('source_id', $event->getSourceId())->count());
    }

    public function testDispatchFailureKeepsPendingEventAtZeroBusinessAttempts(): void
    {
        $event = $this->persistEvent();
        $repository = $this->eventRepository();
        self::assertTrue($repository->markDispatchFailed(
            $event->getEventId(),
            '6000',
            str_repeat('AMQP connection refused ', 100),
            date('Y-m-d H:i:s'),
        ));

        $stored = $repository->findByEventId($event->getEventId());
        self::assertNotNull($stored);
        self::assertSame(NotificationEventStatus::PENDING, $stored->getStatus());
        self::assertSame(0, $stored->getAttempts());
        self::assertNull($stored->getNextRetryAt());
        self::assertSame('6000', $stored->getLastErrorCode());
        self::assertSame(500, mb_strlen((string) $stored->getLastErrorMessage()));
        self::assertSame(0, $stored->getNotificationCount());
    }

    public function testThirdRetryFailureMarksEventFailedAndStopsRecovery(): void
    {
        $event = $this->persistEvent();
        $notifications = $this->createMock(NotificationRepositoryInterface::class);
        $notifications->method('findBySourceEventKey')
            ->willThrowException(new RuntimeException('database timeout', 9013));
        $consumer = $this->consumer($notifications, $this->templatesWithPublicTaskTemplate());

        for ($attempt = 1; $attempt <= 3; ++$attempt) {
            try {
                $consumer->consume($event->getEventId());
            } catch (RuntimeException) {
                // The listener must rethrow so async-event owns its retry record.
            }
            if ($attempt < 3) {
                Db::table('magic_notification_events')
                    ->where('event_id', $event->getEventId())
                    ->update(['next_retry_at' => date('Y-m-d H:i:s', time() - 1)]);
            }
        }

        $stored = $this->eventRepository()->findByEventId($event->getEventId());
        self::assertNotNull($stored);
        self::assertSame(NotificationEventStatus::FAILED, $stored->getStatus());
        self::assertSame(3, $stored->getAttempts());
        self::assertNull($stored->getNextRetryAt());
        self::assertSame('9013', $stored->getLastErrorCode());
        self::assertSame('database timeout', $stored->getLastErrorMessage());
        self::assertSame(0, $stored->getNotificationCount());
        self::assertSame(0, (int) Db::table('magic_notifications')->where('source_id', $event->getSourceId())->count());

        $before = $stored->getAttempts();
        $consumer->consume($event->getEventId());
        $after = $this->eventRepository()->findByEventId($event->getEventId());
        self::assertNotNull($after);
        self::assertSame($before, $after->getAttempts());
    }

    public function testMissingTemplateFailsOnFirstAttemptWithoutAutomaticRetry(): void
    {
        $event = $this->persistEvent();
        $templates = $this->createMock(NotificationTemplateRepositoryInterface::class);
        $templates->expects(self::once())->method('findLatestActive')->willReturn(null);
        $notifications = $this->createMock(NotificationRepositoryInterface::class);
        $consumer = $this->consumer($notifications, $templates);

        try {
            $consumer->consume($event->getEventId());
            self::fail('Missing template must fail the first consumption.');
        } catch (RuntimeException $exception) {
            self::assertSame(35010, $exception->getCode());
        }

        $stored = $this->eventRepository()->findByEventId($event->getEventId());
        self::assertNotNull($stored);
        self::assertSame(NotificationEventStatus::FAILED, $stored->getStatus());
        self::assertSame(1, $stored->getAttempts());
        self::assertNull($stored->getNextRetryAt());
        self::assertSame('35010', $stored->getLastErrorCode());
        self::assertSame(0, $stored->getNotificationCount());
    }

    public function testInvalidEnvelopeFailsOnFirstAttemptWithNumericContractErrorCode(): void
    {
        $event = $this->persistEvent();
        Db::table('magic_notification_events')
            ->where('event_id', $event->getEventId())
            ->update([
                'event_payload' => json_encode(
                    array_merge($event->getEventPayload(), ['schema_version' => 2]),
                    JSON_THROW_ON_ERROR,
                ),
            ]);

        $consumer = $this->consumer(
            $this->createMock(NotificationRepositoryInterface::class),
            $this->templatesWithPublicTaskTemplate(),
        );

        try {
            $consumer->consume($event->getEventId());
            self::fail('An unsupported schema must fail without an automatic retry.');
        } catch (Throwable $throwable) {
            self::assertSame(35007, $throwable->getCode());
        }

        $stored = $this->eventRepository()->findByEventId($event->getEventId());
        self::assertNotNull($stored);
        self::assertSame(NotificationEventStatus::FAILED, $stored->getStatus());
        self::assertSame(1, $stored->getAttempts());
        self::assertNull($stored->getNextRetryAt());
        self::assertSame('35007', $stored->getLastErrorCode());
        self::assertSame(0, $stored->getNotificationCount());
        self::assertSame(0, (int) Db::table('magic_notifications')->where('source_id', $event->getSourceId())->count());
    }

    public function testDuplicateMessageKeepsOriginalPayloadAndDoesNotIncreaseCount(): void
    {
        $event = $this->persistEvent();
        $recipient = $this->recipient($event);
        $isolation = NotificationDataIsolation::create($event->getOrganizationCode(), $recipient['user_id']);
        $notifications = new NotificationRepository();
        $existing = new NotificationEntity();
        $existing->setOrganizationCode($event->getOrganizationCode());
        $existing->setRecipientUserId($recipient['user_id']);
        $existing->setCategory(NotificationCategory::SYSTEM);
        $existing->setType('task_finished');
        $existing->setTemplateVersion(1);
        $existing->setPayload(['task_name' => 'original payload']);
        $existing->setSourceEventKey($recipient['source_event_key']);
        $existing->setSourceDomain('task');
        $existing->setSourceType('task');
        $existing->setSourceId($event->getSourceId());
        $existing->setMessageStatus(NotificationMessageStatus::ACTIVE);
        $existing->setActionStatus(NotificationActionStatus::NONE);
        $existing->setReadAt('2026-10-10 10:01:00');
        $existing->setCreatedAt('2026-10-10 10:00:00');
        $existing->setUpdatedAt('2026-10-10 10:00:00');
        $persisted = $notifications->create($isolation, $existing);
        $this->notificationIds[] = $persisted->getId();
        $beforeCount = (int) Db::table('magic_notifications')
            ->where('source_event_key', $recipient['source_event_key'])
            ->where('recipient_user_id', $recipient['user_id'])
            ->count();

        $consumer = $this->consumer($notifications, new NotificationTemplateRepository());
        $consumer->consume($event->getEventId());

        $row = Db::table('magic_notifications')->where('id', $persisted->getId())->first();
        self::assertNotNull($row);
        $payload = is_array($row) ? $row['payload'] : $row->payload;
        self::assertSame(['task_name' => 'original payload'], is_string($payload) ? json_decode($payload, true) : $payload);
        self::assertSame('2026-10-10 10:01:00', (string) (is_array($row) ? $row['read_at'] : $row->read_at));
        self::assertSame($beforeCount, (int) Db::table('magic_notifications')
            ->where('source_event_key', $recipient['source_event_key'])
            ->where('recipient_user_id', $recipient['user_id'])
            ->count());
        $storedEvent = $this->eventRepository()->findByEventId($event->getEventId());
        self::assertNotNull($storedEvent);
        self::assertSame(NotificationEventStatus::SUCCEEDED, $storedEvent->getStatus());
        self::assertSame(0, $storedEvent->getNotificationCount());
    }

    private function consumer(
        NotificationRepositoryInterface $notifications,
        NotificationTemplateRepositoryInterface $templates
    ): NotificationConsumerService {
        $validator = new NotificationEventEnvelopeValidator(
            new NotificationEventTypeRegistry(new DefaultNotificationCatalogStrategy())
        );
        return new NotificationConsumerService(
            $this->eventRepository(),
            $notifications,
            $templates,
            $validator,
            new DefaultNotificationCatalogStrategy(),
            ApplicationContext::getContainer()->get(ConfigInterface::class),
            ApplicationContext::getContainer()->get(LoggerFactory::class),
        );
    }

    private function eventRepository(): NotificationEventRepository
    {
        return new NotificationEventRepository();
    }

    private function persistEvent(): NotificationEventEntity
    {
        $suffix = bin2hex(random_bytes(6));
        $eventId = (string) IdGenerator::getSnowId();
        $userId = 'usi_amqp_test_' . $suffix;
        $sourceId = (string) IdGenerator::getSnowId();
        $sourceKey = "task:NOTIFICATION_TEST:{$sourceId}:{$userId}:finished";
        $event = new NotificationEventEntity();
        $event->setEventId($eventId);
        $event->setEventType('task.finished');
        $event->setOrganizationCode('NOTIFICATION_TEST');
        $event->setSourceDomain('task');
        $event->setSourceType('task');
        $event->setSourceId($sourceId);
        $event->setEventPayload($this->envelope($eventId, $sourceId, $userId, $sourceKey));
        $event->setRecipientCount(1);
        $persisted = $this->eventRepository()->createOrGet($event);
        $this->eventIds[] = $persisted->getEventId();
        return $persisted;
    }

    private function persistAsyncEvent(string $eventId, int $retryTimes): int
    {
        if (! Schema::hasTable('async_event_records')) {
            self::markTestSkipped('async_event_records table is not migrated');
        }
        $id = (int) Db::table('async_event_records')->insertGetId([
            'event' => EventEnvelope::class,
            'listener' => 'App\Application\Notification\Event\NotificationEventConsumeListener',
            'status' => 0,
            'retry_times' => $retryTimes,
            'args' => serialize(['event_id' => $eventId]),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->asyncEventIds[] = $id;
        return $id;
    }

    private function templatesWithPublicTaskTemplate(): NotificationTemplateRepositoryInterface
    {
        return new NotificationTemplateRepository();
    }

    /** @return array{user_id:string,source_event_key:string} */
    private function recipient(NotificationEventEntity $event): array
    {
        $payload = $event->getEventPayload();
        $recipient = (array) $payload['recipients'][0];
        return [
            'user_id' => (string) $recipient['user_id'],
            'source_event_key' => (string) $recipient['source_event_key'],
        ];
    }

    /** @return array<string,mixed> */
    private function envelope(string $eventId, string $sourceId, string $userId, string $sourceKey): array
    {
        return [
            'event_id' => $eventId,
            'event_type' => 'task.finished',
            'occurred_at' => '2026-10-10 10:00:00',
            'producer' => 'notification-test',
            'organization_code' => 'NOTIFICATION_TEST',
            'source' => ['domain' => 'task', 'type' => 'task', 'id' => $sourceId],
            'recipients' => [[
                'user_id' => $userId,
                'source_event_key' => $sourceKey,
                'payload' => ['task_name' => 'AMQP task'],
            ]],
            'payload' => ['status' => 'finished'],
            'schema_version' => 1,
        ];
    }
}
