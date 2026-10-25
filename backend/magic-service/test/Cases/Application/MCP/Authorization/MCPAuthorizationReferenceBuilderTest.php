<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Application\MCP\Authorization;

use App\Application\MCP\Utils\MCPAuthorizationReferenceBuilder;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class MCPAuthorizationReferenceBuilderTest extends TestCase
{
    public function testBuildKeepsOnlyNonSensitiveAuthorizationReference(): void
    {
        $input = [
            'name' => 'mock-mcp',
            'type' => 'http',
            'url' => 'https://mcp.example.invalid/mcp',
            'token' => 'mock-sensitive-token',
            'headers' => [
                'Authorization' => 'Bearer mock-sensitive-token',
                'X-Mock-Header' => 'mock-value',
            ],
        ];

        $result = MCPAuthorizationReferenceBuilder::build($input, 'mock-server-code');

        $this->assertSame(2, $result['auth_type']);
        $this->assertSame('mock-server-code', $result['mcp_server_code']);
        $this->assertArrayNotHasKey('token', $result);
        $this->assertArrayNotHasKey('Authorization', $result['headers']);
        $this->assertSame('mock-value', $result['headers']['X-Mock-Header']);
        $this->assertArrayHasKey('token', $input);
        $this->assertArrayHasKey('Authorization', $input['headers']);
    }

    public function testBuildRemovesCaseInsensitiveAuthorizationHeader(): void
    {
        $result = MCPAuthorizationReferenceBuilder::build([
            'headers' => [
                'authorization' => 'Bearer mock-sensitive-token',
                'AUTHORIZATION' => 'Bearer another-mock-sensitive-token',
            ],
        ], 'mock-server-code');

        $this->assertSame([], $result['headers']);
    }
}
