<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\SuperMagic\SandboxRestart;

use App\Application\SuperMagic\Task\Service\AgentAppService;
use App\Application\SuperMagic\Task\Service\AgentSandboxRebuildAdapter;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception\SandboxOperationException;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;

/**
 * 重建端口：指定镜像时"建完必须真的是那一版".
 *
 * 这条校验是回滚演练的信任来源。没有它，网关若忽略了请求里的镜像字段，
 * 命令会打印 [OK] 而沙箱其实还在新版本上，运维只能靠下一次 dry-run 才发现。
 *
 * 未指定镜像时不做任何额外校验：那是每条用户请求都会走的常规路径，
 * 不该因为一次发布演练多读一次库。
 *
 * @internal
 */
class AgentSandboxRebuildAdapterTest extends TestCase
{
    private const RELEASE = [
        'agent_image' => 'registry/agent:5.0.92',
        'agfs_image' => 'registry/agfs:1.0.14',
    ];

    private SandboxRebuildTestContainer $container;

    protected function setUp(): void
    {
        parent::setUp();
        // 端口内部用 DataIsolation::create() 组装调用身份，它会读 app_env() 并取
        // AgentDomainService 查 token；纯单测没有应用容器，这里补最小替身。
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturn('test');
        $this->container = new SandboxRebuildTestContainer($config);
        ApplicationContext::setContainer($this->container);
    }

    public function testSpecifiedImagesAreVerifiedAgainstWhatTheSandboxWasBuiltWith(): void
    {
        $target = SandboxImageTarget::withSpecifiedImages(self::RELEASE, 'registry/agent:5.0.77', null);

        $topicService = $this->createMock(TopicDomainService::class);
        $topicService->expects(self::once())->method('getTopicById')->with(101)->willReturn(
            $this->topicWithImages([
                'agent_image' => 'registry/agent:5.0.77',
                'agfs_image' => self::RELEASE['agfs_image'],
            ])
        );

        $sandboxId = $this->adapter($topicService)->rebuild(101, 'user-1', 'org-1', $target);

        self::assertSame('new-sandbox-101', $sandboxId);
    }

    public function testMismatchAfterRebuildIsReportedAsFailure(): void
    {
        $target = SandboxImageTarget::withSpecifiedImages(self::RELEASE, 'registry/agent:5.0.77', null);

        $topicService = $this->createMock(TopicDomainService::class);
        // 网关没采纳镜像字段：建出来的仍是发布版本。
        $topicService->method('getTopicById')->willReturn($this->topicWithImages(self::RELEASE));

        $this->expectException(SandboxOperationException::class);
        $this->expectExceptionMessage('do not match the specified target');

        $this->adapter($topicService)->rebuild(101, 'user-1', 'org-1', $target);
    }

    public function testIncompleteTargetSkipsVerification(): void
    {
        // 目标不完整时无从比较：此时不该把"无法证明"当成"不一致"而误报失败。
        $target = SandboxImageTarget::release(['agent_image' => 'registry/agent:5.0.92', 'agfs_image' => '']);

        $topicService = $this->createMock(TopicDomainService::class);
        $topicService->expects(self::never())->method('getTopicById');

        self::assertSame('new-sandbox-101', $this->adapter($topicService)->rebuild(101, 'user-1', 'org-1', $target));
    }

    public function testRegularRolloutDoesNotReadTheTopicBack(): void
    {
        $topicService = $this->createMock(TopicDomainService::class);
        $topicService->expects(self::never())->method('getTopicById');

        $this->adapter($topicService)->rebuild(101, 'user-1', 'org-1', SandboxImageTarget::release(self::RELEASE));
        $this->adapter($topicService)->rebuild(101, 'user-1', 'org-1');
    }

    private function adapter(TopicDomainService $topicService): AgentSandboxRebuildAdapter
    {
        $agentDomainService = $this->createMock(AgentDomainService::class);
        $agentDomainService->method('stopSandbox')->willReturnCallback(
            static fn (string $sandboxId) => new GatewayResult(1000, 'ok', [])
        );
        // DataIsolation::create() 会通过容器取它来查用户 token。
        $this->container->services[AgentDomainService::class] = $agentDomainService;

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        return new AgentSandboxRebuildAdapter(
            new SandboxRebuildAppServiceStub(),
            $agentDomainService,
            $topicService,
            $loggerFactory,
        );
    }

    /**
     * @param array<string, string> $images
     */
    private function topicWithImages(array $images): TopicEntity
    {
        return (new TopicEntity())->setId(101)->setSandboxImages($images);
    }
}

/**
 * 只实现 "重启并返回新 sandbox id" 这一条的应用服务替身.
 *
 * AgentAppService 是 readonly 类，替身必须同样是 readonly 并自带构造函数。
 */
readonly class SandboxRebuildAppServiceStub extends AgentAppService
{
    public function __construct()
    {
    }

    public function restartSandbox(DataIsolation $dataIsolation, int $topicId, ?SandboxImageTarget $images = null): string
    {
        return 'new-sandbox-' . $topicId;
    }
}

/**
 * 最小容器替身：ConfigInterface 给 app_env()，AgentDomainService 给 DataIsolation::create()
 * 查 token。其余 id 一律返回 null。
 */
final class SandboxRebuildTestContainer implements ContainerInterface
{
    /** @var array<string, mixed> */
    public array $services = [];

    public function __construct(ConfigInterface $config)
    {
        $this->services[ConfigInterface::class] = $config;
    }

    public function get(string $id): mixed
    {
        return $this->services[$id] ?? null;
    }

    public function has(string $id): bool
    {
        return isset($this->services[$id]);
    }
}
