<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\SuperMagic\ExternalAPI\SandboxOS;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayService;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;

/**
 * POST /api/v1/sandboxes 的请求体契约：什么时候带镜像、带哪些字段.
 *
 * 这个契约决定"指定镜像启动"能否生效，也决定普通发布是否会被固化：
 *
 * | 用例 | 请求体里的镜像字段 |
 * |---|---|
 * | 未指定镜像（正常发布） | 没有，网关读自己的 ConfigMap |
 * | 指定 agent | agent_image 与该时刻的 agfs_image |
 * | 指定 agent 与 agfs | 两个都按指定值 |
 *
 * @internal
 */
class SandboxCreateGatewayTest extends TestCase
{
    private const RELEASE = [
        'agent_image' => 'registry/agent:5.0.92',
        'agfs_image' => 'registry/agfs:1.0.14',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        // DataIsolation 的构造函数会读 app_env()；纯单测没有应用容器，这里补一个最小替身。
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturn('test');
        $container = new SandboxCreateTestContainer($config);
        ApplicationContext::setContainer($container);
    }

    public function testCreateWithoutSpecifiedImagesLeavesImagesToTheGateway(): void
    {
        $body = $this->captureCreatePayload(SandboxImageTarget::release(self::RELEASE));

        self::assertArrayNotHasKey('agent_image', $body, '未指定镜像时不能固化发布版本');
        self::assertArrayNotHasKey('agfs_image', $body);
        self::assertSame('sandbox-101', $body['sandbox_id']);
        self::assertSame('project-11', $body['project_id']);
    }

    public function testCreateWithSpecifiedAgentImageSendsTheCompleteTargetPair(): void
    {
        $body = $this->captureCreatePayload(
            SandboxImageTarget::withSpecifiedImages(self::RELEASE, 'registry/agent:5.0.77', null)
        );

        self::assertSame('registry/agent:5.0.77', $body['agent_image']);
        self::assertSame(
            self::RELEASE['agfs_image'],
            $body['agfs_image'],
            '另一侧用判定时的发布版本，保证建出来的 pod 与判定目标一致'
        );
    }

    public function testCreateWithBothImagesSpecifiedSendsBoth(): void
    {
        $body = $this->captureCreatePayload(
            SandboxImageTarget::withSpecifiedImages(self::RELEASE, 'registry/agent:5.0.77', 'registry/agfs:1.0.13')
        );

        self::assertSame('registry/agent:5.0.77', $body['agent_image']);
        self::assertSame('registry/agfs:1.0.13', $body['agfs_image']);
    }

    /**
     * @return array<string, mixed> 实际发出的 JSON 请求体
     */
    private function captureCreatePayload(?SandboxImageTarget $images): array
    {
        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"code":1000,"message":"ok","data":{"sandbox_id":"sandbox-101"}}'),
        ]));
        $handler->push(Middleware::history($history));

        $gateway = new class(new Client(['handler' => $handler, 'base_uri' => 'https://gateway.test/', 'http_errors' => false])) extends SandboxGatewayService {
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

        // 不用 DataIsolation::create()：它会注入 AgentDomainService 去查 token，
        // 本用例只关心请求体，用户身份直接给出即可。
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentOrganizationCode('org-1');
        $dataIsolation->setCurrentUserId('user-1');
        $result = $gateway->createSandbox(
            $dataIsolation,
            'project-11',
            'sandbox-101',
            '/workspace',
            'project-root',
            'user-root',
            'topic-root',
            ['topic-id' => '101'],
            $images
        );

        self::assertTrue($result->isSuccess(), '网关成功响应必须被解析为成功');
        self::assertCount(1, $history);
        self::assertSame('POST', $history[0]['request']->getMethod());
        self::assertSame('/api/v1/sandboxes', $history[0]['request']->getUri()->getPath());

        /* @var array<string, mixed> $body */
        return Json::decode((string) $history[0]['request']->getBody());
    }
}

/**
 * 最小容器替身：只提供 ConfigInterface，够 DataIsolation 读取 app_env()。
 */
final class SandboxCreateTestContainer implements ContainerInterface
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
