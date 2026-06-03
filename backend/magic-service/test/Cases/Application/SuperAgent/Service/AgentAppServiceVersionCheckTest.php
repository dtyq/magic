<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\AgentContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\CheckpointRollbackFilesChangedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\AgentDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\SandboxVersionDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Snowflake\IdGeneratorInterface;
use Hyperf\Snowflake\Meta;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;

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
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $taskDomainService = $this->createMock(TaskDomainService::class);
        $eventDispatcher = $this->createMock(EventDispatcherInterface::class);
        $cache = $this->createMock(CacheInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $logger = $this->createMock(LoggerInterface::class);

        $loggerFactory->method('get')->with('sandbox')->willReturn($logger);
        $sandboxVersionDomainService = new SandboxVersionDomainService(
            $topicDomainService,
            $agentDomainService,
            $cache,
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
            ->with('920', 'seq-100')
            ->willReturn($this->makeSuccessAgentResponse([
                ['file_id' => '1001', 'file_path' => 'docs/a.txt', 'operation' => 'update'],
                ['file_id' => '1002', 'file_path' => 'nested/b.md', 'operation' => 'delete'],
            ]));
        $topicDomainService->expects(self::once())
            ->method('rollbackMessagesStart')
            ->with('seq-100');
        $eventDispatcher->expects(self::once())
            ->method('dispatch')
            ->with($this->callback(function (object $event): bool {
                return $event instanceof CheckpointRollbackFilesChangedEvent
                    && $event->getProjectId() === 88
                    && $event->getTopicId() === 920
                    && $event->getUserId() === 'user-1'
                    && $event->getOrganizationCode() === 'DT001'
                    && $event->getFileChanges()[0]['file_id'] === '1001'
                    && $event->getFileChanges()[0]['operation'] === 'update'
                    && $event->getFileChanges()[0]['file_path'] === 'docs/a.txt'
                    && $event->getFileChanges()[1]['file_id'] === '1002'
                    && $event->getFileChanges()[1]['operation'] === 'delete'
                    && $event->getFileChanges()[1]['file_path'] === 'nested/b.md';
            }))
            ->willReturnArgument(0);

        $service = new AgentAppService(
            $loggerFactory,
            $agentDomainService,
            $projectDomainService,
            $topicDomainService,
            $taskDomainService,
            $sandboxVersionDomainService,
            $eventDispatcher
        );

        self::assertSame(
            'Sandbox and messages rollback started successfully',
            $service->rollbackCheckpointStart($dataIsolation, 920, 'seq-100')
        );
    }

    public function testRollbackCheckpointUndoDispatchesFileChangeEventForAffectedFilesOnly(): void
    {
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $taskDomainService = $this->createMock(TaskDomainService::class);
        $eventDispatcher = $this->createMock(EventDispatcherInterface::class);
        $cache = $this->createMock(CacheInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $logger = $this->createMock(LoggerInterface::class);

        $loggerFactory->method('get')->with('sandbox')->willReturn($logger);
        $sandboxVersionDomainService = new SandboxVersionDomainService(
            $topicDomainService,
            $agentDomainService,
            $cache,
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
            ->with('920')
            ->willReturn($this->makeSuccessAgentResponse([
                'affected_files' => [
                    ['file_id' => '1001', 'file_path' => 'docs/a.txt', 'operation' => 'update'],
                ],
            ]));
        $topicDomainService->expects(self::once())
            ->method('rollbackMessagesUndo')
            ->with(920, 'user-1');
        $eventDispatcher->expects(self::once())
            ->method('dispatch')
            ->with($this->callback(function (object $event): bool {
                return $event instanceof CheckpointRollbackFilesChangedEvent
                    && $event->getProjectId() === 88
                    && $event->getTopicId() === 920
                    && $event->getUserId() === 'user-1'
                    && $event->getOrganizationCode() === 'DT001'
                    && $event->getFileChanges()[0]['file_id'] === '1001'
                    && $event->getFileChanges()[0]['operation'] === 'update'
                    && $event->getFileChanges()[0]['file_path'] === 'docs/a.txt';
            }))
            ->willReturnArgument(0);

        $service = new AgentAppService(
            $loggerFactory,
            $agentDomainService,
            $projectDomainService,
            $topicDomainService,
            $taskDomainService,
            $sandboxVersionDomainService,
            $eventDispatcher
        );

        self::assertSame(
            'Sandbox and messages rollback undone successfully',
            $service->rollbackCheckpointUndo($dataIsolation, 920)
        );
    }

    public function testCheckSandboxVersionViaDomainService(): void
    {
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $topicDomainService = $this->createMock(TopicDomainService::class);
        $taskDomainService = $this->createMock(TaskDomainService::class);
        $eventDispatcher = $this->createMock(EventDispatcherInterface::class);
        $cache = $this->createMock(CacheInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $logger = $this->createMock(LoggerInterface::class);

        $loggerFactory->method('get')->with('sandbox')->willReturn($logger);

        $topic = (new TopicEntity())
            ->setId(101)
            ->setAgentImage('registry.example.com/agent:v1.0.0');

        $topicDomainService->expects($this->once())
            ->method('getTopicById')
            ->with(101)
            ->willReturn($topic);
        $cache->expects($this->once())
            ->method('get')
            ->with('super_magic:sandbox:latest_agent_image')
            ->willReturn('registry.example.com/agent:v2.0.0');
        $agentDomainService->expects($this->never())->method('getLatestAgentImage');

        $sandboxVersionDomainService = new SandboxVersionDomainService(
            $topicDomainService,
            $agentDomainService,
            $cache,
            $loggerFactory
        );

        $service = new AgentAppService(
            $loggerFactory,
            $agentDomainService,
            $projectDomainService,
            $topicDomainService,
            $taskDomainService,
            $sandboxVersionDomainService,
            $eventDispatcher
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
        $cache = $this->createMock(CacheInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $logger = $this->createMock(LoggerInterface::class);

        $loggerFactory->method('get')->with('sandbox')->willReturn($logger);

        $topicA = (new TopicEntity())
            ->setId(201)
            ->setAgentImage('registry.example.com/agent:v2.0.0');
        $topicB = (new TopicEntity())
            ->setId(202)
            ->setAgentImage('');

        $topicDomainService->expects($this->once())
            ->method('getTopicsByIds')
            ->with($this->callback(static function (array $ids): bool {
                sort($ids);
                return $ids === [201, 202];
            }))
            ->willReturn([$topicA, $topicB]);
        $cache->expects($this->once())
            ->method('get')
            ->with('super_magic:sandbox:latest_agent_image')
            ->willReturn(null);
        $agentDomainService->expects($this->once())
            ->method('getLatestAgentImage')
            ->willReturn('registry.example.com/agent:v2.0.0');
        $cache->expects($this->once())
            ->method('set')
            ->with('super_magic:sandbox:latest_agent_image', 'registry.example.com/agent:v2.0.0', 30);

        $sandboxVersionDomainService = new SandboxVersionDomainService(
            $topicDomainService,
            $agentDomainService,
            $cache,
            $loggerFactory
        );

        $service = new AgentAppService(
            $loggerFactory,
            $agentDomainService,
            $projectDomainService,
            $topicDomainService,
            $taskDomainService,
            $sandboxVersionDomainService,
            $eventDispatcher
        );

        $result = $service->checkSandboxVersionsByTopicIds([202, 201, 202, 0, -1]);

        $this->assertSame([
            201 => false,
            202 => true,
        ], $result);
    }

    private function makeTopic(): TopicEntity
    {
        return (new TopicEntity())
            ->setId(920)
            ->setProjectId(88)
            ->setUserId('user-1');
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
