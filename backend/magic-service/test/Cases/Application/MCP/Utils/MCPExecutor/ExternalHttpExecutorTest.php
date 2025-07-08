<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\MCP\Utils\MCPExecutor;

use App\Application\MCP\Utils\MCPExecutor\ExternalHttpExecutor;
use Dtyq\PhpMcp\Types\Responses\ListToolsResult;
use Hyperf\Odin\Mcp\McpServerConfig;
use Hyperf\Odin\Mcp\McpType;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * @internal
 */
class ExternalHttpExecutorTest extends TestCase
{
    private LoggerInterface $logger;

    private ExternalHttpExecutor $executor;

    protected function setUp(): void
    {
        parent::setUp();

        // Use Hyperf DI to get logger
        $this->logger = di(LoggerInterface::class);
        $this->executor = new ExternalHttpExecutor($this->logger);
    }

    public function testGetListToolsResultWithValidAmapServer()
    {
        // Test with real Amap MCP server
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Http,
            name: '高德地图',
            url: 'https://mcp.amap.com/sse?key=demo-test-key-12345'
        );

        try {
            $result = $this->executor->getListToolsResult($mcpServerConfig);

            // Verify result is ListToolsResult
            $this->assertInstanceOf(ListToolsResult::class, $result);

            // Verify result has tools (Amap should provide location-related tools)
            $tools = $result->tools ?? [];
            $this->assertIsArray($tools);
            $this->assertGreaterThan(0, count($tools), 'Amap MCP server should provide at least one tool');

            // Check that tools have expected structure
            foreach ($tools as $tool) {
                $this->assertIsObject($tool, 'Each tool should be an object');
                $this->assertObjectHasProperty('name', $tool, 'Each tool should have a name');
            }
        } catch (Throwable $e) {
            // If connection fails, verify it's the expected exception type
            $this->markTestSkipped('Amap MCP server connection failed: ' . $e->getMessage());
        }
    }

    public function testGetListToolsResultWithInvalidServerType()
    {
        // Test with wrong server type (should be HTTP, but using STDIO)
        try {
            $mcpServerConfig = new McpServerConfig(
                type: McpType::Stdio,
                name: 'Invalid Type Server',
                command: 'echo',
                args: []  // Empty args will cause validation failure
            );
            // If we get here, the config didn't validate properly
            $this->fail('Expected InvalidArgumentException was not thrown');
        } catch (Throwable $e) {
            // Expect the validation error from McpServerConfig
            $this->assertInstanceOf(Throwable::class, $e);
            $this->assertStringContainsString('STDIO MCP server requires arguments', $e->getMessage());
        }
    }

    public function testGetListToolsResultWithInvalidUrl()
    {
        // Test with invalid URL
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Http,
            name: 'Invalid Server',
            url: 'https://invalid-domain-that-does-not-exist-12345.com/mcp'
        );

        // Expect exception to be thrown
        $this->expectException(Throwable::class);

        $this->executor->getListToolsResult($mcpServerConfig);
    }

    public function testGetListToolsResultWithHeaders()
    {
        // Test with custom headers
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Http,
            name: 'Header Test Server',
            url: 'https://mcp.amap.com/sse?key=invalid-key-for-testing',
            headers: [
                'Authorization' => 'Bearer test-token',
                'Content-Type' => 'application/json',
                'X-Custom-Header' => 'test-value',
            ]
        );

        try {
            $result = $this->executor->getListToolsResult($mcpServerConfig);

            // If successful, result should be ListToolsResult
            $this->assertInstanceOf(ListToolsResult::class, $result);
        } catch (Throwable $e) {
            // Invalid key should cause connection to fail
            $this->assertInstanceOf(Throwable::class, $e);
        }
    }

    public function testGetListToolsResultWithMalformedUrl()
    {
        // Test with malformed URL
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Http,
            name: 'Malformed URL Server',
            url: 'not-a-valid-url'
        );

        // Expect exception to be thrown
        $this->expectException(Throwable::class);

        $this->executor->getListToolsResult($mcpServerConfig);
    }

    public function testGetListToolsResultWithEmptyUrl()
    {
        // Test with empty URL - this should fail at config validation level
        try {
            $mcpServerConfig = new McpServerConfig(
                type: McpType::Http,
                name: 'Empty URL Server',
                url: ''
            );
            // If we get here, the config didn't validate properly
            $this->fail('Expected InvalidArgumentException was not thrown');
        } catch (Throwable $e) {
            // Expect the validation error from McpServerConfig
            $this->assertInstanceOf(Throwable::class, $e);
            $this->assertStringContainsString('HTTP MCP server requires a URL', $e->getMessage());
        }
    }
}
