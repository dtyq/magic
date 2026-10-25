<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Integration\SuperMagic;

use App\Application\SuperMagic\Task\Contract\SandboxRebuildPortInterface;
use App\Application\SuperMagic\Task\DTO\SandboxRestartOptions;
use App\Application\SuperMagic\Task\Service\SandboxRestartAppService;
use App\Application\SuperMagic\Task\Service\SandboxRestartBatchRunner;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Agent\Service\MagicClawDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartTarget;
use App\Domain\SuperMagic\Task\Service\SandboxRestartPlanner;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayService;
use GuzzleHttp\Client;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Log\NullLogger;
use RuntimeException;

/**
 * 跨层集成：「把沙箱重启到指定旧镜像，再用默认参数反证」这条运维闭环。
 *
 * 参与的层都是生产实现，只有两处替身：
 *   - 沙箱网关的 HTTP 端：一个内存里的假集群，按请求真实地建 pod / 删 pod / 列 pod；
 *   - 重建端口：模拟"按目标镜像冷启动一个 pod"，即调用真实的 POST /api/v1/sandboxes。
 * 因此这条链上真正被验证的是：CLI 参数 → 目标镜像解析 → 判定 → 重建请求体 → 网关状态变化 → 下一次判定。
 *
 * 为什么必须做到端到端：单测各自成立但拼起来出错的情况恰恰最容易漏——
 * 判定用 A 版本、重建请求体写了 B 版本、或者重建后没有真正改掉集群状态，
 * 只有让"下一次 dry-run"读回假集群才会暴露。
 *
 * @internal
 */
class SandboxRestartImageRollbackTest extends TestCase
{
    public const TOPIC_ID = 101;

    public const PROJECT_ID = 11;

    private const RELEASE_AGENT = 'registry.example.com/magic/super-magic:5.0.92';

    private const RELEASE_AGFS = 'registry.example.com/magic/agfs:1.0.14';

    private const OLD_AGENT = 'registry.example.com/magic/super-magic:5.0.77';

    private FakeSandboxCluster $cluster;

    protected function setUp(): void
    {
        parent::setUp();

        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturn('test');
        ApplicationContext::setContainer(new SandboxRollbackTestContainer($config));

        $this->cluster = new FakeSandboxCluster(
            agentImage: self::RELEASE_AGENT,
            agfsImage: self::RELEASE_AGFS,
        );
    }

    /**
     * 完整闭环：指定旧镜像重启一次 → 集群真的变成旧镜像 → 默认参数下又判为"需要重启"。
     *
     * 第二步的"需要重启"正是第一步生效的证据；如果重建请求没有带镜像，
     * 第二步会返回 0 个目标，这个用例就会失败。
     */
    public function testRollingOneSandboxBackToAnOlderImageIsVisibleToTheNextDryRun(): void
    {
        $this->cluster->addPod(sandboxId: 'sandbox-101', topicId: (string) self::TOPIC_ID);

        // ① 指定旧 agent 镜像：判定基准变成旧版本，因此这只沙箱需要重启。
        $plan = $this->service()->plan(new SandboxRestartOptions(requestedAgentImage: self::OLD_AGENT));
        self::assertSame([self::TOPIC_ID], $this->topicIds($plan->getTargets()), '发布版本 5.0.92 → 目标 5.0.77，必须重启');
        self::assertSame(self::OLD_AGENT, $plan->getTarget()->getAgentImage());

        $outcome = $this->service()->execute($plan, new SandboxRestartOptions(requestedAgentImage: self::OLD_AGENT));
        self::assertSame(1, $outcome->getRestartedCount());
        self::assertSame(0, $outcome->getFailedCount());

        // ② 集群状态真的变了，而且重建请求带上的是完整的目标镜像对。
        $recreated = $this->cluster->pod('sandbox-101');
        self::assertNotNull($recreated);
        self::assertSame(self::OLD_AGENT, $recreated['agent_image']);
        self::assertSame(self::RELEASE_AGFS, $recreated['agfs_image'], '未指定的一侧仍用发布版本');
        self::assertSame(
            ['agent_image' => self::OLD_AGENT, 'agfs_image' => self::RELEASE_AGFS],
            $this->cluster->lastCreateImages,
            '创建请求必须显式带上目标镜像，否则网关仍会建出发布版本'
        );

        // ③ 不带任何镜像参数（= 跟随发布）再判定：这只沙箱跑在旧版本上，应当再次被判为需要重启。
        $defaultPlan = $this->service()->plan(new SandboxRestartOptions());
        self::assertSame(
            [self::TOPIC_ID],
            $this->topicIds($defaultPlan->getTargets()),
            '默认参数以发布版本为准，旧镜像沙箱必须被判为待重启——这就是"重启命令确实生效"的证据'
        );
        self::assertSame(0, $defaultPlan->getUpToDateTopics());
    }

