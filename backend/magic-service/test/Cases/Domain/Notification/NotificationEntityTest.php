<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Notification;

use App\Application\Notification\Strategy\DefaultNotificationCatalogStrategy;
use App\Domain\Notification\Constant\NotificationActionStatus;
use App\Domain\Notification\Constant\NotificationCategory;
use App\Domain\Notification\Constant\NotificationEventStatus;
use App\Domain\Notification\Constant\NotificationEventType;
use App\Domain\Notification\Constant\NotificationMessageStatus;
use App\Domain\Notification\Constant\NotificationTemplateStatus;
use App\Domain\Notification\Constant\NotificationType;
use App\Domain\Notification\Entity\NotificationEntity;
use App\Domain\Notification\Entity\NotificationEventEntity;
use App\Domain\Notification\Entity\NotificationTemplateEntity;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class NotificationEntityTest extends TestCase
{
    public function testNotificationEntityHydratesPublicEnumsAndJsonPayload(): void
    {
        $entity = NotificationEntity::fromArray([
            'id' => 123,
            'category' => 'system',
            'type' => 'task_finished',
            'payload' => '{"resource_name":"项目A"}',
            'message_status' => 'active',
        ]);

        self::assertSame('123', $entity->getId());
        self::assertSame(NotificationCategory::SYSTEM, $entity->getCategory());
        self::assertSame(NotificationType::TASK_FINISHED, $entity->getType());
        self::assertSame(['resource_name' => '项目A'], $entity->getPayload());
        self::assertSame(NotificationMessageStatus::ACTIVE, $entity->getMessageStatus());
        self::assertSame(NotificationActionStatus::NONE, $entity->getActionStatus());
    }

    public function testEventEntityHydratesStatusAndPublicEventType(): void
    {
        $entity = NotificationEventEntity::fromArray([
            'event_id' => 456,
            'event_type' => 'task.finished',
            'event_payload' => ['task_id' => '789'],
            'status' => 'processing',
        ]);

        self::assertSame('456', $entity->getEventId());
        self::assertSame(NotificationEventType::TASK_FINISHED, $entity->getEventType());
        self::assertSame(NotificationEventStatus::PROCESSING, $entity->getStatus());
        self::assertSame(['task_id' => '789'], $entity->getEventPayload());
    }

    public function testTemplateEntityHydratesStatus(): void
    {
        $entity = NotificationTemplateEntity::fromArray([
            'id' => 1,
            'template_type' => 'task_finished',
            'version' => 1,
            'locale' => 'zh-CN',
            'title_template' => '任务完成',
            'body_template' => '{{task_name}}',
            'status' => 'active',
        ]);

        self::assertSame('1', $entity->getId());
        self::assertSame('task_finished', $entity->getTemplateType());
        self::assertSame(NotificationTemplateStatus::ACTIVE, $entity->getStatus());
    }

    public function testDefaultCatalogContainsOnlyPublicValues(): void
    {
        $catalog = new DefaultNotificationCatalogStrategy();

        self::assertCount(8, $catalog->eventTypes());
        self::assertCount(6, $catalog->notificationTypes());
        self::assertTrue($catalog->supportsEvent('task.finished'));
        self::assertTrue($catalog->supportsNotification('task_finished'));
        self::assertFalse($catalog->supportsEvent('unknown.event'));
        self::assertFalse($catalog->supportsNotification('unknown_type'));
    }
}
