<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Message;

use App\Application\SuperMagic\Message\Command\CleanupOrphanedMessageSchedulesCommand;
use App\Application\SuperMagic\Message\Event\Subscribe\MessageQueueCascadeDeleteSubscriber;
use App\Application\SuperMagic\Message\Service\MessageScheduleCleanupAppService;
use App\Application\SuperMagic\Project\Event\Subscribe\ProjectDeletedSubscriber;
use App\Application\SuperMagic\Task\Event\Subscribe\SandboxKeepAliveCleanupSubscriber;
use App\Application\SuperMagic\Task\Service\SandboxPreWarmAppService;
use App\Application\SuperMagic\Workspace\Service\WorkspaceAppService;
use App\Domain\SuperMagic\Common\RecycleBin\Service\RecycleBinDomainService;
use App\Domain\SuperMagic\Message\Repository\Facade\MessageScheduleLogRepositoryInterface;
use App\Domain\SuperMagic\Message\Repository\Model\MessageScheduleModel;
use App\Domain\SuperMagic\Message\Repository\Persistence\MessageScheduleRepository;
use App\Domain\SuperMagic\Message\Service\MessageQueueDomainService;
use App\Domain\SuperMagic\Message\Service\MessageScheduleDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Event\ProjectDeletedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectsBatchDeletedEvent;
use App\Domain\SuperMagic\Project\Repository\Model\ProjectModel;
use App\Domain\SuperMagic\Project\Repository\Persistence\ProjectRepository;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Service\SandboxKeepAliveDomainService;
use App\Domain\SuperMagic\Topic\Event\TopicDeletedEvent;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Entity\WorkspaceEntity;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\TaskScheduler\Repository\Persistence\TaskSchedulerCrontabRepository;
use Dtyq\TaskScheduler\Repository\Persistence\TaskSchedulerLogRepository;
use Dtyq\TaskScheduler\Repository\Persistence\TaskSchedulerRepository;
use Dtyq\TaskScheduler\Service\TaskSchedulerDomainService;
use Hyperf\Amqp\Producer;
use Hyperf\Command\Annotation\Command;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\Model\Register;
use Hyperf\Di\Annotation\AnnotationCollector;
use Hyperf\Di\Annotation\AnnotationReader;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\ListenerProviderFactory;
use Hyperf\Logger\LoggerFactory;
use HyperfTest\Cases\Application\SuperMagic\Support\OpenApiUnitTestTrait;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\NullLogger;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;
use Symfony\Component\Console\Tester\CommandTester;

/** @internal */
final class MessageScheduleCleanupTest extends TestCase
{
    use OpenApiUnitTestTrait {
        setUp as private setUpContext;
        tearDown as private tearDownContext;
    }

    private MessageScheduleRepository $repository;

    private ?ConnectionResolverInterface $previousResolver;

    protected function setUp(): void
    {
        $this->setUpContext();
        $this->unitConnection->statement('CREATE TABLE magic_super_agent_project (id INTEGER PRIMARY KEY, deleted_at TEXT, workspace_id INTEGER, user_id TEXT, is_hidden INTEGER)');
        $this->unitConnection->statement('CREATE TABLE magic_super_agent_message_scheduled (
            id INTEGER PRIMARY KEY, user_id TEXT, organization_code TEXT, project_id INTEGER,
            task_name TEXT, enabled INTEGER DEFAULT 1, updated_uid TEXT,
            deleted_at TEXT, updated_at TEXT, created_at TEXT
        )');
        $this->repository = new MessageScheduleRepository(new MessageScheduleModel());
        $this->previousResolver = Register::getConnectionResolver();
        Register::setConnectionResolver(ApplicationContext::getContainer()->get(ConnectionResolverInterface::class));
        foreach (['task_scheduler', 'task_scheduler_crontab'] as $table) {
            $this->unitConnection->statement('CREATE TABLE ' . $table . ' (id INTEGER PRIMARY KEY, external_id TEXT, environment TEXT)');
        }
    }

