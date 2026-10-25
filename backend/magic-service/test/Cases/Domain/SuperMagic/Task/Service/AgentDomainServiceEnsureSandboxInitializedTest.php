<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Task\Service;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\Agent\Entity\MagicClawEntity;
use App\Domain\SuperMagic\Agent\Repository\Facade\MagicClawRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Persistence\MagicClawReconciliationRepository;
use App\Domain\SuperMagic\Agent\Service\MagicClawRuntimePolicyDomainService;
use App\Domain\SuperMagic\Common\Entity\ValueObject\DynamicConfig\DynamicConfigManager;
use App\Domain\SuperMagic\Common\Entity\ValueObject\SuperMagicProductContext;
use App\Domain\SuperMagic\Message\Repository\Facade\TaskMessageRepositoryInterface;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\AgentContext;
use App\Domain\SuperMagic\Task\Entity\ValueObject\AgentInitContext;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRootFileIds;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\CrossProjectMentionPathTranslator;
use App\Domain\SuperMagic\Task\Service\WarmPoolSandboxDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Repository\Facade\TopicRepositoryInterface;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceRepositoryInterface;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Constant\WorkspaceStatus;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\SandboxAgentInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\SandboxStatusResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use App\Infrastructure\SuperMagic\Task\Locker\SandboxLifecycleLock;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;

/**
 * ensureSandboxInitialized 去重保护测试.
 *
 * 重复沙箱的两个来源：
 * 1. 拿锁前解析的 sandbox_id 在等锁期间被其他流程（升级/重启、预热池 mount）
 *    换绑，拿锁后必须重读，否则会把新绑定的沙箱再次替换，泄漏旧 pod；
 * 2. 换绑成功后旧沙箱没有被停止，带着同样的 topic-id 标签泄漏。
 * 显式传入 sandbox_id 的重连场景保持原语义，不重读。
 *
 * @internal
 */
