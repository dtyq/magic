<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Review\Service;

use App\Application\Notification\Contract\EventEnvelope;
use App\Application\Notification\Contract\EventRecipient;
use App\Application\Notification\Contract\EventSource;
use App\Application\Notification\Contract\NotificationEventPublisherInterface;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

/** 将 Agent/Skill 审核通过结果转换为统一站内信事件。 */
final readonly class ReviewNotificationAppService
{
    public function __construct(
        private NotificationEventPublisherInterface $publisher,
        private ?ReviewNotificationRecipientsInterface $recipients = null,
    ) {
    }

    public function publishAgentApproved(AgentVersionEntity $version, ?string $resourceId = null): void
    {
        $this->publish(
            eventType: 'review.agent.version_approved',
            resourceType: 'agent',
            resourceId: $resourceId ?: (string) ($version->getId() ?? ''),
            resourceCode: $version->getCode(),
            resourceName: $version->getName(),
            versionId: (string) ($version->getId() ?? ''),
            versionName: $version->getVersion(),
            organizationCode: $version->getOrganizationCode(),
            recipientUserId: $version->getCreator(),
        );
    }

    public function publishSkillApproved(SkillVersionEntity $version, ?string $resourceId = null): void
    {
        $nameI18n = $version->getNameI18n();
        $resourceName = (string) ($nameI18n['zh'] ?? $nameI18n['en'] ?? $version->getPackageName());
        $this->publish(
            eventType: 'review.skill.version_approved',
            resourceType: 'skill',
            resourceId: $resourceId ?: (string) ($version->getId() ?? ''),
            resourceCode: $version->getCode(),
            resourceName: $resourceName,
            versionId: (string) ($version->getId() ?? ''),
            versionName: $version->getVersion(),
            organizationCode: $version->getOrganizationCode(),
            recipientUserId: $version->getCreatorId(),
        );
    }

    private function publish(
        string $eventType,
        string $resourceType,
        string $resourceId,
        string $resourceCode,
        string $resourceName,
        string $versionId,
        string $versionName,
        string $organizationCode,
        string $recipientUserId,
    ): void {
        if ($resourceId === '' || $versionId === '' || $organizationCode === '' || $recipientUserId === '') {
            return;
        }

        $userIds = ($this->recipients ?? new CreatorReviewNotificationRecipients())->resolve(
            $organizationCode,
            $resourceType,
            $resourceCode,
            $recipientUserId
        );
        // One event can fan out to collaborators without duplicating the creator.
        $recipients = [];
        foreach (array_unique($userIds) as $userId) {
            if ($userId === '') {
                continue;
            }
            $recipients[] = new EventRecipient($userId, sprintf(
                'review:%s:%s:%s:%s:%s:approved',
                $organizationCode,
                $resourceType,
                $resourceId,
                $versionId,
                $userId
            ));
        }
        if ($recipients === []) {
            return;
        }
        $payload = [
            'review_id' => $versionId,
            'resource_id' => $resourceId,
            // The inbox route selects Agent and Skill detail pages by this
            // stable resource category before it reads resource_code.
            'resource_type' => $resourceType,
            // Detail routes resolve Agent/Skill by code, never by the database ID.
            'resource_code' => $resourceCode,
            'resource_name' => $resourceName,
            'version_id' => $versionId,
            'version_name' => $versionName,
        ];

        // Keep department fan-out within the envelope validator's recipient limit.
        foreach (array_chunk($recipients, 500) as $batch) {
            $this->publisher->publish(new EventEnvelope(
                eventId: (string) IdGenerator::getSnowId(),
                eventType: $eventType,
                occurredAt: date('Y-m-d H:i:s'),
                producer: 'super_magic.review',
                organizationCode: $organizationCode,
                source: new EventSource('review', $resourceType, $resourceId, $versionId),
                recipients: $batch,
                payload: $payload,
            ));
        }
    }
}