    /**
     * 用户最常用的演练方式：点名一只沙箱 + 指定一版旧镜像，其它沙箱原地不动。
     *
     * 这条用例把三个能力钉在一起：--sandbox-id 的精确范围、--agent-image 的目标镜像、
     * 以及"只动这一只"的副作用边界。
     */
    public function testDrillOnOneNamedSandboxWithASpecifiedImage(): void
    {
        $this->cluster->addPod(sandboxId: 'sandbox-101', topicId: (string) self::TOPIC_ID);
        $this->cluster->addPod(sandboxId: 'sandbox-202', topicId: '202');

        $options = new SandboxRestartOptions(
            sandboxIds: ['sandbox-101'],
            requestedAgentImage: self::OLD_AGENT,
        );

        $plan = $this->service()->plan($options);
        self::assertSame([self::TOPIC_ID], $this->topicIds($plan->getTargets()), '只处理点名的那一只');

        $this->service()->execute($plan, $options);

        self::assertSame(self::OLD_AGENT, $this->cluster->pod('sandbox-101')['agent_image'] ?? null);
        self::assertSame(
            self::RELEASE_AGENT,
            $this->cluster->pod('sandbox-202')['agent_image'] ?? null,
            '没点名的沙箱必须原地不动'
        );
    }

    /**
     * 点名一个不存在的沙箱要在动手前失败，而不是静默返回空计划。
     */
    public function testDrillOnAnUnknownSandboxFailsInsteadOfDoingNothing(): void
    {
        $this->cluster->addPod(sandboxId: 'sandbox-101', topicId: (string) self::TOPIC_ID);

        $this->expectExceptionMessage('sandbox-404');
        $this->service()->plan(new SandboxRestartOptions(sandboxIds: ['sandbox-404']));
    }

    /**
     * 反向确认：不指定镜像时，已经在发布版本上的沙箱一个都不该动。
     * 这条用例把"未指定就不下发镜像字段"这个契约钉在整条链路上。
     */
    public function testDefaultRunOnReleaseImagesPlansNothingAndSendsNoImageFields(): void
    {
        $this->cluster->addPod(sandboxId: 'sandbox-101', topicId: (string) self::TOPIC_ID);

        $plan = $this->service()->plan(new SandboxRestartOptions());

        self::assertSame([], $plan->getTargets());
        self::assertSame(1, $plan->getUpToDateTopics());
        self::assertSame([], $this->cluster->lastCreateImages, '没有重启，就不该有创建请求');
    }

    /**
     * 温池里已经预热好最新镜像的 pod 既不删也不领：它在池里的价值正是"随时可领"，
     * 删掉只会让补货流程用同样的镜像再冷启动一遍。
     */
    public function testWarmPoolPodAlreadyOnTheReleaseImagesIsLeftAlone(): void
    {
        $this->cluster->addPod(sandboxId: 'warm-900', warmPool: true, bound: false);

        $plan = $this->service()->plan(new SandboxRestartOptions());

        self::assertSame(0, $plan->getDeletionCount(), '已是最新镜像的池 pod 不该被删');
        self::assertTrue($plan->isEmpty());
        self::assertSame(1, $plan->getSkippedPodCount());

        $this->service()->execute($plan, new SandboxRestartOptions());

        self::assertNotNull($this->cluster->pod('warm-900'), '执行后温池 pod 仍在');
        self::assertSame([], $this->cluster->lastCreateImages, '全程没有发生创建请求');
    }

    /**
     * 池里混着旧镜像的 pod 才会被清掉，让补货流程用发布版本补齐。
     */
    public function testOutdatedWarmPoolPodIsReplacedByTheRefillLoop(): void
    {
        $this->cluster->addPod(
            sandboxId: 'warm-900',
            warmPool: true,
            bound: false,
            agentImage: 'registry.example.com/magic/super-magic:5.0.77',
        );

        $plan = $this->service()->plan(new SandboxRestartOptions());
        self::assertSame(1, $plan->getDeletionCount(), '旧镜像的池 pod 需要被清掉');

        $this->service()->execute($plan, new SandboxRestartOptions());
        self::assertNull($this->cluster->pod('warm-900'));
    }

