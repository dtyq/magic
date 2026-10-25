<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\SuperMagic\ExternalAPI\SandboxOS;

use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayService;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * GET /api/v1/sandboxes 的客户端契约：路径、状态过滤、解析与失败语义。
 *
 * @internal
 */
class SandboxListGatewayTest extends TestCase
{
    public function testListSandboxesHitsCollectionEndpointWithStatusFilter(): void
    {
        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"code":1000,"message":"ok","data":{"total":2,"sandboxes":['
                . '{"sandbox_id":"warm-1","status":"Running","project_id":"11","topic_id":"101","warm_pool":true,"bound":true,"created_at":"2026-09-01T08:30:00Z","agent_image":"agent-image:1.2.3","agfs_image":"agfs-image:1.0.14"},'
                . '{"sandbox_id":"warm-2","status":"NotReady"}]}}'),
        ]));
        $handler->push(Middleware::history($history));
        $gateway = $this->gateway(new Client([
            'handler' => $handler,
            'base_uri' => 'https://gateway.test/',
            'http_errors' => false,
        ]));

        $result = $gateway->listSandboxes(['Running', 'NotReady']);

        self::assertTrue($result->isSuccess());
        self::assertSame(2, $result->getTotal());
        self::assertSame('warm-1', $result->getSandboxes()[0]->getSandboxId());
        self::assertSame('2026-09-01T08:30:00Z', $result->getSandboxes()[0]->getCreatedAt());
        self::assertSame('agent-image:1.2.3', $result->getSandboxes()[0]->getAgentImage());
        self::assertSame('agfs-image:1.0.14', $result->getSandboxes()[0]->getAgfsImage());
        // 老网关不返回镜像字段时按未知处理，不能猜成"已是最新"
        self::assertSame('', $result->getSandboxes()[1]->getAgentImage());
        self::assertSame('', $result->getSandboxes()[1]->getCreatedAt());
        self::assertSame(['Running' => 1, 'NotReady' => 1], $result->getStatusCounts());
        self::assertSame('GET', $history[0]['request']->getMethod());
        self::assertSame('/api/v1/sandboxes', $history[0]['request']->getUri()->getPath());
        self::assertSame('status=Running%2CNotReady', $history[0]['request']->getUri()->getQuery());
        self::assertSame('gateway-token', $history[0]['request']->getHeaderLine('Sandbox-Gateway-Token'));
    }

    public function testListSandboxesWithoutStatusesOmitsTheFilter(): void
    {
        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"code":1000,"message":"ok","data":{"total":0,"sandboxes":[]}}'),
        ]));
        $handler->push(Middleware::history($history));
        $gateway = $this->gateway(new Client([
            'handler' => $handler,
            'base_uri' => 'https://gateway.test/',
            'http_errors' => false,
        ]));

        $result = $gateway->listSandboxes();

        self::assertTrue($result->isSuccess());
        self::assertSame([], $result->getSandboxes());
        self::assertSame('', $history[0]['request']->getUri()->getQuery());
    }

    public function testGatewayErrorIsNotReportedAsSuccess(): void
    {
        $gateway = $this->gateway(new Client([
            'handler' => new MockHandler([
                new Response(200, [], '{"code":2000,"message":"gateway exploded"}'),
            ]),
            'base_uri' => 'https://gateway.test/',
            'http_errors' => false,
        ]));

        $result = $gateway->listSandboxes(['Running']);

        self::assertFalse($result->isSuccess());
        self::assertSame('gateway exploded', $result->getMessage());
        self::assertSame([], $result->getSandboxes());
    }

    public function testLocalModeReturnsEmptyListWithoutContactingGateway(): void
    {
        // MockHandler 里没有任何响应：一旦真的发请求就会抛异常。
        $gateway = $this->gateway(new Client(['handler' => new MockHandler([])]), false);

        $result = $gateway->listSandboxes(['Running']);

        self::assertTrue($result->isSuccess());
        self::assertSame(0, $result->getTotal());
        self::assertSame([], $result->getSandboxes());
    }

    private function gateway(Client $client, bool $enabled = true): SandboxGatewayService
    {
        return new class($client, $enabled) extends SandboxGatewayService {
            public function __construct(private Client $testClient, private bool $enabled)
            {
                $this->logger = new NullLogger();
            }

            protected function getClient(): Client
            {
                return $this->testClient;
            }

            protected function isEnabledSandbox(): bool
            {
                return $this->enabled;
            }

            protected function getBaseHeaders(): array
            {
                return ['Sandbox-Gateway-Token' => 'gateway-token'];
            }
        };
    }
}
