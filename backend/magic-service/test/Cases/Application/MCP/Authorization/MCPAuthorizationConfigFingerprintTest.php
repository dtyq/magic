<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\MCP\Authorization;

use App\Application\MCP\Authorization\MCPAuthorizationConfigFingerprint;
use App\Domain\MCP\Entity\ValueObject\Authorization\MCPAuthorizationConfig;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class MCPAuthorizationConfigFingerprintTest extends TestCase
{
    public function testSameAuthFieldsProduceSameFingerprint(): void
    {
        $first = MCPAuthorizationConfigFingerprint::from(
            'https://mcp.example.com/mcp',
            $this->createConfig(),
            'https://mcp.example.com/mcp',
            'https://magic.example.com/callback'
        );
        $second = MCPAuthorizationConfigFingerprint::from(
            'https://mcp.example.com/mcp',
            $this->createConfig(),
            'https://mcp.example.com/mcp',
            'https://magic.example.com/callback'
        );

        $this->assertSame($first, $second);
        $this->assertNotSame('', $first);
    }

    public function testServiceUrlChangeProducesDifferentFingerprint(): void
    {
        $original = MCPAuthorizationConfigFingerprint::from(
            'https://mcp.example.com/mcp',
            $this->createConfig(),
            'https://mcp.example.com/mcp',
            'https://magic.example.com/callback'
        );
        $updated = MCPAuthorizationConfigFingerprint::from(
            'https://mcp-v2.example.com/mcp',
            $this->createConfig(),
            'https://mcp-v2.example.com/mcp',
            'https://magic.example.com/callback'
        );

        $this->assertNotSame($original, $updated);
    }

    public function testAuthorizationEndpointChangeProducesDifferentFingerprint(): void
    {
        $originalConfig = $this->createConfig();
        $updatedConfig = $this->createConfig();
        $updatedConfig->setAuthorizationEndpoint('https://auth-v2.example.com/authorize');

        $original = MCPAuthorizationConfigFingerprint::from(
            'https://mcp.example.com/mcp',
            $originalConfig,
            'https://mcp.example.com/mcp',
            'https://magic.example.com/callback'
        );
        $updated = MCPAuthorizationConfigFingerprint::from(
            'https://mcp.example.com/mcp',
            $updatedConfig,
            'https://mcp.example.com/mcp',
            'https://magic.example.com/callback'
        );

        $this->assertNotSame($original, $updated);
    }

    public function testMatchesRequiresStoredFingerprint(): void
    {
        $fingerprint = MCPAuthorizationConfigFingerprint::from(
            'https://mcp.example.com/mcp',
            $this->createConfig(),
            'https://mcp.example.com/mcp',
            'https://magic.example.com/callback'
        );

        $this->assertTrue(MCPAuthorizationConfigFingerprint::matches([
            'config_fingerprint' => $fingerprint,
        ], $fingerprint));
        $this->assertFalse(MCPAuthorizationConfigFingerprint::matches([], $fingerprint));
        $this->assertFalse(MCPAuthorizationConfigFingerprint::matches([
            'config_fingerprint' => 'stale',
        ], $fingerprint));
    }

    private function createConfig(): MCPAuthorizationConfig
    {
        $config = new MCPAuthorizationConfig();
        $config->setAuthorizationEndpoint('https://auth.example.com/authorize');
        $config->setTokenEndpoint('https://auth.example.com/token');
        $config->setRegistrationMode('pre_registered');
        $config->setClientId('mock-client-id');
        return $config;
    }
}
