<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperAgent\Service;

use App\Application\SuperMagic\Task\DTO\SandboxInfoDTO;
use App\Application\SuperMagic\Task\Service\AgentAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\SuperMagic\File\Event\CheckpointRollbackFilesChangedEvent;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Message\Event\CheckpointRollbackMessagesChangedEvent;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\AgentContext;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\SandboxVersionDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use App\Infrastructure\SuperMagic\Task\Locker\CheckpointRollbackLock;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Database\ConnectionResolver;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\MySqlConnection;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Snowflake\IdGeneratorInterface;
use Hyperf\Snowflake\Meta;
use PDO;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use ReflectionClass;
use ReflectionMethod;
use RuntimeException;

/**
 * @internal
 */
class AgentAppServiceVersionCheckTest extends TestCase
{
    private ?ContainerInterface $originalContainer = null;

    protected function setUp(): void
    {
        parent::setUp();

        if (ApplicationContext::hasContainer()) {
            $this->originalContainer = ApplicationContext::getContainer();
        }

        $container = new AgentAppServiceTestContainer();
        $container->set(ConfigInterface::class, new AgentAppServiceTestConfig());
        $container->set(IdGeneratorInterface::class, new AgentAppServiceTestIdGenerator());
        $container->set(PhpSerializerPacker::class, new PhpSerializerPacker());
        $container->set(ConnectionResolverInterface::class, new ConnectionResolver([
            'default' => new MySqlConnection(new PDO('sqlite::memory:'), 'memory'),
        ]));
        $container->set(Db::class, new Db($container));
        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        if ($this->originalContainer !== null) {
            ApplicationContext::setContainer($this->originalContainer);
        }

        parent::tearDown();
    }

