<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Notification;

use App\Application\Notification\Contract\EventEnvelope;
use App\Application\Notification\Contract\NotificationEventPublisherInterface;
use App\Application\Notification\Strategy\DefaultNotificationCatalogStrategy;
use App\Application\Notification\Validator\NotificationEventEnvelopeValidator;
use App\Application\SuperMagic\Review\Service\ReviewNotificationAppService;
use App\Application\SuperMagic\Review\Service\ReviewNotificationAppServiceFactory;
use App\Application\SuperMagic\Review\Service\ReviewNotificationRecipientsInterface;
use App\Domain\Notification\Service\NotificationEventTypeRegistry;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use Hyperf\Di\Container;
use Hyperf\Di\Definition\DefinitionSource;
use PHPUnit\Framework\TestCase;

/** @internal */
final class ReviewNotificationAppServiceTest extends TestCase
{
    public function testApprovalFansOutWithIndependentIdempotencyKeys(): void
    {
        $version = new AgentVersionEntity();
        $version->setId(2002);
        $version->setCode('agent-code');
        $version->setName('Agent');
        $version->setVersion('1.0');
        $version->setOrganizationCode('ORG');
        $version->setCreator('creator');
        $recipients = $this->createMock(ReviewNotificationRecipientsInterface::class);
        $recipients->expects(self::once())->method('resolve')->with('ORG', 'agent', 'agent-code', 'creator')
            ->willReturn(['creator', 'collaborator', 'creator']);
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())->method('publish')->willReturnCallback(function (EventEnvelope $event): array {
            self::assertSame(['creator', 'collaborator'], array_column($event->recipients, 'userId'));
            self::assertNotSame($event->recipients[0]->sourceEventKey, $event->recipients[1]->sourceEventKey);
            return [];
        });
        $container = new Container(new DefinitionSource([
            ReviewNotificationAppService::class => ReviewNotificationAppServiceFactory::class,
        ]));
        $container->set(NotificationEventPublisherInterface::class, $publisher);
        $container->set(ReviewNotificationRecipientsInterface::class, $recipients);
        $container->get(ReviewNotificationAppService::class)->publishAgentApproved($version, '1001');
    }

    public function testAgentApprovalPublishesVersionedEventToCreator(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())->method('publish')->willReturnCallback(
            function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                (new NotificationEventEnvelopeValidator(
                    new NotificationEventTypeRegistry(new DefaultNotificationCatalogStrategy())
                ))->validate($envelope);
                $published[] = $envelope;
                return ['event_id' => $envelope->eventId, 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            }
        );
        $version = $this->createMock(AgentVersionEntity::class);
        $version->method('getCode')->willReturn('agent-code');
        $version->method('getName')->willReturn('分析助手');
        $version->method('getId')->willReturn(2002);
        $version->method('getVersion')->willReturn('2.0.0');
        $version->method('getOrganizationCode')->willReturn('ORG');
        $version->method('getCreator')->willReturn('user-1');

        (new ReviewNotificationAppService($publisher))->publishAgentApproved($version, '1001');

        self::assertSame('review.agent.version_approved', $published[0]->eventType);
        self::assertSame('review:ORG:agent:1001:2002:user-1:approved', $published[0]->recipients[0]->sourceEventKey);
        self::assertSame('1001', $published[0]->payload['resource_id']);
        self::assertSame('agent', $published[0]->payload['resource_type']);
        self::assertSame('agent-code', $published[0]->payload['resource_code']);
        self::assertSame('2002', $published[0]->payload['version_id']);
    }

    public function testSkillApprovalPublishesFallbackNameAndStableKey(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())->method('publish')->willReturnCallback(
            function (array|EventEnvelope $envelope) use (&$published): array {
                $published[] = $envelope;
                return ['event_id' => '1', 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            }
        );
        $version = $this->createMock(SkillVersionEntity::class);
        $version->method('getCode')->willReturn('skill-code');
        $version->method('getNameI18n')->willReturn(['en' => 'Web Search']);
        $version->method('getPackageName')->willReturn('web-search');
        $version->method('getId')->willReturn(3003);
        $version->method('getVersion')->willReturn('1.2.0');
        $version->method('getOrganizationCode')->willReturn('ORG');
        $version->method('getCreatorId')->willReturn('user-2');

        (new ReviewNotificationAppService($publisher))->publishSkillApproved($version, '1002');

        self::assertSame('review.skill.version_approved', $published[0]->eventType);
        self::assertSame('skill', $published[0]->payload['resource_type']);
        self::assertSame('Web Search', $published[0]->payload['resource_name']);
        self::assertSame('skill-code', $published[0]->payload['resource_code']);
        self::assertSame('review:ORG:skill:1002:3003:user-2:approved', $published[0]->recipients[0]->sourceEventKey);
    }
}
