<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\MCP\Authorization;

use App\Application\MCP\Authorization\MCPAuthorizationAppService;
use App\Application\MCP\Authorization\MCPAuthorizationConfigFingerprint;
use App\Application\MCP\Authorization\MCPAuthorizationSecretCipher;
use App\Application\MCP\Authorization\State\MCPAuthorizationStateStore;
use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\Authorization\MCPAuthorizationConfig;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\Domain\MCP\Repository\Facade\MCPAuthorizationCredentialRepositoryInterface;
use App\Domain\MCP\Repository\Facade\MCPServerRepositoryInterface;
use App\Domain\MCP\Service\MCPAuthorizationCredentialDomainService;
use App\Domain\MCP\Service\MCPServerDomainService;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class MCPAuthorizationAppServiceTest extends TestCase
{
    private const CALLBACK_URL = 'https://magic.example.com/api/v1/mcp/authorization/callback';

    public function testReusesPendingStateWhenConfigFingerprintMatches(): void
    {
        $server = $this->createServer('https://mcp.example.com/mcp');
        $fingerprint = $this->fingerprintFor($server);
        $pendingUrl = 'https://auth.example.com/authorize?state=cached';
        $stateStore = $this->createMock(MCPAuthorizationStateStore::class);
        $stateStore->expects($this->once())
            ->method('getPending')
            ->with('org-1', 'user-1', 'MCP001')
            ->willReturn([
                'state' => 'cached-state',
                'authorization_url' => $pendingUrl,
                'resource' => 'https://mcp.example.com/mcp',
                'issuer' => 'https://auth.example.com',
                'expires_at' => time() + 600,
                'config_fingerprint' => $fingerprint,
            ]);
        $stateStore->expects($this->never())->method('invalidatePending');
        $stateStore->expects($this->never())->method('put');
        $stateStore->expects($this->never())->method('putPending');

        $result = $this->createService($stateStore)->getAuthConfig(
            $this->createDataIsolation(),
            $server,
            null
        );

        $this->assertFalse($result['is_authenticated']);
        $this->assertSame($pendingUrl, $result['authorization_url']);
        $this->assertSame($pendingUrl, $result['oauth_url']);
        $this->assertSame('cached-state', $result['state']);
    }

    public function testInvalidatesPendingStateWhenServiceUrlChanges(): void
    {
        $server = $this->createServer('https://mcp-v2.example.com/mcp');
        $oldFingerprint = MCPAuthorizationConfigFingerprint::from(
            'https://mcp.example.com/mcp',
            $this->createAuthorizationConfig(),
            'https://mcp.example.com/mcp',
            self::CALLBACK_URL
        );
        $capturedState = [];
        $stateStore = $this->createMock(MCPAuthorizationStateStore::class);
        $stateStore->expects($this->once())
            ->method('getPending')
            ->willReturn([
                'state' => 'old-state',
                'authorization_url' => 'https://auth.example.com/authorize?resource=https%3A%2F%2Fmcp.example.com%2Fmcp',
                'resource' => 'https://mcp.example.com/mcp',
                'issuer' => 'https://auth.example.com',
                'expires_at' => time() + 600,
                'config_fingerprint' => $oldFingerprint,
            ]);
        $stateStore->expects($this->once())
            ->method('invalidatePending')
            ->with('org-1', 'user-1', 'MCP001', 'old-state');
        $stateStore->expects($this->once())
            ->method('put')
            ->willReturnCallback(function (string $state, array $data) use (&$capturedState): void {
                $capturedState = $data;
                $this->assertSame($this->fingerprintFor($this->createServer('https://mcp-v2.example.com/mcp')), $data['config_fingerprint']);
                $this->assertSame('https://mcp-v2.example.com/mcp', $data['resource']);
                $this->assertStringContainsString('https://auth.example.com/authorize', $data['authorization_url']);
                $this->assertStringContainsString('mcp-v2.example.com', $data['authorization_url']);
                $this->assertStringNotContainsString('mcp.example.com/mcp', $data['authorization_url']);
            });
        $stateStore->expects($this->once())->method('putPending')->willReturn(true);

        $result = $this->createService($stateStore)->getAuthConfig(
            $this->createDataIsolation(),
            $server,
            null
        );

        $this->assertFalse($result['is_authenticated']);
        $this->assertNotSame('', $result['authorization_url']);
        $this->assertStringContainsString('mcp-v2.example.com', $result['authorization_url']);
        $this->assertArrayHasKey('config_fingerprint', $capturedState);
    }

    public function testInvalidatesLegacyPendingStateWithoutFingerprint(): void
    {
        $server = $this->createServer('https://mcp.example.com/mcp');
        $stateStore = $this->createMock(MCPAuthorizationStateStore::class);
        $stateStore->expects($this->once())
            ->method('getPending')
            ->willReturn([
                'state' => 'legacy-state',
                'authorization_url' => 'https://stale.example.com/authorize',
                'resource' => 'https://mcp.example.com/mcp',
                'expires_at' => time() + 600,
            ]);
        $stateStore->expects($this->once())
            ->method('invalidatePending')
            ->with('org-1', 'user-1', 'MCP001', 'legacy-state');
        $stateStore->expects($this->once())->method('put');
        $stateStore->expects($this->once())->method('putPending')->willReturn(true);

        $result = $this->createService($stateStore)->getAuthConfig(
            $this->createDataIsolation(),
            $server,
            null
        );

        $this->assertFalse($result['is_authenticated']);
        $this->assertStringContainsString('https://auth.example.com/authorize', $result['authorization_url']);
        $this->assertStringNotContainsString('stale.example.com', $result['authorization_url']);
    }

    public function testDoesNotReuseRacePendingWhenFingerprintMismatches(): void
    {
        $server = $this->createServer('https://mcp-v2.example.com/mcp');
        $stateStore = $this->createMock(MCPAuthorizationStateStore::class);
        $stateStore->expects($this->exactly(2))
            ->method('getPending')
            ->willReturnOnConsecutiveCalls(
                null,
                [
                    'state' => 'raced-state',
                    'authorization_url' => 'https://stale.example.com/authorize',
                    'resource' => 'https://mcp.example.com/mcp',
                    'config_fingerprint' => 'stale',
                    'expires_at' => time() + 600,
                ]
            );
        $stateStore->expects($this->never())->method('invalidatePending');
        $stateStore->expects($this->once())->method('put');
        $stateStore->expects($this->once())->method('putPending')->willReturn(false);
        $stateStore->expects($this->once())->method('delete');

        $result = $this->createService($stateStore)->getAuthConfig(
            $this->createDataIsolation(),
            $server,
            null
        );

        $this->assertFalse($result['is_authenticated']);
        $this->assertSame('', $result['authorization_url']);
        $this->assertSame('MCP authorization is not available', $result['error']);
    }

    private function createDataIsolation(): MCPDataIsolation
    {
        $dataIsolation = $this->createMock(MCPDataIsolation::class);
        $dataIsolation->method('getCurrentOrganizationCode')->willReturn('org-1');
        $dataIsolation->method('getCurrentUserId')->willReturn('user-1');
        $dataIsolation->method('getLanguage')->willReturn('zh_CN');
        return $dataIsolation;
    }

    private function createService(MCPAuthorizationStateStore $stateStore): MCPAuthorizationAppService
    {
        $credentialRepository = $this->createMock(MCPAuthorizationCredentialRepositoryInterface::class);
        $credentialRepository->method('getByResource')->willReturn(null);
        $credentialDomainService = new MCPAuthorizationCredentialDomainService($credentialRepository);

        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static function (string $key, mixed $default = null): mixed {
            return match ($key) {
                'mcp_authorization.callback_url' => self::CALLBACK_URL,
                'mcp_authorization.state_ttl' => 600,
                'mcp_authorization.token_expiry_leeway' => 30,
                default => $default,
            };
        });

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($this->createMock(LoggerInterface::class));

        return new MCPAuthorizationAppService(
            $credentialDomainService,
            $stateStore,
            $this->createMock(MCPAuthorizationSecretCipher::class),
            new MCPServerDomainService($this->createMock(MCPServerRepositoryInterface::class)),
            $config,
            $loggerFactory
        );
    }

    private function createServer(string $url): MCPServerEntity
    {
        $authorizationConfig = $this->createAuthorizationConfig();
        $serviceConfig = new ExternalSSEServiceConfig();
        $serviceConfig->setUrl($url);
        $serviceConfig->setAuthType(ServiceConfigAuthType::MCP_AUTHORIZATION);
        $serviceConfig->setMcpAuthorizationConfig($authorizationConfig);

        $server = new MCPServerEntity();
        $server->setCode('MCP001');
        $server->setServiceConfig($serviceConfig);
        return $server;
    }

    private function createAuthorizationConfig(): MCPAuthorizationConfig
    {
        $config = new MCPAuthorizationConfig();
        $config->setAuthorizationEndpoint('https://auth.example.com/authorize');
        $config->setTokenEndpoint('https://auth.example.com/token');
        $config->setRegistrationMode('pre_registered');
        $config->setClientId('mock-client-id');
        $config->setTokenEndpointAuthMethod('none');
        return $config;
    }

    private function fingerprintFor(MCPServerEntity $server): string
    {
        $config = $server->getServiceConfig();
        $this->assertInstanceOf(ExternalSSEServiceConfig::class, $config);
        $authorizationConfig = $config->getMcpAuthorizationConfig();
        $this->assertNotNull($authorizationConfig);
        $resource = $authorizationConfig->getResource() ?: $config->getUrl();
        return MCPAuthorizationConfigFingerprint::from(
            $config->getUrl(),
            $authorizationConfig,
            $resource,
            self::CALLBACK_URL
        );
    }
}