    /**
     * 指定镜像的运行时不会被共享温池拖下水    /**
     * 指定镜像的运行时不会被共享温池拖下水：池 pod 既不会被删，也不会被当成话题。
     * 这条也是"温池预热的是发布版本"这一事实的下游保护。
     */
    public function testSpecifiedRunLeavesTheSharedWarmPoolAlone(): void
    {
        $this->cluster->addPod(sandboxId: 'sandbox-101', topicId: (string) self::TOPIC_ID);
        $this->cluster->addPod(sandboxId: 'warm-900', warmPool: true, bound: false);

        $plan = $this->service()->plan(new SandboxRestartOptions(requestedAgentImage: self::OLD_AGENT));

        self::assertSame(0, $plan->getDeletionCount(), '指定镜像时不该清理共享温池');
        self::assertNotNull($this->cluster->pod('warm-900'));

        $this->service()->execute($plan, new SandboxRestartOptions(requestedAgentImage: self::OLD_AGENT));
        self::assertNotNull($this->cluster->pod('warm-900'), '执行完温池 pod 仍然在');
    }

    private function service(): SandboxRestartAppService
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        $topicService = $this->createMock(TopicDomainService::class);
        $topicService->method('getTopicsByIds')->willReturn([$this->topic()]);
        $topicService->method('getTopicById')->willReturn($this->topic());

        return new SandboxRestartAppService(
            gateway: $this->gateway(),
            topicDomainService: $topicService,
            taskDomainService: $this->createMock(TaskDomainService::class),
            // MagicClawDomainService 是 readonly 服务，PHPUnit 无法替身；本用例不涉及 Claw 范围。
            magicClawDomainService: new SandboxRollbackClawStub(),
            planner: new SandboxRestartPlanner(),
            rebuildPort: new ClusterRebuildPort($this->cluster, $this->gateway()),
            batchRunner: new SandboxRestartBatchRunner(),
            loggerFactory: $loggerFactory,
        );
    }

    /**
     * 真实客户端 + 假网关：请求体与路径都按生产代码生成，只有对端是内存集群。
     */
    private function gateway(): SandboxGatewayService
    {
        $handler = fn (RequestInterface $request, array $options) => Create::promiseFor(
            $this->cluster->handle($request)
        );

        return new class(new Client(['handler' => $handler, 'base_uri' => 'https://gateway.test/', 'http_errors' => false])) extends SandboxGatewayService {
            public function __construct(private Client $testClient)
            {
                $this->logger = new NullLogger();
            }

            protected function getClient(): Client
            {
                return $this->testClient;
            }

            protected function isEnabledSandbox(): bool
            {
                return true;
            }

            protected function getBaseHeaders(): array
            {
                return ['Sandbox-Gateway-Token' => 'gateway-token'];
            }
        };
    }

    private function topic(): TopicEntity
    {
        return (new TopicEntity())
            ->setId(self::TOPIC_ID)
            ->setProjectId(self::PROJECT_ID)
            ->setSandboxId('sandbox-101')
            ->setUserId('user-1')
            ->setUserOrganizationCode('org-1');
    }

    /**
     * @param array<int, SandboxRestartTarget> $targets
     * @return int[]
     */
    private function topicIds(array $targets): array
    {
        return array_map(static fn ($target): int => $target->getTopicId(), $targets);
    }
}

/**
 * 重建端口的生产语义替身：删掉旧 pod 后按目标镜像冷启动一个，再回写话题绑定。
 *
 * 它与真实实现（AgentAppService → AgentDomainService → createSandbox）走的是同一个
 * 网关方法，因此创建请求体里的镜像字段是真实生产代码生成的。
 */
final readonly class ClusterRebuildPort implements SandboxRebuildPortInterface
{
    public function __construct(
        private FakeSandboxCluster $cluster,
        private SandboxGatewayService $gateway,
    ) {
    }

    public function deleteSandbox(string $sandboxId): void
    {
        $this->cluster->deletePod($sandboxId);
    }

    public function rebuild(int $topicId, string $userId, string $organizationCode, ?SandboxImageTarget $images = null): string
    {
        $sandboxId = 'sandbox-' . $topicId;
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentOrganizationCode($organizationCode);
        $dataIsolation->setCurrentUserId($userId);

        $result = $this->gateway->createSandbox(
            $dataIsolation,
            (string) SandboxRestartImageRollbackTest::PROJECT_ID,
            $sandboxId,
            '/workspace',
            'project-root',
            'user-root',
            'topic-root',
            ['topic-id' => (string) $topicId],
            $images
        );

        if (! $result->isSuccess()) {
            throw new RuntimeException('create failed: ' . $result->getMessage());
        }

        return $sandboxId;
    }
}

/**
 * 内存里的沙箱集群：按真实网关的 REST 契约应答.
 *
 * 只实现这里用到的四个端点，行为尽量贴近真实实现：
 *   GET    /api/v1/sandboxes/images  当前发布镜像
 *   GET    /api/v1/sandboxes         pod 清单（含镜像与归属）
 *   POST   /api/v1/sandboxes         建 pod；请求里带了镜像就用请求里的
 *   DELETE /api/v1/sandboxes/{id}    删 pod（不存在时 4004）
 */