    protected function tearDown(): void
    {
        if ($this->previousResolver !== null) {
            Register::setConnectionResolver($this->previousResolver);
        } else {
            Register::unsetConnectionResolver();
        }
        $this->tearDownContext();
    }

    public function testListFiltersDeletedAndMissingProjectsBeforeCountingAndPaginating(): void
    {
        $this->unitConnection->table('magic_super_agent_project')->insert([
            ['id' => 1, 'deleted_at' => null],
            ['id' => 2, 'deleted_at' => '2026-10-01 00:00:00'],
        ]);
        foreach ([1 => 1, 2 => 2, 3 => 3, 4 => 0, 5 => 1] as $id => $project) {
            $this->schedule($id, $project);
        }
        $this->schedule(6, 1, 'other-user');
        $this->schedule(7, 1, 'caller', 'other-org');
        $this->schedule(8, 1, deletedAt: '2026-10-01 00:00:00');

        $first = $this->repository->getMessageSchedulesByConditions(
            ['user_id' => 'caller', 'organization_code' => 'caller-org'],
            1,
            2,
            'id',
            'asc'
        );
        self::assertSame(3, $first['total']);
        self::assertSame([1, 4], array_map(static fn ($entity) => $entity->getId(), $first['list']));
        $second = $this->repository->getMessageSchedulesByConditions(
            ['user_id' => 'caller', 'organization_code' => 'caller-org'],
            2,
            2,
            'id',
            'asc'
        );
        self::assertSame([5], array_map(static fn ($entity) => $entity->getId(), $second['list']));
    }

    public function testCleanupRemovesOneTimeAndRecurringPlansForAllTaskOwnersAndCanRepeat(): void
    {
        $this->deletedProject(2);
        $this->schedule(1, 2);
        $this->schedule(2, 2, 'collaborator');
        $this->schedule(3, 2, deletedAt: '2026-10-01 00:00:00');
        $this->schedule(4, 0);
        foreach ([1, 2, 3, 4] as $id) {
            $this->plan($id);
        }
        $this->unitConnection->table('task_scheduler')->insert(['external_id' => 'message_schedule_1', 'environment' => 'production']);
        $service = $this->cleanupService();
        $service->cleanupProjects([2], 'deleter');
        $service->cleanupProjects([2], 'deleter');
        self::assertSame(0, $this->unitConnection->table('magic_super_agent_message_scheduled')->where('project_id', 2)->whereNull('deleted_at')->count());
        foreach (['task_scheduler', 'task_scheduler_crontab'] as $table) {
            self::assertSame(['message_schedule_4'], $this->unitConnection->table($table)->where('environment', 'testing')->pluck('external_id')->all());
        }
        self::assertSame(1, $this->unitConnection->table('task_scheduler')->where('environment', 'production')->count());
        self::assertSame('deleter', $this->unitConnection->table('magic_super_agent_message_scheduled')->where('id', 2)->value('updated_uid'));
        self::assertSame('2026-10-01 00:00:00', $this->unitConnection->table('magic_super_agent_message_scheduled')->where('id', 3)->value('deleted_at'));
    }

    public function testCleanupRechecksProjectRestoreAndSkipsUnboundTasks(): void
    {
        $this->deletedProject(2);
        $this->schedule(1, 2);
        $this->schedule(2, 0);
        $this->plan(1, false);
        $service = $this->cleanupService();
        $candidates = $service->getCandidates(afterId: 0, limit: 1);
        self::assertCount(1, $candidates);
        $this->unitConnection->table('magic_super_agent_project')->where('id', 2)->update(['deleted_at' => null]);
        self::assertFalse($service->cleanupSchedule(1, 'deleter'));
        self::assertFalse($service->cleanupSchedule(2, 'deleter'));
        self::assertNull($this->unitConnection->table('magic_super_agent_message_scheduled')->where('id', 1)->value('deleted_at'));
        self::assertSame(1, $this->unitConnection->table('task_scheduler')->count());
    }

