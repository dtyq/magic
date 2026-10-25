<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\DataIsolation;

use App\Application\SuperMagic\Task\Service\AgentAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Agent\Service\MagicClawRuntimePolicyDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\AgentContext;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\SandboxVersionDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use App\Infrastructure\SuperMagic\Task\Locker\SandboxLifecycleLock;
use Psr\Log\LoggerInterface;

/** 验证沙箱包装入口在实际初始化边界准备授权，外部依赖均为离线替身。
 * @internal
 */
final class SandboxInitializationAuthorizationTest extends ContextTestCase
{
    /** 隔离目标分支新增的生命周期锁，仅同步执行被保护的测试回调。 */
    protected function setUp(): void
    {
        parent::setUp();
        $lock = $this->createMock(SandboxLifecycleLock::class);
        $lock->method('run')->willReturnCallback(static fn (int $topicId, callable $operation): mixed => $operation(static function (): void {}));
        $this->services[SandboxLifecycleLock::class] = $lock;
        $policy = $this->createMock(MagicClawRuntimePolicyDomainService::class);
        $policy->method('manualStart')->willReturnCallback(static fn (int $topicId, callable $operation): mixed => $operation());
        $this->services[MagicClawRuntimePolicyDomainService::class] = $policy;
    }

    /** 启动路径在构建初始化上下文前解析授权。 */
    public function testStartPreparesAuthorizationAtInitialization(): void
    {
        $this->initialize('startSandbox');
    }

    /** 重启路径删除旧沙箱后仍能准备授权。 */
    public function testRestartPreparesAuthorizationAtInitialization(): void
    {
        $this->initialize('restartSandbox');
    }

    /** 需要升级时通过重启进入同一授权准备入口。 */
    public function testUpgradePreparesAuthorizationAtInitialization(): void
    {
        $this->initialize('upgradeSandbox');
    }

    /** 显式token在包装调用和初始化过程中保持不变。 */
    public function testInitializationPreservesManualToken(): void
    {
        $this->initialize('restartSandbox', true);
    }

    /** 镜像无需升级时既不注册也不解析用户授权。 */
    public function testCurrentVersionReturnsWithoutPreparingAuthorization(): void
    {
        $context = new DataIsolation('mock-org', 'mock-user');
        $agent = $this->createMock(AgentDomainService::class);
        $agent->expects(self::never())->method('getAuthorizationByUserId');
        $agent->expects(self::never())->method('ensureSandboxInitialized');
        $this->services[AgentDomainService::class] = $agent;
        $topic = $this->topic();
        $topics = $this->createMock(TopicDomainService::class);
        $topics->method('getTopicById')->willReturn($topic);
        $service = $this->service(AgentAppService::class, [
            'topicDomainService' => $topics,
            'sandboxVersionDomainService' => new SandboxAuthorizationVersionStub(false),
            'logger' => $this->createMock(LoggerInterface::class),
        ]);
        self::assertSame('mock-sandbox', $service->upgradeSandbox($context, 1));
        self::assertNull($context->getUserAuthorizationToken());
    }

    /** 经真实应用方法执行初始化，仅隔离领域服务和存储端口。 */
    private function initialize(string $operation, bool $manual = false): void
    {
        $context = new DataIsolation('mock-org', 'mock-user');
        if ($manual) {
            $context->setUserAuthorizationToken('mock-manual-token');
        }
        $expectedToken = $manual ? 'mock-manual-token' : 'mock-token';
        $agent = $this->createMock(AgentDomainService::class);
        $agent->expects($manual ? self::never() : self::once())->method('getAuthorizationByUserId')->with('mock-user')->willReturn('mock-token');
        $this->services[AgentDomainService::class] = $agent;
        $agent->expects($operation === 'startSandbox' ? self::never() : self::once())->method('stopSandbox')->with('mock-sandbox')->willReturn(GatewayResult::success());
        $agentContext = $this->createMock(AgentContext::class);
        $agent->expects(self::once())->method('buildInitAgentContext')->willReturnCallback(static function (DataIsolation $actual) use ($context, $expectedToken, $agentContext): AgentContext {
            self::assertSame($context, $actual);
            self::assertSame($expectedToken, $actual->getUserAuthorizationToken());
            self::assertSame($expectedToken, $actual->getUserAuthorizationToken());
            return $agentContext;
        });
        $agent->expects(self::once())->method('ensureSandboxInitialized')->with($context, $agentContext, self::anything())->willReturn('mock-new-sandbox');
        $topics = $this->createMock(TopicDomainService::class);
        $topics->method('getTopicById')->willReturn($this->topic());
        $topics->expects(self::once())->method('updateTopicSandboxId')->with($context, 1, 'mock-new-sandbox');
        $projects = $this->createMock(ProjectDomainService::class);
        $project = $this->createMock(ProjectEntity::class);
        $project->method('getId')->willReturn(1);
        $projects->method('getProjectNotUserId')->willReturn($project);
        $tasks = $this->createMock(TaskDomainService::class);
        $tasks->method('initDefaultTask')->willReturn($this->createMock(TaskEntity::class));
        $service = $this->service(AgentAppService::class, [
            'agentDomainService' => $agent,
            'topicDomainService' => $topics,
            'projectDomainService' => $projects,
            'taskDomainService' => $tasks,
            'taskFileDomainService' => $this->createMock(TaskFileDomainService::class),
            'sandboxVersionDomainService' => new SandboxAuthorizationVersionStub(true),
            'logger' => $this->createMock(LoggerInterface::class),
        ]);
        self::assertSame('mock-new-sandbox', $service->{$operation}($context, 1));
        self::assertSame($expectedToken, $context->getUserAuthorizationToken());
    }

    /** 构造无真实数据的话题身份。 */
    private function topic(): TopicEntity
    {
        $topic = $this->createMock(TopicEntity::class);
        $topic->method('getUserId')->willReturn('mock-user');
        $topic->method('getUserOrganizationCode')->willReturn('mock-org');
        $topic->method('getId')->willReturn(1);
        $topic->method('getProjectId')->willReturn(1);
        $topic->method('getSandboxId')->willReturn('mock-sandbox');
        return $topic;
    }
}

/** 用固定版本判断隔离镜像服务，不查询发布标准。 */
readonly class SandboxAuthorizationVersionStub extends SandboxVersionDomainService
{
    /** 指定本次操作是否需要更新。 */
    public function __construct(private bool $needsUpdate)
    {
    }

    /** 返回离线版本判断供真实应用方法执行分流。 */
    public function checkSandboxVersion(int $topicId, bool $useCache = true, string $effectiveSandboxId = ''): array
    {
        return ['current_version' => 'mock-current', 'latest_version' => 'mock-latest', 'needs_update' => $this->needsUpdate];
    }
}
