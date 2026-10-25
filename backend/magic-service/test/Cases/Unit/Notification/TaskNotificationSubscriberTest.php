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
use App\Application\SuperMagic\Task\Event\Subscribe\TaskNotificationSubscriber;
use App\Application\SuperMagic\Task\Service\TaskNotificationLabelResolver;
use App\Domain\Notification\Service\NotificationEventTypeRegistry;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageMetadata;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessagePayload;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Event\RunTaskCallbackEvent;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Entity\WorkspaceEntity;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\Interfaces\SuperMagic\Message\DTO\TopicTaskMessageDTO;
use Hyperf\Config\Config;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;

/** @internal */
final class TaskNotificationSubscriberTest extends TestCase
{
    public function testFinishedTaskIsConvertedToNotificationEnvelope(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())
            ->method('publish')
            ->willReturnCallback(function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                (new NotificationEventEnvelopeValidator(
                    new NotificationEventTypeRegistry(new DefaultNotificationCatalogStrategy())
                ))->validate($envelope);
                return ['event_id' => '1', 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            });

        [$subscriber, $event] = $this->subscriberAndEvent('finished', $publisher);
        $subscriber->process($event);

        self::assertCount(1, $published);
        self::assertSame('task.finished', $published[0]->eventType);
        self::assertSame('ORG', $published[0]->organizationCode);
        self::assertSame('456', $published[0]->source->id);
        self::assertSame('task:ORG:456:usi_recipient:finished', $published[0]->recipients[0]->sourceEventKey);
        self::assertSame('project', $published[0]->payload['resource_type']);
        self::assertSame('project', $published[0]->recipients[0]->payload['resource_type']);
        self::assertArrayHasKey('project_mode', $published[0]->payload);
        self::assertArrayHasKey('resource_code', $published[0]->payload);
        self::assertSame('finished', $published[0]->payload['status']);
        self::assertSame('Weekly report', $published[0]->payload['task_name']);
    }

    /** @dataProvider errorStatuses */
    public function testErrorTerminalStatusesUseTaskErrorNotification(string $status): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())
            ->method('publish')
            ->willReturnCallback(function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => '1', 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            });

        [$subscriber, $event] = $this->subscriberAndEvent($status, $publisher, 'task failed');
        $subscriber->process($event);

        self::assertCount(1, $published);
        self::assertSame('task.error', $published[0]->eventType);
        self::assertSame('task:ORG:456:usi_recipient:error', $published[0]->recipients[0]->sourceEventKey);
        self::assertSame('project', $published[0]->payload['resource_type']);
        self::assertSame('project', $published[0]->recipients[0]->payload['resource_type']);
        self::assertSame($status, $published[0]->payload['status']);
        self::assertSame('task failed', $published[0]->payload['error_message']);
    }

    public static function errorStatuses(): iterable
    {
        yield 'error' => ['error'];
        yield 'stopped' => ['stopped'];
        yield 'suspended' => ['suspended'];
    }

    public function testFinishedTaskIncludesWorkspaceAndProjectLabels(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())->method('publish')->willReturnCallback(
            function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => '1', 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            }
        );

        [$subscriber, $event] = $this->subscriberAndEvent('finished', $publisher, '', true, true);
        $subscriber->process($event);

        self::assertSame('Workspace', $published[0]->payload['workspace_name']);
        self::assertSame('Project', $published[0]->payload['project_name']);
        self::assertSame('123', $published[0]->payload['topic_id']);
        self::assertSame('42', $published[0]->payload['workspace_id']);
        self::assertSame('84', $published[0]->payload['project_id']);
    }

    public function testFinishedTaskFallsBackToMessageMetadataWhenTopicIsUnavailable(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())->method('publish')->willReturnCallback(
            function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => '1', 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            }
        );

        [$subscriber, $event] = $this->subscriberAndEvent('finished', $publisher, '', true, false, true);
        $subscriber->process($event);

        self::assertSame('Workspace', $published[0]->payload['workspace_name']);
        self::assertSame('Project', $published[0]->payload['project_name']);
        self::assertSame('42', $published[0]->payload['workspace_id']);
        self::assertSame('84', $published[0]->payload['project_id']);
    }

    public function testEventContextSnapshotPreservesLabelsWhenTopicIsUnavailable(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())->method('publish')->willReturnCallback(
            function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => '1', 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            }
        );

        [$subscriber, $event] = $this->subscriberAndEvent(
            'error',
            $publisher,
            'sandbox init failed',
            true,
            false,
            false,
            [
                'project_id' => '84',
                'project_name' => 'Project snapshot',
                'workspace_id' => '42',
                'workspace_name' => 'Workspace snapshot',
            ]
        );
        $subscriber->process($event);

        self::assertSame('Workspace snapshot', $published[0]->payload['workspace_name']);
        self::assertSame('Project snapshot', $published[0]->payload['project_name']);
        self::assertSame('42', $published[0]->payload['workspace_id']);
        self::assertSame('84', $published[0]->payload['project_id']);
        self::assertSame('sandbox init failed', $published[0]->payload['error_message']);
    }

    public function testZeroWorkspaceIdFallsBackToProjectWorkspaceContext(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::once())->method('publish')->willReturnCallback(
            function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return ['event_id' => '1', 'status' => 'pending', 'accepted' => true, 'duplicate' => false];
            }
        );

        [$subscriber, $event] = $this->subscriberAndEvent(
            'error',
            $publisher,
            'sandbox init failed',
            true,
            false,
            false,
            ['project_id' => '84', 'workspace_id' => '0']
        );
        $subscriber->process($event);

        self::assertSame('42', $published[0]->payload['workspace_id']);
        self::assertSame('Workspace', $published[0]->payload['workspace_name']);
    }

    public function testNonTerminalTaskStatusDoesNotPublish(): void
    {
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::never())->method('publish');

        [$subscriber, $event] = $this->subscriberAndEvent('running', $publisher, '', false);
        $subscriber->process($event);
    }

    public function testDisabledTaskNotificationsDoNotSubscribeOrPublishQueuedCallbacks(): void
    {
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::never())->method('publish');
        [$subscriber, $event] = $this->subscriberAndEvent('finished', $publisher, expectPublisher: false, taskEnabled: false);

        self::assertSame([], $subscriber->listen());
        $subscriber->process($event);
    }

    public function testRepeatedCallbackKeepsStableIdempotencyIdentity(): void
    {
        $published = [];
        $publisher = $this->createMock(NotificationEventPublisherInterface::class);
        $publisher->expects(self::exactly(2))
            ->method('publish')
            ->willReturnCallback(function (array|EventEnvelope $envelope) use (&$published): array {
                self::assertInstanceOf(EventEnvelope::class, $envelope);
                $published[] = $envelope;
                return [
                    'event_id' => (string) $envelope->eventId,
                    'status' => 'pending',
                    'accepted' => true,
                    'duplicate' => count($published) === 2,
                ];
            });

        [$subscriber, $event] = $this->subscriberAndEvent('finished', $publisher);
        $subscriber->process($event);
        $subscriber->process($event);

        self::assertCount(2, $published);
        self::assertSame($published[0]->eventId, $published[1]->eventId);
        self::assertSame(
            $published[0]->recipients[0]->sourceEventKey,
            $published[1]->recipients[0]->sourceEventKey
        );
        self::assertSame($published[0]->payload, $published[1]->payload);
    }

    /**
     * @return array{0:TaskNotificationSubscriber,1:RunTaskCallbackEvent}
     */
    private function subscriberAndEvent(
        string $status,
        NotificationEventPublisherInterface $publisher,
        string $remark = '',
        bool $expectPublisher = true,
        bool $withLabels = false,
        bool $withMetadataLabels = false,
        array $eventLabels = [],
        bool $taskEnabled = true,
    ): array {
        $logger = $this->createMock(LoggerInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        $payload = $this->createMock(MessagePayload::class);
        $payload->method('getStatus')->willReturn($status);
        $payload->method('getRemark')->willReturn($remark);
        $taskMessage = $this->createMock(TopicTaskMessageDTO::class);
        $taskMessage->method('getPayload')->willReturn($payload);
        $metadata = $this->createMock(MessageMetadata::class);
        $metadata->method('getProjectId')->willReturn($withMetadataLabels ? '84' : '');
        $metadata->method('getWorkspaceId')->willReturn($withMetadataLabels ? '42' : '');
        $taskMessage->method('getMetadata')->willReturn($metadata);
        $event = $this->createMock(RunTaskCallbackEvent::class);
        $event->method('getEventId')->willReturn(111);
        $event->method('getOrganizationCode')->willReturn('ORG');
        $event->method('getUserId')->willReturn('usi_recipient');
        $event->method('getTopicId')->willReturn(123);
        $event->method('getTopicName')->willReturn('Weekly report');
        $event->method('getTaskId')->willReturn(456);
        $event->method('getProjectId')->willReturn($eventLabels['project_id'] ?? '');
        $event->method('getProjectName')->willReturn($eventLabels['project_name'] ?? '');
        $event->method('getWorkspaceId')->willReturn($eventLabels['workspace_id'] ?? '');
        $event->method('getWorkspaceName')->willReturn($eventLabels['workspace_name'] ?? '');
        $event->method('getTaskMessage')->willReturn($taskMessage);

        $container = $this->createMock(ContainerInterface::class);
        if ($expectPublisher) {
            $topic = $this->createMock(TopicEntity::class);
            $topic->method('getTopicName')->willReturn($withLabels ? 'Weekly report' : '');
            $topic->method('getProjectId')->willReturn($withLabels ? 84 : 0);
            $topic->method('getWorkspaceId')->willReturn($withLabels ? 42 : null);
            $topicService = $this->createMock(TopicDomainService::class);
            $topicService->method('getTopicById')->willReturn($withLabels ? $topic : null);

            $project = $this->createMock(ProjectEntity::class);
            $project->method('getProjectName')->willReturn('Project');
            $project->method('getWorkspaceId')->willReturn(42);
            $projectService = $this->createMock(ProjectDomainService::class);
            $projectService->method('getProjectNotUserId')->willReturn($project);

            $workspace = $this->createMock(WorkspaceEntity::class);
            $workspace->method('getName')->willReturn('Workspace');
            $workspaceService = $this->createMock(WorkspaceDomainService::class);
            $workspaceService->method('getWorkspaceDetail')->willReturn($workspace);
            $labelResolver = new TaskNotificationLabelResolver(
                $topicService,
                $projectService,
                $workspaceService,
                $loggerFactory
            );

            $container->method('get')->willReturnCallback(static function (string $id) use (
                $publisher,
                $labelResolver,
                $topicService,
                $projectService,
                $workspaceService,
            ): object {
                return match ($id) {
                    ConfigInterface::class => new Config(['notification' => ['task_enabled' => true]]),
                    NotificationEventPublisherInterface::class => $publisher,
                    TaskNotificationLabelResolver::class => $labelResolver,
                    TopicDomainService::class => $topicService,
                    ProjectDomainService::class => $projectService,
                    WorkspaceDomainService::class => $workspaceService,
                    default => throw new RuntimeException("Unexpected service: {$id}"),
                };
            });
        } else {
            $container->expects(self::exactly($taskEnabled ? 1 : 2))->method('get')
                ->with(ConfigInterface::class)
                ->willReturn(new Config(['notification' => ['task_enabled' => $taskEnabled]]));
        }

        return [new TaskNotificationSubscriber($container, $loggerFactory), $event];
    }
}
