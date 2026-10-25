<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Notification;

use App\Domain\Notification\Constant\NotificationActionStatus;
use App\Domain\Notification\Constant\NotificationCategory;
use App\Domain\Notification\Constant\NotificationMessageStatus;
use App\Domain\Notification\Entity\NotificationEntity;
use App\Domain\Notification\Entity\ValueObject\NotificationDataIsolation;
use App\Domain\Notification\Repository\Persistence\NotificationRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/** @internal */
final class NotificationRepositoryIsolationAndCursorTest extends TestCase
{
    /** @var list<string> */
    private array $notificationIds = [];

    protected function setUp(): void
    {
        parent::setUp();

        if (! Schema::hasTable('magic_notifications')) {
            self::markTestSkipped('notification table is not fully migrated');
        }
    }

    protected function tearDown(): void
    {
        if ($this->notificationIds !== []) {
            Db::table('magic_notifications')->whereIn('id', $this->notificationIds)->delete();
        }

        parent::tearDown();
    }

    public function testOrganizationAndAccountScopesNeverCross(): void
    {
        $organizationA = 'notification_test_org_a_' . bin2hex(random_bytes(3));
        $organizationB = 'notification_test_org_b_' . bin2hex(random_bytes(3));
        $userA = 'notification_test_user_a_' . bin2hex(random_bytes(3));
        $userB = 'notification_test_user_b_' . bin2hex(random_bytes(3));

        $idA = $this->insertNotification($organizationA, $userA, '2026-10-09 10:00:03');
        $idSameOrganizationOtherUser = $this->insertNotification($organizationA, $userB, '2026-10-09 10:00:02');
        $idOtherOrganizationSameUser = $this->insertNotification($organizationB, $userA, '2026-10-09 10:00:01');

        $repository = new NotificationRepository();
        $accountA = NotificationDataIsolation::create($organizationA, $userA);
        $accountB = NotificationDataIsolation::create($organizationA, $userB);
        $otherOrganization = NotificationDataIsolation::create($organizationB, $userA);

        $pageA = $repository->listByRecipient($accountA, null, null, 10);
        self::assertSame([$idA], array_map(static fn ($item): string => $item->getId(), $pageA['items']));
        self::assertSame(1, $repository->countUnreadSystem($accountA));
        self::assertNull($repository->findById($accountA, $idSameOrganizationOtherUser));
        self::assertNull($repository->findById($accountA, $idOtherOrganizationSameUser));

        $pageB = $repository->listByRecipient($accountB, null, null, 10);
        self::assertSame([$idSameOrganizationOtherUser], array_map(static fn ($item): string => $item->getId(), $pageB['items']));
        self::assertSame(1, $repository->countUnreadSystem($accountB));
        self::assertSame([$idOtherOrganizationSameUser], array_map(
            static fn ($item): string => $item->getId(),
            $repository->listByRecipient($otherOrganization, null, null, 10)['items']
        ));
    }

    public function testCursorAcrossSameTimestampHasNoDuplicatesOrGaps(): void
    {
        $organization = 'notification_test_cursor_' . bin2hex(random_bytes(3));
        $user = 'notification_test_cursor_user_' . bin2hex(random_bytes(3));
        $createdAt = '2026-10-09 10:00:00';
        $ids = [];
        for ($index = 0; $index < 5; ++$index) {
            $ids[] = $this->insertNotification($organization, $user, $createdAt);
        }

        $repository = new NotificationRepository();
        $isolation = NotificationDataIsolation::create($organization, $user);
        $first = $repository->listByRecipient($isolation, NotificationCategory::SYSTEM, null, 2);
        $second = $repository->listByRecipient($isolation, NotificationCategory::SYSTEM, $first['next_cursor'], 2);
        $third = $repository->listByRecipient($isolation, NotificationCategory::SYSTEM, $second['next_cursor'], 2);

        $seen = array_merge(
            array_map(static fn ($item): string => $item->getId(), $first['items']),
            array_map(static fn ($item): string => $item->getId(), $second['items']),
            array_map(static fn ($item): string => $item->getId(), $third['items'])
        );
        $expected = $ids;
        rsort($expected, SORT_STRING);
        self::assertSame($expected, $seen);
        self::assertCount(5, array_unique($seen));
        self::assertTrue($first['has_more']);
        self::assertTrue($second['has_more']);
        self::assertFalse($third['has_more']);
        self::assertNull($third['next_cursor']);
    }