    public function testRollbackCheckpointStartDispatchesFileChangeEventForAffectedFileIdsOnly(): void
    {
        $dispatchedEvents = [];
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $taskDomainService = $this->createMock(TaskDomainService::class);
        $eventDispatcher = $this->createMock(EventDispatcherInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $logger = $this->createMock(LoggerInterface::class);

        $loggerFactory->method('get')->with('sandbox')->willReturn($logger);
        $sandboxVersionDomainService = new SandboxVersionDomainService(
            $topicDomainService,
            $agentDomainService,
            $loggerFactory
        );

        $dataIsolation = new DataIsolation([
            'current_user_id' => 'user-1',
            'current_organization_code' => 'DT001',
        ]);
        $topic = $this->makeTopic();
        $project = $this->makeProject();
        $task = new TaskEntity();
        $agentContext = new AgentContext('920', 'auth-token', $project, $topic, $task);

        $topicDomainService->expects(self::exactly(2))
            ->method('getTopicById')
            ->with(920)
            ->willReturn($topic);
        $projectDomainService->expects(self::once())
            ->method('getProjectNotUserId')
            ->with(88)
            ->willReturn($project);
        $taskDomainService->expects(self::once())
            ->method('initDefaultTask')
            ->with($dataIsolation, $topic)
            ->willReturn($task);
        $agentDomainService->expects(self::once())
            ->method('buildInitAgentContext')
            ->willReturn($agentContext);
        $agentDomainService->expects(self::once())
            ->method('ensureSandboxInitialized')
            ->with($dataIsolation, $agentContext)
            ->willReturn('920');
        $agentDomainService->expects(self::once())
            ->method('rollbackCheckpointStart')
            ->with($dataIsolation, '920', 'seq-100')
            ->willReturn($this->makeSuccessAgentResponse([
                ['file_id' => '1001', 'file_path' => 'docs/a.txt', 'operation' => 'update'],
                ['file_id' => '1002', 'file_path' => 'nested/b.md', 'operation' => 'delete'],
            ]));
        $topicDomainService->expects(self::once())
            ->method('rollbackMessagesStart')
            ->with('seq-100')
            ->willReturn(['seq-100', 'seq-101']);
        $eventDispatcher->expects(self::exactly(2))
            ->method('dispatch')
            ->willReturnCallback(function (object $event) use (&$dispatchedEvents): object {
                $dispatchedEvents[] = $event;
                return $event;
            });

        $service = new AgentAppService(
            $loggerFactory,
            $agentDomainService,
            $projectDomainService,
            $topicDomainService,
            $this->createMock(TaskFileDomainService::class),
            $taskDomainService,
            $sandboxVersionDomainService,
            (new ReflectionClass(MagicUserSettingDomainService::class))->newInstanceWithoutConstructor(),
            $this->createMock(MagicUserDomainService::class),
            $eventDispatcher,
            $this->makeRollbackLock()
        );

        self::assertSame(
            'Sandbox and messages rollback started successfully',
            $service->rollbackCheckpointStart($dataIsolation, 920, 'seq-100')
        );

        $messageEvent = $this->findMessageRollbackEvent($dispatchedEvents);
        self::assertSame('start', $messageEvent->getAction());
        self::assertSame(['seq-100', 'seq-101'], $messageEvent->getAffectedSeqIds());
        self::assertSame('seq-100', $messageEvent->getTargetSeqId());
        $this->assertRollbackEventTopicContext($messageEvent);
        self::assertCount(1, array_filter($dispatchedEvents, static fn (object $event): bool => $event instanceof CheckpointRollbackFilesChangedEvent));
    }

    public function testRollbackCheckpointUndoDispatchesFileChangeEventForAffectedFilesOnly(): void
    {
        $dispatchedEvents = [];
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $taskDomainService = $this->createMock(TaskDomainService::class);
        $eventDispatcher = $this->createMock(EventDispatcherInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $logger = $this->createMock(LoggerInterface::class);

        $loggerFactory->method('get')->with('sandbox')->willReturn($logger);
        $sandboxVersionDomainService = new SandboxVersionDomainService(
            $topicDomainService,
            $agentDomainService,
            $loggerFactory
        );

        $dataIsolation = new DataIsolation([
            'current_user_id' => 'user-1',
            'current_organization_code' => 'DT001',
        ]);
        $topic = $this->makeTopic();
        $project = $this->makeProject();
        $task = new TaskEntity();
        $agentContext = new AgentContext('920', 'auth-token', $project, $topic, $task);

        $topicDomainService->expects(self::exactly(2))
            ->method('getTopicById')
            ->with(920)
            ->willReturn($topic);
        $projectDomainService->expects(self::once())
            ->method('getProjectNotUserId')
            ->with(88)
            ->willReturn($project);
        $taskDomainService->expects(self::once())
            ->method('initDefaultTask')
            ->with($dataIsolation, $topic)
            ->willReturn($task);
        $agentDomainService->expects(self::once())
            ->method('buildInitAgentContext')
            ->willReturn($agentContext);
        $agentDomainService->expects(self::once())
            ->method('ensureSandboxInitialized')
            ->with($dataIsolation, $agentContext)
            ->willReturn('920');
        $agentDomainService->expects(self::once())
            ->method('rollbackCheckpointUndo')
            ->with($dataIsolation, '920')
            ->willReturn($this->makeSuccessAgentResponse([
                'affected_files' => [
                    ['file_id' => '1001', 'file_path' => 'docs/a.txt', 'operation' => 'update'],
                ],
            ]));
        $topicDomainService->expects(self::once())
            ->method('rollbackMessagesUndo')
            ->with(920, 'user-1')
            ->willReturn(['seq-100', 'seq-101']);
        $eventDispatcher->expects(self::exactly(2))
            ->method('dispatch')
            ->willReturnCallback(function (object $event) use (&$dispatchedEvents): object {
                $dispatchedEvents[] = $event;
                return $event;
            });

        $service = new AgentAppService(
            $loggerFactory,
            $agentDomainService,
            $projectDomainService,
            $topicDomainService,
            $this->createMock(TaskFileDomainService::class),
            $taskDomainService,
            $sandboxVersionDomainService,
            (new ReflectionClass(MagicUserSettingDomainService::class))->newInstanceWithoutConstructor(),
            $this->createMock(MagicUserDomainService::class),
            $eventDispatcher,
            $this->makeRollbackLock()
        );

        self::assertSame(
            'Sandbox and messages rollback undone successfully',
            $service->rollbackCheckpointUndo($dataIsolation, 920)
        );

        $messageEvent = $this->findMessageRollbackEvent($dispatchedEvents);
        self::assertSame('undo', $messageEvent->getAction());
        self::assertSame(['seq-100', 'seq-101'], $messageEvent->getAffectedSeqIds());
        self::assertNull($messageEvent->getTargetSeqId());
        $this->assertRollbackEventTopicContext($messageEvent);
        self::assertCount(1, array_filter($dispatchedEvents, static fn (object $event): bool => $event instanceof CheckpointRollbackFilesChangedEvent));
    }

    public function testRollbackCheckpointCommitDispatchesMessageRollbackEvent(): void
    {
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $taskDomainService = $this->createMock(TaskDomainService::class);
        $eventDispatcher = $this->createMock(EventDispatcherInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->with('sandbox')->willReturn($this->createMock(LoggerInterface::class));
        $sandboxVersionDomainService = new SandboxVersionDomainService($topicDomainService, $agentDomainService, $loggerFactory);
        $dataIsolation = new DataIsolation([
            'current_user_id' => 'user-1',
            'current_organization_code' => 'DT001',
        ]);
        $topic = $this->makeTopic();
        $project = $this->makeProject();
        $task = new TaskEntity();

        $topicDomainService->expects(self::exactly(2))->method('getTopicById')->with(920)->willReturn($topic);
        $projectDomainService->method('getProjectNotUserId')->with(88)->willReturn($project);
        $taskDomainService->method('initDefaultTask')->with($dataIsolation, $topic)->willReturn($task);
        $agentDomainService->method('buildInitAgentContext')->willReturn(new AgentContext('920', 'auth-token', $project, $topic, $task));
        $agentDomainService->method('ensureSandboxInitialized')->with($dataIsolation, self::isInstanceOf(AgentContext::class))->willReturn('920');
        $agentDomainService->method('rollbackCheckpointCommit')->with($dataIsolation, '920')->willReturn($this->makeSuccessAgentResponse());
        $topicDomainService->expects(self::once())->method('rollbackMessagesCommit')->with(920, 'user-1')->willReturn(['seq-100', 'seq-101']);
        $eventDispatcher->expects(self::once())
            ->method('dispatch')
            ->with($this->callback(function (object $event): bool {
                return $event instanceof CheckpointRollbackMessagesChangedEvent
                    && $event->getAction() === 'commit'
                    && $event->getAffectedSeqIds() === ['seq-100', 'seq-101']
                    && $event->getTargetSeqId() === null;
            }))
            ->willReturnArgument(0);

        $service = new AgentAppService(
            $loggerFactory,
            $agentDomainService,
            $projectDomainService,
            $topicDomainService,
            $this->createMock(TaskFileDomainService::class),
            $taskDomainService,
            $sandboxVersionDomainService,
            (new ReflectionClass(MagicUserSettingDomainService::class))->newInstanceWithoutConstructor(),
            $this->createMock(MagicUserDomainService::class),
            $eventDispatcher,
            $this->makeRollbackLock()
        );

        self::assertSame('Sandbox and messages rollback committed successfully', $service->rollbackCheckpointCommit($dataIsolation, 920));
    }

    public function testDirectRollbackDispatchesMessageRollbackEvent(): void
    {
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $taskDomainService = $this->createMock(TaskDomainService::class);
        $eventDispatcher = $this->createMock(EventDispatcherInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->with('sandbox')->willReturn($this->createMock(LoggerInterface::class));
        $sandboxVersionDomainService = new SandboxVersionDomainService($topicDomainService, $agentDomainService, $loggerFactory);
        $dataIsolation = new DataIsolation([
            'current_user_id' => 'user-1',
            'current_organization_code' => 'DT001',
        ]);

        $topicDomainService->expects(self::once())->method('getTopicById')->with(920)->willReturn($this->makeTopic());
        $agentDomainService->expects(self::once())
            ->method('rollbackCheckpoint')
            ->with($dataIsolation, '920', 'seq-100')
            ->willReturn($this->makeSuccessAgentResponse());
        $topicDomainService->expects(self::once())->method('rollbackMessages')->with('seq-100')->willReturn(['seq-100', 'seq-101']);
        $eventDispatcher->expects(self::once())
            ->method('dispatch')
            ->with($this->callback(function (object $event): bool {
                return $event instanceof CheckpointRollbackMessagesChangedEvent
                    && $event->getAction() === 'rollback'
                    && $event->getAffectedSeqIds() === ['seq-100', 'seq-101']
                    && $event->getTargetSeqId() === 'seq-100';
            }))
            ->willReturnArgument(0);

        $service = new AgentAppService(
            $loggerFactory,
            $agentDomainService,
            $projectDomainService,
            $topicDomainService,
            $this->createMock(TaskFileDomainService::class),
            $taskDomainService,
            $sandboxVersionDomainService,
            (new ReflectionClass(MagicUserSettingDomainService::class))->newInstanceWithoutConstructor(),
            $this->createMock(MagicUserDomainService::class),
            $eventDispatcher,
            $this->makeRollbackLock()
        );

        self::assertTrue($service->rollbackCheckpoint($dataIsolation, 920, '920', 'seq-100')->isSuccess());
    }

    public function testRollbackCheckpointUndoDoesNotDispatchWhenNoMessagesOrFilesAreAffected(): void
    {
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $taskDomainService = $this->createMock(TaskDomainService::class);
        $eventDispatcher = $this->createMock(EventDispatcherInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->with('sandbox')->willReturn($this->createMock(LoggerInterface::class));
        $sandboxVersionDomainService = new SandboxVersionDomainService($topicDomainService, $agentDomainService, $loggerFactory);
        $dataIsolation = new DataIsolation([
            'current_user_id' => 'user-1',
            'current_organization_code' => 'DT001',
        ]);
        $topic = $this->makeTopic();
        $project = $this->makeProject();
        $task = new TaskEntity();

        $topicDomainService->expects(self::exactly(2))->method('getTopicById')->with(920)->willReturn($topic);
        $projectDomainService->method('getProjectNotUserId')->willReturn($project);
        $taskDomainService->method('initDefaultTask')->willReturn($task);
        $agentDomainService->method('buildInitAgentContext')->willReturn(new AgentContext('920', 'auth-token', $project, $topic, $task));
        $agentDomainService->method('ensureSandboxInitialized')->willReturn('920');
        $agentDomainService->method('rollbackCheckpointUndo')->willReturn($this->makeSuccessAgentResponse());
        $topicDomainService->method('rollbackMessagesUndo')->willReturn([]);
        $eventDispatcher->expects(self::never())->method('dispatch');

        $service = new AgentAppService(
            $loggerFactory,
            $agentDomainService,
            $projectDomainService,
            $topicDomainService,
            $this->createMock(TaskFileDomainService::class),
            $taskDomainService,
            $sandboxVersionDomainService,
            (new ReflectionClass(MagicUserSettingDomainService::class))->newInstanceWithoutConstructor(),
            $this->createMock(MagicUserDomainService::class),
            $eventDispatcher,
            $this->makeRollbackLock()
        );

        self::assertSame('Sandbox and messages rollback undone successfully', $service->rollbackCheckpointUndo($dataIsolation, 920));
    }

    public function testCheckSandboxVersionViaDomainService(): void
    {
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $taskDomainService = $this->createMock(TaskDomainService::class);
        $eventDispatcher = $this->createMock(EventDispatcherInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $logger = $this->createMock(LoggerInterface::class);

        $loggerFactory->method('get')->with('sandbox')->willReturn($logger);

        $topic = (new TopicEntity())
            ->setId(101)
            ->setSandboxId('101')
            ->setSandboxImages([
                'agent_image' => 'registry.example.com/agent:v1.0.0',
                'agfs_image' => 'registry.example.com/agfs:v1.0.0',
            ]);

        $topicDomainService->expects($this->once())
            ->method('getTopicById')
            ->with(101)
            ->willReturn($topic);
        $agentDomainService->expects($this->once())
            ->method('getLatestImages')
            ->willReturn([
                'agent_image' => 'registry.example.com/agent:v2.0.0',
                'agfs_image' => 'registry.example.com/agfs:v1.0.0',
            ]);

        $sandboxVersionDomainService = new SandboxVersionDomainService(
            $topicDomainService,
            $agentDomainService,
            $loggerFactory
        );

        $service = new AgentAppService(
            $loggerFactory,
            $agentDomainService,
            $projectDomainService,
            $topicDomainService,
            $this->createMock(TaskFileDomainService::class),
            $taskDomainService,
            $sandboxVersionDomainService,
            (new ReflectionClass(MagicUserSettingDomainService::class))->newInstanceWithoutConstructor(),
            $this->createMock(MagicUserDomainService::class),
            $eventDispatcher,
            $this->makeRollbackLock()
        );

        $result = $service->checkSandboxVersion(101);

        $this->assertSame('v1.0.0', $result['current_version']);
        $this->assertSame('v2.0.0', $result['latest_version']);
        $this->assertTrue($result['needs_update']);
    }

    public function testCheckSandboxVersionsByTopicIdsViaDomainService(): void
    {
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $taskDomainService = $this->createMock(TaskDomainService::class);
        $eventDispatcher = $this->createMock(EventDispatcherInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $logger = $this->createMock(LoggerInterface::class);

        $loggerFactory->method('get')->with('sandbox')->willReturn($logger);

        $topicA = (new TopicEntity())
            ->setId(201)
            ->setSandboxId('201')
            ->setSandboxImages([
                'agent_image' => 'registry.example.com/agent:v2.0.0',
                'agfs_image' => 'registry.example.com/agfs:v1.0.0',
            ]);
        $topicB = (new TopicEntity())
            ->setId(202)
            ->setSandboxId('202')
            ->setAgentImage('registry.example.com/agent:v1.0.0');

        $topicDomainService->expects($this->once())
            ->method('getTopicsByIds')
            ->with($this->callback(static function (array $ids): bool {
                sort($ids);
                return $ids === [201, 202];
            }))
            ->willReturn([$topicA, $topicB]);
        $agentDomainService->expects($this->once())
            ->method('getLatestImages')
            ->willReturn([
                'agent_image' => 'registry.example.com/agent:v2.0.0',
                'agfs_image' => 'registry.example.com/agfs:v1.0.0',
            ]);

        $sandboxVersionDomainService = new SandboxVersionDomainService(
            $topicDomainService,
            $agentDomainService,
            $loggerFactory
        );

        $service = new AgentAppService(
            $loggerFactory,
            $agentDomainService,
            $projectDomainService,
            $topicDomainService,
            $this->createMock(TaskFileDomainService::class),
            $taskDomainService,
            $sandboxVersionDomainService,
            (new ReflectionClass(MagicUserSettingDomainService::class))->newInstanceWithoutConstructor(),
            $this->createMock(MagicUserDomainService::class),
            $eventDispatcher,
            $this->makeRollbackLock()
        );

        $result = $service->checkSandboxVersionsByTopicIds([202, 201, 202, 0, -1]);

        $this->assertSame([
            201 => false,
            202 => true,
        ], $result);
    }

    public function testSandboxInfoPreservesUnknownVersion(): void
    {
        $info = new SandboxInfoDTO('sandbox', 'Running', '', '', null);

        self::assertNull($info->getNeedsUpdate());
        self::assertNull($info->toArray()['needs_update']);
    }

    public function testLostRollbackLockBeforeCommitRollsBackDatabaseMutation(): void
    {
        $connection = ApplicationContext::getContainer()->get(ConnectionResolverInterface::class)->connection();
        $connection->getPdo()->exec('CREATE TABLE rollback_guard_probe (id INTEGER PRIMARY KEY)');
        $service = (new ReflectionClass(AgentAppService::class))->newInstanceWithoutConstructor();
        $checks = 0;
        $guard = static function () use (&$checks): void {
            if (++$checks === 2) {
                throw new RuntimeException('lease lost before commit');
            }
        };
        try {
            (new ReflectionMethod($service, 'runRollbackMessageMutation'))->invoke(
                $service,
                static function () use ($connection): array {
                    $connection->table('rollback_guard_probe')->insert(['id' => 1]);
                    return ['seq-1'];
                },
                $guard
            );
            self::fail('Expected ownership failure before commit');
        } catch (RuntimeException $exception) {
            self::assertSame('lease lost before commit', $exception->getMessage());
        }
        self::assertSame(0, $connection->table('rollback_guard_probe')->count());
        self::assertSame(0, $connection->transactionLevel());
    }

    private function makeRollbackLock(): CheckpointRollbackLock
    {
        $lock = $this->createMock(CheckpointRollbackLock::class);
        $lock->method('run')->willReturnCallback(static function (int $topicId, callable $operation): mixed {
            self::assertSame(920, $topicId);
            return $operation(static function (): void {});
        });
        return $lock;
    }

    private function makeTopic(): TopicEntity
    {
        return (new TopicEntity())
            ->setId(920)
            ->setProjectId(88)
            ->setUserId('user-1')
            ->setUserOrganizationCode('DT001')
            ->setChatTopicId('chat-topic-920')
            ->setChatConversationId('conversation-920');
    }

    /**
     * @param object[] $events
     */
    private function findMessageRollbackEvent(array $events): CheckpointRollbackMessagesChangedEvent
    {
        $matches = array_values(array_filter(
            $events,
            static fn (object $event): bool => $event instanceof CheckpointRollbackMessagesChangedEvent
        ));
        self::assertCount(1, $matches);
        return $matches[0];
    }

    private function assertRollbackEventTopicContext(CheckpointRollbackMessagesChangedEvent $event): void
    {
        self::assertSame(920, $event->getTopicId());
        self::assertSame('chat-topic-920', $event->getChatTopicId());
        self::assertSame(88, $event->getProjectId());
        self::assertSame('user-1', $event->getUserId());
        self::assertSame('DT001', $event->getOrganizationCode());
        self::assertSame('conversation-920', $event->getConversationId());
    }

    private function makeProject(): ProjectEntity
    {
        return (new ProjectEntity())
            ->setId(88)
            ->setUserId('user-1')
            ->setUserOrganizationCode('DT001');
    }

    private function makeSuccessAgentResponse(array $data = []): AgentResponse
    {
        return AgentResponse::fromApiResponse([
            'code' => ResponseCode::SUCCESS,
            'message' => 'success',
            'data' => $data,
        ]);
    }
}

final class AgentAppServiceTestContainer implements ContainerInterface
{
    /**
     * @var array<string, mixed>
     */
    private array $entries = [];

    public function get(string $id): mixed
    {
        return $this->entries[$id];
    }

    public function has(string $id): bool
    {
        return array_key_exists($id, $this->entries);
    }

    public function set(string $id, mixed $entry): void
    {
        $this->entries[$id] = $entry;
    }
}

final class AgentAppServiceTestConfig implements ConfigInterface
{
    /**
     * @var array<string, mixed>
     */
    private array $values = [
        'app_env' => 'testing',
    ];

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->values[$key] ?? $default;
    }

    public function has(string $keys): bool
    {
        return array_key_exists($keys, $this->values);
    }

    public function set(string $key, mixed $value): void
    {
        $this->values[$key] = $value;
    }
}

final class AgentAppServiceTestIdGenerator implements IdGeneratorInterface
{
    private int $nextId = 1000;

    public function generate(?Meta $meta = null): int
    {
        return ++$this->nextId;
    }

    public function degenerate(int $id): Meta
    {
        return new Meta(0, 0, 0, 0);
    }
}