    public function testSchedulerFailureRollsBackPlansAndLeavesScheduleForRetry(): void
    {
        $this->deletedProject(2);
        $this->schedule(1, 2);
        $this->plan(1);
        $scheduler = $this->createMock(TaskSchedulerDomainService::class);
        $scheduler->method('clearByExternalId')->willReturnCallback(function (string $id): void {
            $this->unitConnection->table('task_scheduler')->where('external_id', $id)->delete();
            throw new RuntimeException('scheduler unavailable');
        });
        try {
            $this->cleanupService($scheduler)->cleanupSchedule(1, 'deleter');
            self::fail('Expected scheduler failure');
        } catch (RuntimeException $exception) {
            self::assertSame('scheduler unavailable', $exception->getMessage());
        }
        self::assertNull($this->unitConnection->table('magic_super_agent_message_scheduled')->where('id', 1)->value('deleted_at'));
        self::assertSame(1, $this->unitConnection->table('task_scheduler')->count());
        self::assertTrue($this->cleanupService()->cleanupSchedule(1, 'deleter'));
    }

    public function testSubscriberCoversSingleAndBatchEventsAndDoesNotSwallowFailure(): void
    {
        $this->deletedProject(2);
        $this->schedule(1, 2);
        $subscriber = $this->projectSubscriber();
        $project = (new ProjectEntity())->setId(2);
        $subscriber->process(new ProjectDeletedEvent($project, $this->authorization()));
        $subscriber->process(new ProjectsBatchDeletedEvent([$project], $this->authorization()));
        self::assertNotNull($this->unitConnection->table('magic_super_agent_message_scheduled')->where('id', 1)->value('deleted_at'));
        self::assertSame([ProjectDeletedEvent::class, ProjectsBatchDeletedEvent::class], $subscriber->listen());
        $annotation = (new ReflectionClass($subscriber))->getAttributes(AsyncListener::class)[0]->newInstance();
        self::assertSame('coroutine', $annotation->driver);
        self::assertTrue($annotation->waitForSync);
        self::assertCount(1, (new ReflectionClass($subscriber))->getAttributes(Listener::class));

        $scheduler = $this->createMock(TaskSchedulerDomainService::class);
        $scheduler->method('clearByExternalId')->willThrowException(new RuntimeException('retry me'));
        $this->expectExceptionMessage('retry me');
        $this->projectSubscriber($this->cleanupService($scheduler))->process(new ProjectDeletedEvent($project, $this->authorization()));
    }

    public function testCandidatesUseCursorAndOrganizationFilterWithoutHidingAlreadyDeletedTasks(): void
    {
        $this->deletedProject(2);
        $this->schedule(1, 2);
        $this->schedule(2, 2, deletedAt: '2026-10-01 00:00:00');
        $this->schedule(3, 99);
        $this->schedule(4, 2, org: 'other-org');
        $candidates = $this->cleanupService()->getCandidates(afterId: 1, limit: 2, organizationCode: 'caller-org');
        self::assertSame([2, 3], array_map(static fn ($entity) => $entity->getId(), $candidates));
    }

    public function testCommandDefaultsToPreviewAndRequiresExecuteForWrites(): void
    {
        $this->deletedProject(2);
        $this->schedule(1, 2);
        $this->plan(1);
        $command = new CleanupOrphanedMessageSchedulesCommand($this->cleanupService());
        (new ReflectionProperty($command, 'coroutine'))->setValue($command, false);
        $tester = new CommandTester($command);
        self::assertSame(0, $tester->execute(['--batch-size' => '1', '--organization-code' => 'caller-org']));
        self::assertStringContainsString('message_schedule_1', $tester->getDisplay());
        self::assertNull($this->unitConnection->table('magic_super_agent_message_scheduled')->where('id', 1)->value('deleted_at'));
        self::assertSame(1, $this->unitConnection->table('task_scheduler')->count());
        self::assertSame(0, $tester->execute(['--execute' => true, '--batch-size' => '1']));
        self::assertNotNull($this->unitConnection->table('magic_super_agent_message_scheduled')->where('id', 1)->value('deleted_at'));
        self::assertSame(0, $this->unitConnection->table('task_scheduler')->count());
    }

