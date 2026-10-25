<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\SuperMagic\ExternalAPI\SandboxOS;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayService;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * @internal
 */
class ReferencedProjectGatewayTest extends TestCase
{
    public function testRoutesAndPerCallIdentity(): void
    {
        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], '{"code":1000,"data":{"referenced_projects":[{"project_id":"123"}]}}'),
            new Response(200, [], '{"code":1000,"data":{}}'),
        ]));
        $handler->push(Middleware::history($history));
        $gateway = $this->gateway(new Client(['handler' => $handler, 'base_uri' => 'https://gateway.test/', 'http_errors' => false]));
        $actor = $this->actor('org-1', 'user-1', 'first-token');
        $result = $gateway->listReferencedProjects($actor, 'sandbox-1');
        self::assertTrue($result->isSuccess());
        self::assertSame([['project_id' => '123']], $result->getDataValue('referenced_projects'));
        $secondActor = $this->actor('org-2', 'user-2', 'second-token');
        self::assertTrue($gateway->unmountReferencedProject($secondActor, 'sandbox-1', '123')->isSuccess());
        self::assertSame('GET', $history[0]['request']->getMethod());
        self::assertSame('/api/v1/sandboxes/sandbox-1/referenced-projects', $history[0]['request']->getUri()->getPath());
        self::assertSame('DELETE', $history[1]['request']->getMethod());
        self::assertSame('/api/v1/sandboxes/sandbox-1/referenced-projects/123', $history[1]['request']->getUri()->getPath());
        self::assertSame('first-token', $history[0]['request']->getHeaderLine('User-Authorization'));
        self::assertSame('second-token', $history[1]['request']->getHeaderLine('User-Authorization'));
        self::assertSame('user-2', $history[1]['request']->getHeaderLine('magic-user-id'));
        self::assertSame('org-2', $history[1]['request']->getHeaderLine('magic-organization-code'));
        self::assertSame('gateway-token', $history[1]['request']->getHeaderLine('Sandbox-Gateway-Token'));
    }

    public function testFailuresDoNotReportSuccess(): void
    {
        $gateway = $this->gateway(new Client([
            'base_uri' => 'https://gateway.test/',
            'http_errors' => false,
            'handler' => new MockHandler([
                new Response(403, [], '{"code":1000}'),
                new Response(200, [], 'invalid json'),
                new Response(200, [], '{"code":2000,"message":"denied"}'),
                new Response(200, [], 'null'),
            ]),
        ]));
        $actor = $this->actor('org', 'user', '');
        self::assertFalse($gateway->listReferencedProjects($actor, 'sandbox')->isSuccess());
        self::assertFalse($gateway->unmountReferencedProject($actor, 'sandbox', '123')->isSuccess());
        self::assertFalse($gateway->unmountReferencedProject($actor, 'sandbox', '123')->isSuccess());
        self::assertFalse($gateway->listReferencedProjects($actor, 'sandbox')->isSuccess());
    }

    public function testLocalModeDoesNotContactGateway(): void
    {
        $gateway = $this->gateway(new Client(['handler' => new MockHandler([])]), false);
        $actor = $this->actor('org', 'user', '');
        self::assertSame([], $gateway->listReferencedProjects($actor, 'sandbox')->getDataValue('referenced_projects'));
        self::assertTrue($gateway->unmountReferencedProject($actor, 'sandbox', '123')->isSuccess());
    }

    private function actor(string $org, string $user, string $token): DataIsolation
    {
        $actor = $this->createMock(DataIsolation::class);
        $actor->method('getCurrentOrganizationCode')->willReturn($org);
        $actor->method('getCurrentUserId')->willReturn($user);
        $actor->method('getUserAuthorizationToken')->willReturn($token);
        return $actor;
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
