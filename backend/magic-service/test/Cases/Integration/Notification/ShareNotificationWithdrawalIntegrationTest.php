<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Integration\Notification;

use App\Application\Notification\Service\NotificationConsumerService;
use App\Application\Notification\Strategy\DefaultNotificationCatalogStrategy;
use App\Application\Notification\Validator\NotificationEventEnvelopeValidator;
use App\Domain\Notification\Constant\NotificationActionStatus;
use App\Domain\Notification\Constant\NotificationCategory;
use App\Domain\Notification\Constant\NotificationMessageStatus;
use App\Domain\Notification\Entity\NotificationEntity;
use App\Domain\Notification\Entity\NotificationEventEntity;
use App\Domain\Notification\Entity\ValueObject\NotificationDataIsolation;
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

/** @internal */
final class ShareNotificationWithdrawalIntegrationTest extends TestCase
{
    /** @var list<string> */
    private array $eventIds = [];

    /** @var list<string> */
    private array $notificationIds = [];

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
        parent::tearDown();
    }

    public function testRecipientScopedShareWithdrawalLeavesOtherRecipientsVisible(): void
    {
        $organization = 'share_notification_test_' . bin2hex(random_bytes(4));
        $sourceId = (string) IdGenerator::getSnowId();
        $removedUser = 'usi_removed_' . bin2hex(random_bytes(4));
        $retainedUser = 'usi_retained_' . bin2hex(random_bytes(4));
        $removedNotificationId = $this->createShareNotification($organization, $removedUser, $sourceId);
        $retainedNotificationId = $this->createShareNotification($organization, $retainedUser, $sourceId);
        $eventId = (string) IdGenerator::getSnowId();

        $event = new NotificationEventEntity();
        $event->setEventId($eventId);
        $event->setEventType('share.project.withdrawn');
        $event->setOrganizationCode($organization);
        $event->setSourceDomain('share');
        $event->setSourceType('project');
        $event->setSourceId($sourceId);
        $event->setRecipientCount(1);
        $event->setEventPayload([
            'event_id' => $eventId,
            'event_type' => 'share.project.withdrawn',
            'occurred_at' => date('Y-m-d H:i:s'),
            'producer' => 'notification-test',
            'organization_code' => $organization,
            'source' => ['domain' => 'share', 'type' => 'project', 'id' => $sourceId],
            'recipients' => [[
                'user_id' => $removedUser,
                'source_event_key' => "share:{$organization}:project:{$sourceId}:1:{$removedUser}",
            ]],
            'payload' => ['resource_id' => $sourceId, 'resource_type' => 'project'],
            'schema_version' => 1,
        ]);
        (new NotificationEventRepository())->createOrGet($event);
        $this->eventIds[] = $eventId;

        $this->consumer()->consume($eventId);

        self::assertSame(
            NotificationMessageStatus::WITHDRAWN->value,
            Db::table('magic_notifications')->where('id', $removedNotificationId)->value('message_status')
        );
        self::assertSame(
            NotificationMessageStatus::ACTIVE->value,
            Db::table('magic_notifications')->where('id', $retainedNotificationId)->value('message_status')
        );
    }

    private function createShareNotification(string $organization, string $userId, string $sourceId): string
    {
        $notification = new NotificationEntity();
        $notification->setOrganizationCode($organization);
        $notification->setRecipientUserId($userId);
        $notification->setCategory(NotificationCategory::SYSTEM);
        $notification->setType('project_shared');
        $notification->setTemplateVersion(1);
        $notification->setPayload(['resource_id' => $sourceId]);
        $notification->setSourceEventKey("share:{$organization}:project:{$sourceId}:1:{$userId}");
        $notification->setSourceDomain('share');
        $notification->setSourceType('project');
        $notification->setSourceId($sourceId);
        $notification->setMessageStatus(NotificationMessageStatus::ACTIVE);
        $notification->setActionStatus(NotificationActionStatus::NONE);
        $notification->setCreatedAt(date('Y-m-d H:i:s'));
        $notification->setUpdatedAt(date('Y-m-d H:i:s'));

        $created = (new NotificationRepository())->create(
            NotificationDataIsolation::create($organization, $userId),
            $notification
        );
        $this->notificationIds[] = $created->getId();
        return $created->getId();
    }

    private function consumer(): NotificationConsumerService
    {
        return new NotificationConsumerService(
            new NotificationEventRepository(),
            new NotificationRepository(),
            new NotificationTemplateRepository(),
            new NotificationEventEnvelopeValidator(new NotificationEventTypeRegistry(new DefaultNotificationCatalogStrategy())),
            new DefaultNotificationCatalogStrategy(),
            ApplicationContext::getContainer()->get(ConfigInterface::class),
            ApplicationContext::getContainer()->get(LoggerFactory::class),
        );
    }
}