    public function testCommandRejectsInvalidOptionsAndReturnsFailureWhileContinuingOtherCandidates(): void
    {
        $this->deletedProject(2);
        $this->schedule(1, 2);
        $this->schedule(2, 2);
        $scheduler = $this->createMock(TaskSchedulerDomainService::class);
        $scheduler->method('clearByExternalId')->willReturnCallback(static function (string $externalId): void {
            if ($externalId === 'message_schedule_1') {
                throw new RuntimeException('failed task');
            }
        });
        $command = new CleanupOrphanedMessageSchedulesCommand($this->cleanupService($scheduler));
        (new ReflectionProperty($command, 'coroutine'))->setValue($command, false);
        $tester = new CommandTester($command);
        self::assertSame(2, $tester->execute(['--batch-size' => '0']));
        self::assertSame(2, $tester->execute(['--after-id' => '-1']));
        self::assertSame(2, $tester->execute(['--organization-code' => '']));
        self::assertSame(1, $tester->execute(['--execute' => true, '--batch-size' => '1']));
        self::assertStringContainsString('schedule_id=1', $tester->getDisplay());
        self::assertStringContainsString('candidates=2 cleaned=1 skipped=0 failed=1', $tester->getDisplay());
        self::assertNull($this->unitConnection->table('magic_super_agent_message_scheduled')->where('id', 1)->value('deleted_at'));
        self::assertNotNull($this->unitConnection->table('magic_super_agent_message_scheduled')->where('id', 2)->value('deleted_at'));
    }

    public function testWorkspacePublishesDeletedProjectsAfterCommit(): void
    {
        $project = (new ProjectEntity())->setId(2);
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects(self::once())->method('dispatch')->willReturnCallback(function (ProjectsBatchDeletedEvent $event): object {
            self::assertSame(0, $this->unitConnection->transactionLevel());
            self::assertSame([2], $event->getProjectIds());
            return $event;
        });
        self::assertTrue($this->workspaceService([$project], $dispatcher)->deleteWorkspace($this->requestContext(), 9));
    }

    public function testWorkspaceRollbackDoesNotPublishProjectDeletion(): void
    {
        $project = (new ProjectEntity())->setId(2);
        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        $dispatcher->expects(self::never())->method('dispatch');
        $this->expectExceptionMessage('recycle bin failed');
        $this->workspaceService([$project], $dispatcher, true)->deleteWorkspace($this->requestContext(), 9);
    }

    public function testPrewarmCompensationPublishesOnlySuccessfulDeletionAndPreservesFailureHandling(): void
    {
        $project = (new ProjectEntity())->setId(2)->setUserOrganizationCode('caller-org');
        foreach ([true, false] as $deleted) {
            $domain = $this->createMock(ProjectDomainService::class);
            $domain->method('deleteProject')->willReturn($deleted);
            $dispatcher = $this->createMock(EventDispatcherInterface::class);
            $dispatcher->expects($deleted ? self::once() : self::never())->method('dispatch')->willReturnCallback(static function (ProjectDeletedEvent $event): object {
                self::assertSame('caller-org', $event->getUserAuthorization()->getOrganizationCode());
                self::assertSame('caller', $event->getUserAuthorization()->getId());
                return $event;
            });
            $service = (new ReflectionClass(SandboxPreWarmAppService::class))->newInstanceWithoutConstructor();
            $this->inject($service, SandboxPreWarmAppService::class, ['projectDomainService' => $domain, 'eventDispatcher' => $dispatcher, 'logger' => new NullLogger()]);
            (new ReflectionMethod($service, 'cleanOrphanedHiddenProject'))->invoke($service, $project, 'caller');
        }
    }