final class FakeSandboxCluster
{
    /** @var array<string, string> 最近一次创建请求里的镜像字段 */
    public array $lastCreateImages = [];

    /** @var array<string, array<string, mixed>> sandboxId => pod */
    private array $pods = [];

    public function __construct(
        private readonly string $agentImage,
        private readonly string $agfsImage,
    ) {
    }

    public function addPod(
        string $sandboxId,
        string $topicId = '',
        bool $warmPool = false,
        bool $bound = true,
        ?string $agentImage = null,
    ): void {
        $this->pods[$sandboxId] = [
            'sandbox_id' => $sandboxId,
            'status' => 'Running',
            'project_id' => self::projectIdFor($topicId),
            'topic_id' => $topicId,
            'warm_pool' => $warmPool,
            'bound' => $bound,
            'created_at' => '2026-09-01T00:00:00Z',
            'agent_image' => $agentImage ?? $this->agentImage,
            'agfs_image' => $this->agfsImage,
        ];
    }

    /**
     * @return null|array<string, mixed>
     */
    public function pod(string $sandboxId): ?array
    {
        return $this->pods[$sandboxId] ?? null;
    }

    public function deletePod(string $sandboxId): void
    {
        unset($this->pods[$sandboxId]);
    }

    public function handle(RequestInterface $request): Response
    {
        $path = $request->getUri()->getPath();
        $method = $request->getMethod();

        if ($method === 'GET' && $path === '/api/v1/sandboxes/images') {
            return $this->ok(['agent_image' => $this->agentImage, 'agfs_image' => $this->agfsImage]);
        }

        if ($method === 'GET' && $path === '/api/v1/sandboxes') {
            return $this->ok(['total' => count($this->pods), 'sandboxes' => array_values($this->pods)]);
        }

        if ($method === 'POST' && $path === '/api/v1/sandboxes') {
            return $this->create($request);
        }

        if ($method === 'DELETE' && str_starts_with($path, '/api/v1/sandboxes/')) {
            $sandboxId = substr($path, strlen('/api/v1/sandboxes/'));
            if (! isset($this->pods[$sandboxId])) {
                return new Response(200, [], Json::encode(['code' => 4004, 'message' => 'sandbox not found']));
            }
            unset($this->pods[$sandboxId]);
            return $this->ok(['sandbox_id' => $sandboxId]);
        }

        return new Response(404, [], Json::encode(['code' => 4004, 'message' => 'no route ' . $method . ' ' . $path]));
    }

    private function create(RequestInterface $request): Response
    {
        /** @var array<string, mixed> $body */
        $body = Json::decode((string) $request->getBody());
        $sandboxId = (string) ($body['sandbox_id'] ?? '');

        $this->lastCreateImages = array_filter([
            'agent_image' => $body['agent_image'] ?? null,
            'agfs_image' => $body['agfs_image'] ?? null,
        ], static fn (mixed $value): bool => is_string($value) && $value !== '');

        $this->pods[$sandboxId] = [
            'sandbox_id' => $sandboxId,
            'status' => 'Running',
            'project_id' => (string) ($body['project_id'] ?? ''),
            'topic_id' => (string) ($body['labels']['topic-id'] ?? ''),
            'warm_pool' => false,
            'bound' => true,
            'created_at' => '2026-10-20T00:00:00Z',
            // 关键：网关只在请求显式给出镜像时才用它，否则读自己的 ConfigMap 发布版本。
            'agent_image' => (string) ($body['agent_image'] ?? $this->agentImage),
            'agfs_image' => (string) ($body['agfs_image'] ?? $this->agfsImage),
        ];

        return $this->ok(['sandbox_id' => $sandboxId, 'agent_image' => $this->pods[$sandboxId]['agent_image']]);
    }

    private static function projectIdFor(string $topicId): string
    {
        return $topicId === '' ? '' : (string) SandboxRestartImageRollbackTest::PROJECT_ID;
    }

    /**
     * @param array<string, mixed> $data
     */
    private function ok(array $data): Response
    {
        return new Response(200, [], Json::encode(['code' => 1000, 'message' => 'ok', 'data' => $data]));
    }
}

/**
 * 空的 Claw 查询替身：all 范围不会走到它。
 */
readonly class SandboxRollbackClawStub extends MagicClawDomainService
{
    public function __construct()
    {
    }

    public function getByProjectIds(array $projectIds): array
    {
        return [];
    }
}

/**
 * 最小容器替身：DataIsolation 需要 app_env()。
 */
final class SandboxRollbackTestContainer implements ContainerInterface
{
    public function __construct(private readonly ConfigInterface $config)
    {
    }

    public function get(string $id): mixed
    {
        return $id === ConfigInterface::class ? $this->config : null;
    }

    public function has(string $id): bool
    {
        return $id === ConfigInterface::class;
    }
}