class AgentDomainServiceEnsureSandboxInitializedTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(
            static fn (string $key, mixed $default = null): mixed => str_starts_with($key, 'super-magic.warm_pool.') ? false : 'test'
        );

        $container = new EnsureSandboxFakeContainer();
        $container->services[ConfigInterface::class] = $config;
        $container->services[MagicClawRuntimePolicyDomainService::class] = $this->createMock(MagicClawRuntimePolicyDomainService::class);
        $lifecycle = $this->createMock(SandboxLifecycleLock::class);
        $lifecycle->method('run')->willReturnCallback(static fn (int $id, callable $operation) => $operation(static function (): void {}));
        $container->services[SandboxLifecycleLock::class] = $lifecycle;
        $container->services[MagicClawReconciliationRepository::class] = $this->createMock(MagicClawReconciliationRepository::class);
        ApplicationContext::setContainer($container);
    }

    /**
     * 拿锁期间绑定被并发换绑：拿锁后必须以 DB 里的最新 sandbox_id 为准，
     * 直接复用已就绪的新沙箱，而不是把新沙箱再次替换掉.
     */
    public function testReReadsFreshBindingAfterLockAndReusesReadySandbox(): void
    {
        $topicId = 945988521691942916;
        $staleId = '953340869490270209';
        $freshId = '945988521691942916';

        $topicRepository = $this->createMock(TopicRepositoryInterface::class);
        $topicRepository->expects($this->once())->method('getTopicById')->with($topicId)
            ->willReturn($this->buildTopic($topicId, $freshId));
        $topicRepository->expects($this->never())->method('updateTopicByCondition');

        $agent = $this->createMock(SandboxAgentInterface::class);
        // 拿锁前的旧 id 不应被探测；只允许用重读后的新 id 探测一次且已就绪。
        $agent->expects($this->once())->method('getWorkspaceStatus')->with(
            $this->anything(),
            $this->identicalTo($freshId)
        )->willReturn($this->readyResponse());
        $agent->expects($this->never())->method('initAgent');

        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->expects($this->never())->method('createSandbox');
        $gateway->expects($this->never())->method('deleteSandbox');

        $service = $this->buildService($agent, $gateway, $topicRepository);

        $agentContext = $this->buildAgentContext($this->buildTopic($topicId, $staleId), '');

        $result = $service->ensureSandboxInitialized($this->buildDataIsolation(), $agentContext);

        $this->assertSame($freshId, $result);
    }

    /**
     * 换绑（冷创建）成功后必须停掉被替换的旧沙箱，避免旧 pod 泄漏成重复沙箱.
     */
    public function testColdCreateStopsReplacedSandbox(): void
    {
        $topicId = 934139051737997315;
        $staleId = '940990111199096833';
        $createdId = '934139051737997315';
        $images = SandboxImageTarget::withSpecifiedImages(null, 'agent:rollback', 'agfs:rollback');

        $topicRepository = $this->createMock(TopicRepositoryInterface::class);
        $topicRepository->method('getTopicById')->willReturn($this->buildTopic($topicId, $staleId));
        $topicRepository->expects($this->once())->method('updateTopicByCondition')->with(
            ['id' => $topicId],
            $this->callback(static fn (array $data): bool => $data['sandbox_id'] === $createdId
                && $data['sandbox_images'] === ['agent_image' => 'agent:rollback', 'agfs_image' => 'agfs:rollback'])
        );

        $agent = $this->createMock(SandboxAgentInterface::class);
        $agent->expects($this->exactly(2))->method('getWorkspaceStatus')->willReturnOnConsecutiveCalls(
            $this->notFoundResponse(),
            $this->readyResponse()
        );
        $agent->expects($this->once())->method('initAgent')->willReturn($this->readyResponse());

        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->expects($this->once())->method('createSandbox')->willReturnCallback(
            static function (...$arguments) use ($images, $createdId): GatewayResult {
                // Both lifecycle closures must preserve the rollout's explicit image target.
                self::assertSame($images, $arguments[8]);
                return new GatewayResult(ResponseCode::SUCCESS, 'ok', [
                    'sandbox_id' => $createdId, 'agent_image' => 'agent:rollback', 'agfs_image' => 'agfs:rollback',
                ]);
            }
        );
        // 关键断言：被替换的旧沙箱被停止。
        $gateway->expects($this->once())->method('deleteSandbox')->with($staleId)
            ->willReturn(new GatewayResult(ResponseCode::SUCCESS, 'ok'));

        $service = $this->buildService($agent, $gateway, $topicRepository);

        $agentContext = $this->buildAgentContext($this->buildTopic($topicId, $staleId), '');

        $result = $service->ensureSandboxInitialized($this->buildDataIsolation(), $agentContext, images: $images);

        $this->assertSame($createdId, $result);
    }

    /**
     * 调用方显式指定 sandbox_id（重连固定 pod）时保持原语义：不重读绑定.
     */
    public function testPinnedSandboxIdSkipsReread(): void
    {
        $topicId = 906155140512055299;
        $pinnedId = '954802104582074369';

        $topicRepository = $this->createMock(TopicRepositoryInterface::class);
        $topicRepository->expects($this->never())->method('getTopicById');

        $agent = $this->createMock(SandboxAgentInterface::class);
        $agent->expects($this->once())->method('getWorkspaceStatus')->with(
            $this->anything(),
            $this->identicalTo($pinnedId)
        )->willReturn($this->readyResponse());
        $agent->expects($this->never())->method('initAgent');

        $service = $this->buildService($agent, $this->createMock(SandboxGatewayInterface::class), $topicRepository);

        $agentContext = $this->buildAgentContext($this->buildTopic($topicId, '954802201063546881'), $pinnedId);

        $result = $service->ensureSandboxInitialized($this->buildDataIsolation(), $agentContext);

        $this->assertSame($pinnedId, $result);
    }

    /**
     * 旧沙箱停止失败（例如已被其他流程删除）不影响新沙箱初始化.
     */
    public function testColdCreateToleratesStopFailureOfReplacedSandbox(): void
    {
        $topicId = 944591153416183811;
        $staleId = '955787852072312833';
        $createdId = '944591153416183811';

        $topicRepository = $this->createMock(TopicRepositoryInterface::class);
        $topicRepository->method('getTopicById')->willReturn($this->buildTopic($topicId, $staleId));
        $topicRepository->expects($this->once())->method('updateTopicByCondition');

        $agent = $this->createMock(SandboxAgentInterface::class);
        $agent->expects($this->exactly(2))->method('getWorkspaceStatus')->willReturnOnConsecutiveCalls(
            $this->notFoundResponse(),
            $this->readyResponse()
        );
        $agent->expects($this->once())->method('initAgent')->willReturn($this->readyResponse());

        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->expects($this->once())->method('createSandbox')->willReturn(
            new GatewayResult(ResponseCode::SUCCESS, 'ok', ['sandbox_id' => $createdId])
        );
        $gateway->expects($this->once())->method('deleteSandbox')->with($staleId)->willReturn(
            new GatewayResult(ResponseCode::ERROR, 'already deleted')
        );

        $service = $this->buildService($agent, $gateway, $topicRepository);

        $agentContext = $this->buildAgentContext($this->buildTopic($topicId, $staleId), '');

        $result = $service->ensureSandboxInitialized($this->buildDataIsolation(), $agentContext);

        $this->assertSame($createdId, $result);
    }

    /**
     * 镜像发布后的重建要走温池：旧 pod 删掉后，探测拿到 NOT_FOUND 会把残留的
     * sandbox_id 抹空，「调用方指定了 sandbox_id」的守卫随之放行，于是直接领一个
     * 现成的温池 pod 挂载，而不是从零冷启动。
     *
     * 这条用例钉住的是"能走温池"，也就是发布重启不会退化成慢速冷启动。
     */
    public function testRebuildClaimsAWarmPoolSandboxInsteadOfColdStarting(): void
    {
        $warmSandboxId = 'warm-980001';

        $warmPool = $this->createMock(WarmPoolSandboxDomainService::class);
        $warmPool->expects($this->once())
            ->method('tryAcquireAndMount')
            ->willReturn($warmSandboxId);

        $gateway = $this->createMock(SandboxGatewayInterface::class);
        // 温池命中就不应该再冷创建 pod——否则等于既领了温池又白起一个。
        $gateway->expects($this->never())->method('createSandbox');

        $this->runRebuild($warmPool, $warmSandboxId, $gateway);
    }

    /**
     * 温池空仓（补货没跟上）时退回冷创建，保证重启不会因为温池没货而失败。
     */
    public function testRebuildFallsBackToColdCreateWhenWarmPoolIsEmpty(): void
    {
        $coldSandboxId = '945988521691942918';

        $warmPool = $this->createMock(WarmPoolSandboxDomainService::class);
        $warmPool->expects($this->once())->method('tryAcquireAndMount')->willReturn(null);

        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->expects($this->once())->method('createSandbox')->willReturn(
            new GatewayResult(ResponseCode::SUCCESS, 'ok', ['sandbox_id' => $coldSandboxId])
        );

        $this->runRebuild($warmPool, $coldSandboxId, $gateway);
    }

    public function testAuxiliaryActualBindingSurvivesReadinessFailure(): void
    {
        $policy = ApplicationContext::getContainer()->get(MagicClawRuntimePolicyDomainService::class);
        $policy->method('assertProject')->willReturn(new MagicClawEntity(['id' => 5, 'project_id' => 1]));
        $bindings = [];
        $records = $this->createMock(MagicClawReconciliationRepository::class);
        ApplicationContext::getContainer()->services[MagicClawReconciliationRepository::class] = $records;
        $records->method('bindConverter')->willReturnCallback(static function (int $id, string $sandbox) use (&$bindings): void {
            self::assertSame(5, $id);
            $bindings[] = $sandbox;
        });
        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->method('createSandbox')->willReturn(new GatewayResult(ResponseCode::SUCCESS, 'ok', ['sandbox_id' => 'actual-converter']));
        $gateway->method('getSandboxStatus')->willReturnCallback(static function (string $sandbox): SandboxStatusResult {
            if ($sandbox === 'requested-converter') {
                return new SandboxStatusResult(ResponseCode::NOT_FOUND, 'gone');
            }
            throw new SandboxOperationException('status', 'timeout', 500);
        });
        $service = $this->buildService($this->createMock(SandboxAgentInterface::class), $gateway, $this->createMock(TopicRepositoryInterface::class));
        try {
            $service->ensureSandboxRunning($this->buildDataIsolation(), 'requested-converter', '1', '/work');
            self::fail('Expected readiness failure');
        } catch (SandboxOperationException) {
            self::assertSame(['requested-converter', 'actual-converter'], $bindings);
        }
    }

    public function testSharedStopTreatsMissingSandboxAsSuccess(): void
    {
        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->method('deleteSandbox')->willReturn(new GatewayResult(ResponseCode::NOT_FOUND, 'gone'));
        $service = $this->buildService($this->createMock(SandboxAgentInterface::class), $gateway, $this->createMock(TopicRepositoryInterface::class));
        self::assertTrue($service->stopSandboxIfExists('actual-sandbox')->isSuccess());
    }

    public function testSharedStopRetainsUnconfirmedFailure(): void
    {
        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->method('deleteSandbox')->willReturn(new GatewayResult(ResponseCode::ERROR, 'timeout'));
        $service = $this->buildService($this->createMock(SandboxAgentInterface::class), $gateway, $this->createMock(TopicRepositoryInterface::class));
        $this->expectException(SandboxOperationException::class);
        $service->stopSandboxIfExists('actual-sandbox');
    }

    /**
     * 搭一套"旧 pod 已不存在"的重建夹具，并断言最终绑定到 $expectedSandboxId。
     *
     * 两个用例共用：温池返回新 pod 时证明走了温池；温池返回 null 时证明退回冷创建。
     */
    private function runRebuild(
        WarmPoolSandboxDomainService $warmPool,
        string $expectedSandboxId,
        SandboxGatewayInterface $gateway
    ): void {
        $topicId = 945988521691942917;
        $staleId = '953340869490270210';

        // 打开温池开关，否则 tryWarmPoolFastPath 会在第一行就返回，测不到温池分支。
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(
            static fn (string $key, mixed $default = null): mixed => $key === 'super-magic.warm_pool.enabled' ? true : ($default ?? 'test')
        );
        $container = ApplicationContext::getContainer();
        self::assertInstanceOf(EnsureSandboxFakeContainer::class, $container);
        $container->services[ConfigInterface::class] = $config;
        $container->services[WarmPoolSandboxDomainService::class] = $warmPool;

        $topicRepository = $this->createMock(TopicRepositoryInterface::class);
        $topicRepository->method('getTopicById')->willReturn($this->buildTopic($topicId, $staleId));
        $topicRepository->method('updateTopicByCondition')->willReturn(true);

        $agent = $this->createMock(SandboxAgentInterface::class);
        // 旧 pod 已不存在（NOT_FOUND），新沙箱就绪：分别应答，避免后续 waitForWorkspaceReady 抛错。
        $agent->method('getWorkspaceStatus')->willReturnCallback(
            fn (DataIsolation $isolation, string $sandboxId): AgentResponse => $sandboxId === $expectedSandboxId
                ? $this->readyResponse()
                : $this->notFoundResponse()
        );
        $agent->expects($this->once())->method('initAgent')->willReturn(
            AgentResponse::fromApiResponse(['code' => ResponseCode::SUCCESS, 'message' => 'ok', 'data' => []])
        );

        $service = $this->buildService($agent, $gateway, $topicRepository);
        $agentContext = $this->buildAgentContext($this->buildTopic($topicId, $staleId), '');

        // 必须带 project 根目录：温池分支要求 project_space_root_file_id 非空。
        // 温池挂载还要以用户身份写 metadata.json，缺少 token 时分支同样会提前返回。
        $dataIsolation = $this->buildDataIsolation();
        $dataIsolation->setUserAuthorizationToken('test-user-token');

        $result = $service->ensureSandboxInitialized(
            $dataIsolation,
            $agentContext,
            new SandboxRootFileIds('project-root-file-id', 'user-root-file-id', 'topic-root-file-id')
        );

        self::assertSame($expectedSandboxId, $result);
    }

    private function buildService(
        SandboxAgentInterface $agent,
        SandboxGatewayInterface $gateway,
        TopicRepositoryInterface $topicRepository,
        ?MagicClawRepositoryInterface $claws = null,
    ): AgentDomainService {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        return new AgentDomainService(
            $loggerFactory,
            $gateway,
            $agent,
            $this->createMock(MagicUserInfoAppService::class),
            $this->createMock(CloudFileRepositoryInterface::class),
            $this->createMock(DynamicConfigManager::class),
            $claws ?? $this->createMock(MagicClawRepositoryInterface::class),
            $this->createMock(SuperMagicAgentRepositoryInterface::class),
            $this->createMock(MagicTokenRepositoryInterface::class),
            $this->createMock(ProjectRepositoryInterface::class),
            $topicRepository,
            $this->createMock(WorkspaceRepositoryInterface::class),
            $this->createMock(TaskMessageRepositoryInterface::class),
            new CrossProjectMentionPathTranslator(),
        );
    }

    private function buildTopic(int $id, string $sandboxId): TopicEntity
    {
        return new TopicEntity([
            'id' => $id,
            'project_id' => 1,
            'topic_name' => 'test-topic',
            'sandbox_id' => $sandboxId,
            'agent_code' => '',
            'work_dir' => '',
        ]);
    }

    private function buildAgentContext(TopicEntity $topicEntity, string $contextSandboxId): AgentContext
    {
        $projectEntity = new ProjectEntity([
            'id' => 1,
            'project_name' => 'test-project',
        ]);

        $productContext = SuperMagicProductContext::fromEntities($projectEntity, $topicEntity, null, $contextSandboxId);

        return new AgentContext(
            $contextSandboxId,
            'test-auth-token',
            $projectEntity,
            $topicEntity,
            new TaskEntity(),
            AgentInitContext::createDefault($productContext)
        );
    }

    private function buildDataIsolation(): DataIsolation
    {
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentUserId('usi_test_user');

        return $dataIsolation;
    }

    private function readyResponse(): AgentResponse
    {
        return AgentResponse::fromApiResponse([
            'code' => ResponseCode::SUCCESS,
            'message' => 'ok',
            'data' => ['status' => WorkspaceStatus::READY],
        ]);
    }

    private function notFoundResponse(): AgentResponse
    {
        return AgentResponse::fromApiResponse([
            'code' => ResponseCode::NOT_FOUND,
            'message' => 'sandbox not found',
            'data' => [],
        ]);
    }
}

class EnsureSandboxFakeContainer implements ContainerInterface
{
    /** @var array<string, mixed> */
    public array $services = [];

    public function get(string $id): mixed
    {
        return $this->services[$id] ?? null;
    }

    public function has(string $id): bool
    {
        return isset($this->services[$id]);
    }
}