    public function testWorkspaceDeletionScopeIncludesHiddenProjectsAndOtherOwnersButExcludesDeletedRows(): void
    {
        $this->unitConnection->table('magic_super_agent_project')->insert([
            ['id' => 1, 'workspace_id' => 9, 'user_id' => 'caller', 'is_hidden' => 0, 'deleted_at' => null],
            ['id' => 2, 'workspace_id' => 9, 'user_id' => 'other', 'is_hidden' => 1, 'deleted_at' => null],
            ['id' => 3, 'workspace_id' => 9, 'user_id' => 'caller', 'is_hidden' => 0, 'deleted_at' => '2026-10-01 00:00:00'],
            ['id' => 4, 'workspace_id' => 10, 'user_id' => 'caller', 'is_hidden' => 0, 'deleted_at' => null],
        ]);
        $repository = new ProjectRepository(new ProjectModel());
        $projects = $this->unitConnection->transaction(static fn () => $repository->findByWorkspaceIdForDeletion(9));
        self::assertSame([1, 2], array_map(static fn ($entity) => $entity->getId(), $projects));
    }

    public function testFrameworkRegistersTheCoroutineSubscriberOnceForEachDeletionEvent(): void
    {
        $snapshot = AnnotationCollector::serialize();
        try {
            AnnotationCollector::clear();
            $reader = new AnnotationReader();
            foreach ([ProjectDeletedSubscriber::class, MessageQueueCascadeDeleteSubscriber::class, SandboxKeepAliveCleanupSubscriber::class, CleanupOrphanedMessageSchedulesCommand::class] as $class) {
                foreach ($reader->getClassAnnotations(new ReflectionClass($class)) as $annotation) {
                    $annotation->collectClass($class);
                }
            }
            $subscriber = $this->projectSubscriber();
            $container = $this->createMock(ContainerInterface::class);
            $services = [
                ConfigInterface::class => $this->unitConfig,
                ProjectDeletedSubscriber::class => $subscriber,
                MessageQueueCascadeDeleteSubscriber::class => new MessageQueueCascadeDeleteSubscriber($this->createMock(MessageQueueDomainService::class), ApplicationContext::getContainer()->get(LoggerFactory::class), $subscriber),
                SandboxKeepAliveCleanupSubscriber::class => new SandboxKeepAliveCleanupSubscriber($this->createMock(SandboxKeepAliveDomainService::class), ApplicationContext::getContainer()->get(LoggerFactory::class)),
            ];
            $container->method('get')->willReturnCallback(static fn (string $id) => $services[$id]);
            $provider = (new ListenerProviderFactory())($container);
            $project = (new ProjectEntity())->setId(2);
            foreach ([new ProjectDeletedEvent($project, $this->authorization()), new ProjectsBatchDeletedEvent([$project], $this->authorization())] as $event) {
                self::assertCount(1, iterator_to_array($provider->getListenersForEvent($event)));
            }
            self::assertSame('coroutine', AnnotationCollector::getClassAnnotation(ProjectDeletedSubscriber::class, AsyncListener::class)->driver);
            self::assertInstanceOf(Command::class, AnnotationCollector::getClassAnnotation(CleanupOrphanedMessageSchedulesCommand::class, Command::class));
        } finally {
            AnnotationCollector::deserialize($snapshot);
        }
    }