    public function testMalformedCursorIsRejectedInsteadOfRestartingFromFirstPage(): void
    {
        $repository = new NotificationRepository();
        $isolation = NotificationDataIsolation::create('notification_test_invalid_cursor', 'notification_test_user');

        $this->expectException(InvalidArgumentException::class);
        $repository->listByRecipient($isolation, null, 'not-a-cursor', 10);
    }

    public function testCreateReactivatesWithdrawnNotificationForANewShareCycle(): void
    {
        $organization = 'notification_test_restore_' . bin2hex(random_bytes(3));
        $user = 'notification_test_restore_user_' . bin2hex(random_bytes(3));
        $sourceEventKey = 'share:ORG:project:1001:12:' . $user;
        $id = (string) IdGenerator::getSnowId();
        $this->notificationIds[] = $id;

        Db::table('magic_notifications')->insert([
            'id' => $id,
            'organization_code' => $organization,
            'recipient_user_id' => $user,
            'category' => NotificationCategory::SYSTEM->value,
            'type' => 'project_shared',
            'template_version' => 1,
            'payload' => json_encode(['resource_name' => 'old'], JSON_THROW_ON_ERROR),
            'source_event_key' => $sourceEventKey,
            'source_domain' => 'share',
            'source_type' => 'project',
            'source_id' => '1001',
            'source_version' => null,
            'message_status' => NotificationMessageStatus::WITHDRAWN->value,
            'read_at' => '2026-10-16 10:00:00',
            'action_status' => NotificationActionStatus::NONE->value,
            'actioned_at' => null,
            'actioned_by' => null,
            'created_at' => '2026-10-16 09:00:00',
            'updated_at' => '2026-10-16 10:00:00',
        ]);

        $entity = new NotificationEntity();
        $entity->setOrganizationCode($organization);
        $entity->setRecipientUserId($user);
        $entity->setCategory(NotificationCategory::SYSTEM);
        $entity->setType('project_shared');
        $entity->setTemplateVersion(2);
        $entity->setPayload(['resource_name' => 'new']);
        $entity->setSourceEventKey($sourceEventKey);
        $entity->setSourceDomain('share');
        $entity->setSourceType('project');
        $entity->setSourceId('1001');
        $entity->setMessageStatus(NotificationMessageStatus::ACTIVE);
        $entity->setActionStatus(NotificationActionStatus::NONE);

        $restored = (new NotificationRepository())->create(
            NotificationDataIsolation::create($organization, $user),
            $entity
        );

        self::assertSame($id, $restored->getId());
        $row = Db::table('magic_notifications')->where('id', $id)->first();
        $row = (array) $row;
        self::assertSame(NotificationMessageStatus::ACTIVE->value, $row['message_status']);
        self::assertNull($row['read_at']);
        self::assertSame(2, (int) $row['template_version']);
        self::assertSame(['resource_name' => 'new'], json_decode($row['payload'], true, 512, JSON_THROW_ON_ERROR));
        self::assertNotSame('2026-10-16 09:00:00', $row['created_at']);
    }

    private function insertNotification(string $organization, string $user, string $createdAt): string
    {
        $id = (string) IdGenerator::getSnowId();
        $this->notificationIds[] = $id;
        Db::table('magic_notifications')->insert([
            'id' => $id,
            'organization_code' => $organization,
            'recipient_user_id' => $user,
            'category' => NotificationCategory::SYSTEM->value,
            'type' => 'task_finished',
            'template_version' => 1,
            'payload' => '{}',
            'source_event_key' => 'notification-test:' . $id,
            'source_domain' => 'task',
            'source_type' => 'task',
            'source_id' => $id,
            'source_version' => null,
            'message_status' => 'active',
            'read_at' => null,
            'action_status' => 'none',
            'actioned_at' => null,
            'actioned_by' => null,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);

        return $id;
    }
}
