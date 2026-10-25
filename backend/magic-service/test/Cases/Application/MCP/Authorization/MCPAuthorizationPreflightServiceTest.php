<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\MCP\Authorization;

use App\Application\MCP\Authorization\Discovery\MCPAuthorizationDiscoveryClient;
use App\Application\MCP\Authorization\MCPAuthorizationCapabilityService;
use App\Application\MCP\Authorization\MCPAuthorizationPreflightService;
use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\Authorization\MCPAuthorizationConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;
use Throwable;

/**
 * @internal
 */
class MCPAuthorizationPreflightServiceTest extends TestCase
{
    public function testAnalyzesDcrCapabilityWithoutExecutingRegistration(): void
    {
        $mock = new MockHandler([
            new Response(401, ['WWW-Authenticate' => 'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource" scope="files:read"']),
            new Response(200, ['Content-Type' => 'application/json'], json_encode([
                'authorization_servers' => ['https://auth.example.com'],
                'scopes_supported' => ['files:read', 'files:write'],
            ], JSON_THROW_ON_ERROR)),
            new Response(200, ['Content-Type' => 'application/json'], json_encode([
                'issuer' => 'https://auth.example.com',
                'authorization_endpoint' => 'https://auth.example.com/authorize',
                'token_endpoint' => 'https://auth.example.com/token',
                'registration_endpoint' => 'https://auth.example.com/register',
                'token_endpoint_auth_methods_supported' => ['none'],
                'client_id_metadata_document_supported' => true,
            ], JSON_THROW_ON_ERROR)),
        ]);
        $client = new Client(['handler' => HandlerStack::create($mock)]);
        $capabilityService = new MCPAuthorizationCapabilityService(
            $client,
            new MCPAuthorizationDiscoveryClient($client)
        );
        $result = $capabilityService->analyze($this->createAutoMcpServer());

        $this->assertSame('ready', $result['status']);
        $this->assertSame('dcr', $result['registration']['recommended']);
        $this->assertSame(['dcr'], $result['registration']['supported']);
        $this->assertSame([], $result['required_fields']);
        $this->assertSame('files:read', $result['scope']['recommended']);
        $this->assertSame(0, $mock->count());
    }

    public function testReportsClientSecretAsRequiredForPreRegisteredClient(): void
    {
        $mock = new MockHandler([
            new Response(401),
        ]);
        $client = new Client(['handler' => HandlerStack::create($mock)]);
        $authorizationConfig = new MCPAuthorizationConfig();
        $authorizationConfig->setAuthorizationEndpoint('https://auth.example.com/authorize');
        $authorizationConfig->setTokenEndpoint('https://auth.example.com/token');
        $authorizationConfig->setRegistrationMode('pre_registered');
        $authorizationConfig->setClientId('mock-client-id');
        $authorizationConfig->setTokenEndpointAuthMethod('client_secret_basic');

        $serviceConfig = new ExternalSSEServiceConfig();
        $serviceConfig->setUrl('https://mcp.example.com/mcp');
        $serviceConfig->setAuthType(ServiceConfigAuthType::MCP_AUTHORIZATION);
        $serviceConfig->setMcpAuthorizationConfig($authorizationConfig);

        $server = new MCPServerEntity();
        $server->setServiceConfig($serviceConfig);
        $result = (new MCPAuthorizationCapabilityService(
            $client,
            new MCPAuthorizationDiscoveryClient($client)
        ))->analyze($server);

        $this->assertSame('needs_configuration', $result['status']);
        $this->assertContains('client_secret', $result['required_fields']);
    }

    public function testReportsClientIdAsRequiredForPreRegisteredClient(): void
    {
        $mock = new MockHandler([
            new Response(401),
        ]);
        $client = new Client(['handler' => HandlerStack::create($mock)]);
        $authorizationConfig = new MCPAuthorizationConfig();
        $authorizationConfig->setAuthorizationEndpoint('https://auth.example.com/authorize');
        $authorizationConfig->setTokenEndpoint('https://auth.example.com/token');
        $authorizationConfig->setRegistrationMode('pre_registered');

        $serviceConfig = new ExternalSSEServiceConfig();
        $serviceConfig->setUrl('https://mcp.example.com/mcp');
        $serviceConfig->setAuthType(ServiceConfigAuthType::MCP_AUTHORIZATION);
        $serviceConfig->setMcpAuthorizationConfig($authorizationConfig);

        $server = new MCPServerEntity();
        $server->setServiceConfig($serviceConfig);
        $result = (new MCPAuthorizationCapabilityService(
            $client,
            new MCPAuthorizationDiscoveryClient($client)
        ))->analyze($server);

        $this->assertSame('needs_configuration', $result['status']);
        $this->assertContains('client_id', $result['required_fields']);
    }

    public function testAcceptsUnauthenticatedButReachableMcpResource(): void
    {
        $mock = new MockHandler([
            new Response(401, ['WWW-Authenticate' => 'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"']),
        ]);
        $client = new Client(['handler' => HandlerStack::create($mock)]);
        $service = new MCPAuthorizationPreflightService(new MCPAuthorizationCapabilityService(
            $client,
            new MCPAuthorizationDiscoveryClient($client)
        ));

        $service->check($this->createMcpServer());

        $this->assertSame(0, $mock->count());
    }

    public function testRejectsUnavailableMcpResource(): void
    {
        $mock = new MockHandler([
            new Response(404),
        ]);
        $client = new Client(['handler' => HandlerStack::create($mock)]);
        $service = new MCPAuthorizationPreflightService(new MCPAuthorizationCapabilityService(
            $client,
            new MCPAuthorizationDiscoveryClient($client)
        ));

        $this->expectException(Throwable::class);
        $service->check($this->createMcpServer());
    }

    private function createMcpServer(): MCPServerEntity
    {
        $authorizationConfig = new MCPAuthorizationConfig();
        $authorizationConfig->setAuthorizationEndpoint('https://auth.example.com/authorize');
        $authorizationConfig->setTokenEndpoint('https://auth.example.com/token');
        $authorizationConfig->setRegistrationMode('pre_registered');
        $authorizationConfig->setClientId('mock-client-id');

        $serviceConfig = new ExternalSSEServiceConfig();
        $serviceConfig->setUrl('https://mcp.example.com/mcp');
        $serviceConfig->setAuthType(ServiceConfigAuthType::MCP_AUTHORIZATION);
        $serviceConfig->setMcpAuthorizationConfig($authorizationConfig);

        $server = new MCPServerEntity();
        $server->setServiceConfig($serviceConfig);
        return $server;
    }

    private function createAutoMcpServer(): MCPServerEntity
    {
        $authorizationConfig = new MCPAuthorizationConfig();
        $authorizationConfig->setRegistrationMode('auto');

        $serviceConfig = new ExternalSSEServiceConfig();
        $serviceConfig->setUrl('https://mcp.example.com/mcp');
        $serviceConfig->setAuthType(ServiceConfigAuthType::MCP_AUTHORIZATION);
        $serviceConfig->setMcpAuthorizationConfig($authorizationConfig);

        $server = new MCPServerEntity();
        $server->setServiceConfig($serviceConfig);
        return $server;
    }
}