    public function testUnifiedCleanupContinuesOtherStepsWhenSchedulerFails(): void
    {
        $this->deletedProject(2);
        $this->schedule(1, 2);
        $scheduler = $this->createMock(TaskSchedulerDomainService::class);
        $scheduler->method('clearByExternalId')->willThrowException(new RuntimeException('retry scheduler'));
        $queues = $this->createMock(MessageQueueDomainService::class);
        $queues->expects(self::once())->method('cascadeDeleteUnfinishedByProjectIds')->with([2], self::anything())->willReturn(3);
        $keepAlive = $this->createMock(SandboxKeepAliveDomainService::class);
        $keepAlive->expects(self::once())->method('disableByProjectIds')->with([2], self::anything())->willReturn(1);
        $subscriber = $this->projectSubscriber($this->cleanupService($scheduler), $queues, $keepAlive);
        $this->expectExceptionMessage('retry scheduler');
        $subscriber->process(new ProjectDeletedEvent((new ProjectEntity())->setId(2), $this->authorization()));
    }

    public function testUnifiedCleanupCoversBatchIdsAndSkipsRestoredProjects(): void
    {
        $deleted = (new ProjectEntity())->setId(2);
        $restored = (new ProjectEntity())->setId(3);
        $projects = $this->createMock(ProjectDomainService::class);
        $projects->method('getProjectsByIds')->with([2, 3])->willReturn([$restored]);
        $queues = $this->createMock(MessageQueueDomainService::class);
        $queues->expects(self::once())->method('cascadeDeleteUnfinishedByProjectIds')->with([2], self::anything())->willReturn(1);
        $keepAlive = $this->createMock(SandboxKeepAliveDomainService::class);
        $keepAlive->expects(self::once())->method('disableByProjectIds')->with([2], self::anything())->willReturn(1);
        $this->projectSubscriber(queues: $queues, keepAlive: $keepAlive, projects: $projects)->process(new ProjectsBatchDeletedEvent([$deleted, $restored], $this->authorization()));
    }

    public function testOriginalResourceSubscribersOnlyHandleTopicDeletion(): void
    {
        $loggerFactory = ApplicationContext::getContainer()->get(LoggerFactory::class);
        $queue = new MessageQueueCascadeDeleteSubscriber($this->createMock(MessageQueueDomainService::class), $loggerFactory, $this->projectSubscriber());
        $keepAlive = new SandboxKeepAliveCleanupSubscriber($this->createMock(SandboxKeepAliveDomainService::class), $loggerFactory);
        self::assertSame([TopicDeletedEvent::class], $queue->listen());
        self::assertSame([TopicDeletedEvent::class], $keepAlive->listen());
    }

    public function testPreviouslyStoredAsyncProjectEventsForwardToUnifiedCleanup(): void
    {
        $schedules = $this->createMock(MessageScheduleCleanupAppService::class);
        $schedules->expects(self::once())->method('cleanupProjects')->with([2], 'caller')->willReturn(1);
        $queues = $this->createMock(MessageQueueDomainService::class);
        $queues->expects(self::once())->method('cascadeDeleteUnfinishedByProjectIds')->with([2], self::anything())->willReturn(1);
        $keepAlive = $this->createMock(SandboxKeepAliveDomainService::class);
        $keepAlive->expects(self::once())->method('disableByProjectIds')->with([2], self::anything())->willReturn(1);
        $subscriber = $this->projectSubscriber($schedules, $queues, $keepAlive);
        $oldQueues = $this->createMock(MessageQueueDomainService::class);
        $oldQueues->expects(self::never())->method('cascadeDeleteUnfinishedByProjectIds');
        $legacy = new MessageQueueCascadeDeleteSubscriber($oldQueues, ApplicationContext::getContainer()->get(LoggerFactory::class), $subscriber);
        $legacy->process(new ProjectDeletedEvent((new ProjectEntity())->setId(2), $this->authorization()));
    }

