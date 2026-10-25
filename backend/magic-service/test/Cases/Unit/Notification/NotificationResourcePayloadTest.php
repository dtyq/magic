<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Notification;

use App\Application\Notification\Service\NotificationResourcePayload;
use App\Domain\Notification\Entity\NotificationEntity;
use PHPUnit\Framework\TestCase;

/** @internal */
final class NotificationResourcePayloadTest extends TestCase
{
    public function testLegacyMessagesExposeResourceTypesWithoutReplacingRoutingFields(): void
    {
        foreach (['task_finished' => 'project', 'task_failed' => 'project', 'project_shared' => 'project', 'file_shared' => 'file', 'agent_approved' => 'agent', 'skill_approved' => 'skill'] as $type => $resourceType) {
            $entity = new NotificationEntity();
            $entity->setType($type);
            $entity->setSourceId('source-1');
            $entity->setPayload(['project_id' => 'project-2', 'topic_id' => 'topic-3', 'share_code' => 'share-4', 'resource_code' => 'code-5']);
            $payload = NotificationResourcePayload::forNotification($entity);
            self::assertSame($resourceType, $payload['resource_type']);
            self::assertSame(str_starts_with($type, 'task_') ? 'project-2' : 'source-1', $payload['resource_id']);
            self::assertSame('share-4', $payload['share_code']);
            self::assertSame('code-5', $payload['resource_code']);
            self::assertArrayNotHasKey('resource_type', $entity->getPayload());
        }
    }

    public function testTaskWithoutProjectDoesNotUseTaskIdAsProjectId(): void
    {
        $entity = new NotificationEntity();
        $entity->setType('task_finished');
        $entity->setSourceId('task-1');
        self::assertArrayNotHasKey('resource_id', NotificationResourcePayload::forNotification($entity));
        self::assertFalse(NotificationResourcePayload::canOpenResource($entity));
    }

    public function testSharingRequiresTheShareCodeAndRevokedResourcesCannotOpen(): void
    {
        $entity = new NotificationEntity();
        $entity->setType('project_shared');
        $entity->setSourceId('share-id');
        self::assertFalse(NotificationResourcePayload::canOpenResource($entity));
        $entity->setPayload(['share_code' => 'code']);
        self::assertTrue(NotificationResourcePayload::canOpenResource($entity));
        $entity->setMessageStatus('withdrawn');
        self::assertFalse(NotificationResourcePayload::canOpenResource($entity));
    }
}