    private function projectSubscriber(
        ?MessageScheduleCleanupAppService $schedules = null,
        ?MessageQueueDomainService $queues = null,
        ?SandboxKeepAliveDomainService $keepAlive = null,
        ?ProjectDomainService $projects = null,
    ): ProjectDeletedSubscriber {
        return new ProjectDeletedSubscriber(
            $schedules ?? $this->cleanupService(),
            $queues ?? $this->createMock(MessageQueueDomainService::class),
            $keepAlive ?? $this->createMock(SandboxKeepAliveDomainService::class),
            $projects ?? $this->createMock(ProjectDomainService::class),
            ApplicationContext::getContainer()->get(LoggerFactory::class),
        );
    }

    private function requestContext(): RequestContext
    {
        $request = $this->createMock(RequestContext::class);
        $request->method('getUserAuthorization')->willReturn($this->authorization());
        return $request;
    }

    private function workspaceService(array $projects, EventDispatcherInterface $dispatcher, bool $fail = false): WorkspaceAppService
    {
        $workspace = (new WorkspaceEntity())->setId(9)->setUserId('caller')->setName('workspace');
        $workspaces = $this->createMock(WorkspaceDomainService::class);
        $workspaces->method('getWorkspaceDetail')->willReturn($workspace);
        $domain = $this->createMock(ProjectDomainService::class);
        $domain->method('getProjectIdsByWorkspaceId')->willReturn([]);
        $domain->method('getProjectsForWorkspaceDeletion')->willReturn($projects);
        $domain->method('deleteProjectsByWorkspaceId')->willReturn(true);
        $recycleBin = $this->createMock(RecycleBinDomainService::class);
        if ($fail) {
            $recycleBin->method('recordDeletion')->willThrowException(new RuntimeException('recycle bin failed'));
        }
        $service = (new ReflectionClass(WorkspaceAppService::class))->newInstanceWithoutConstructor();
        $this->inject($service, WorkspaceAppService::class, [
            'workspaceDomainService' => $workspaces, 'projectDomainService' => $domain,
            'topicDomainService' => $this->createMock(TopicDomainService::class),
            'producer' => $this->createMock(Producer::class), 'logger' => new NullLogger(),
            'recycleBinDomainService' => $recycleBin, 'eventDispatcher' => $dispatcher,
        ]);
        return $service;
    }

    private function deletedProject(int $id): void
    {
        $this->unitConnection->table('magic_super_agent_project')->insert(['id' => $id, 'deleted_at' => '2026-10-01 00:00:00']);
    }

    private function plan(int $scheduleId, bool $recurring = true): void
    {
        foreach ($recurring ? ['task_scheduler', 'task_scheduler_crontab'] : ['task_scheduler'] as $table) {
            $this->unitConnection->table($table)->insert(['external_id' => 'message_schedule_' . $scheduleId, 'environment' => 'testing']);
        }
    }

    private function cleanupService(?TaskSchedulerDomainService $scheduler = null): MessageScheduleCleanupAppService
    {
        $loggerFactory = ApplicationContext::getContainer()->get(LoggerFactory::class);
        $domain = new MessageScheduleDomainService($this->repository, $this->createMock(MessageScheduleLogRepositoryInterface::class), $loggerFactory);
        $scheduler ??= new TaskSchedulerDomainService(new TaskSchedulerRepository(), new TaskSchedulerLogRepository(), new TaskSchedulerCrontabRepository(), $loggerFactory);
        return new MessageScheduleCleanupAppService($domain, $scheduler, $loggerFactory);
    }

    private function schedule(int $id, int $projectId, string $userId = 'caller', string $org = 'caller-org', ?string $deletedAt = null): void
    {
        $this->unitConnection->table('magic_super_agent_message_scheduled')->insert([
            'id' => $id, 'project_id' => $projectId, 'user_id' => $userId,
            'organization_code' => $org, 'task_name' => 'task-' . $id,
            'created_at' => '2026-10-01 00:00:00', 'updated_at' => '2026-10-01 00:00:00',
            'deleted_at' => $deletedAt,
        ]);
    }
}
