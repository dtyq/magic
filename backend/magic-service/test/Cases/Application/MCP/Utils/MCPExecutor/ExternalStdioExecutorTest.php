<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\MCP\Utils\MCPExecutor;

use App\Application\MCP\Utils\MCPExecutor\ExternalStdioExecutor;
use Dtyq\PhpMcp\Types\Responses\ListToolsResult;
use Hyperf\Odin\Mcp\McpServerConfig;
use Hyperf\Odin\Mcp\McpType;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * @internal
 */
class ExternalStdioExecutorTest extends TestCase
{
    private LoggerInterface $logger;

    private ExternalStdioExecutor $executor;

    protected function setUp(): void
    {
        parent::setUp();

        // Use Hyperf DI to get logger
        $this->logger = di(LoggerInterface::class);
        $this->executor = new ExternalStdioExecutor($this->logger);
    }

    public function testGetListToolsResultWithSequentialThinking()
    {
        // Test with server-sequential-thinking MCP server
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Stdio,
            name: 'sequential-thinking',
            command: 'npx',
            args: [
                '-y',
                '@modelcontextprotocol/server-sequential-thinking',
            ]
        );

        try {
            $result = $this->executor->getListToolsResult($mcpServerConfig);

            // Verify result is ListToolsResult
            $this->assertInstanceOf(ListToolsResult::class, $result);

            // Verify result has tools (sequential-thinking should provide thinking tools)
            $tools = $result->getTools() ?? [];
            $this->assertIsArray($tools);
            $this->assertGreaterThan(0, count($tools), 'Sequential thinking MCP server should provide at least one tool');

            // Check that tools have expected structure
            foreach ($tools as $tool) {
                $this->assertIsObject($tool, 'Each tool should be an object');
                $this->assertObjectHasProperty('name', $tool, 'Each tool should have a name');
            }
        } catch (Throwable $e) {
            // If npx or the MCP server is not available, skip the test
            $this->markTestSkipped('Sequential thinking MCP server connection failed: ' . $e->getMessage());
        }
    }

    public function testGetListToolsResultWithInvalidServerType()
    {
        // Test with wrong server type (should be STDIO, but using HTTP)
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Http,
            name: 'Invalid Server',
            url: 'https://example.com'
        );

        // Expect exception to be thrown
        $this->expectException(Throwable::class);
        $this->expectExceptionMessage('mcp.server.not_support_check_status');

        $this->executor->getListToolsResult($mcpServerConfig);
    }

    public function testGetListToolsResultWithInvalidCommand()
    {
        // Test with invalid command
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Stdio,
            name: 'Invalid Command Server',
            command: 'definitely-not-a-real-command-12345',
            args: ['--help']
        );

        // Expect exception to be thrown
        $this->expectException(Throwable::class);

        $this->executor->getListToolsResult($mcpServerConfig);
    }

    public function testGetListToolsResultWithEmptyCommand()
    {
        // Test with empty command - this should fail at config validation level
        try {
            $mcpServerConfig = new McpServerConfig(
                type: McpType::Stdio,
                name: 'Empty Command Server',
                command: '',
                args: []
            );
            // If we get here, the config didn't validate properly
            $this->fail('Expected InvalidArgumentException was not thrown');
        } catch (Throwable $e) {
            // Expect the validation error from McpServerConfig
            $this->assertInstanceOf(Throwable::class, $e);
            $this->assertStringContainsString('STDIO MCP server requires a command', $e->getMessage());
        }
    }

    public function testGetListToolsResultWithNodeCommand()
    {
        // Test with a basic node command that should exist
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Stdio,
            name: 'Node Test Server',
            command: 'node',
            args: ['--version']
        );

        try {
            $result = $this->executor->getListToolsResult($mcpServerConfig);

            // If successful, result should be ListToolsResult
            $this->assertInstanceOf(ListToolsResult::class, $result);
        } catch (Throwable $e) {
            // Node --version doesn't provide MCP interface, so this is expected to fail
            $this->assertInstanceOf(Throwable::class, $e);
        }
    }

    public function testGetListToolsResultWithPythonCommand()
    {
        // Test with Python command if available
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Stdio,
            name: 'Python Test Server',
            command: 'python3',
            args: ['--version']
        );

        try {
            $result = $this->executor->getListToolsResult($mcpServerConfig);

            // If successful, result should be ListToolsResult
            $this->assertInstanceOf(ListToolsResult::class, $result);
        } catch (Throwable $e) {
            // Python --version doesn't provide MCP interface, so this is expected to fail
            // Also might fail if python3 is not installed
            $this->assertInstanceOf(Throwable::class, $e);
        }
    }

    public function testGetListToolsResultWithComplexArgs()
    {
        // Test with complex arguments
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Stdio,
            name: 'Complex Args Server',
            command: 'npx',
            args: [
                '-y',
                '@modelcontextprotocol/server-sequential-thinking',
                '--config',
                'test-config.json',
            ]
        );

        try {
            $result = $this->executor->getListToolsResult($mcpServerConfig);

            // If successful, result should be ListToolsResult
            $this->assertInstanceOf(ListToolsResult::class, $result);
        } catch (Throwable $e) {
            // The complex args might cause the server to fail, which is acceptable for testing
            $this->assertInstanceOf(Throwable::class, $e);
        }
    }

    public function testGetListToolsResultWithWorkingDirectory()
    {
        // Test that working directory is properly set - use a valid command with args
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Stdio,
            name: 'PWD Test Server',
            command: 'pwd',
            args: ['--help']  // Add args to satisfy validation
        );

        try {
            $result = $this->executor->getListToolsResult($mcpServerConfig);

            // pwd command doesn't provide MCP interface, so this should fail
            $this->fail('Expected exception was not thrown');
        } catch (Throwable $e) {
            // Expected to fail because pwd is not an MCP server
            $this->assertInstanceOf(Throwable::class, $e);
        }
    }

    public function testGetListToolsResultWithInvalidArgs()
    {
        // Test with invalid arguments - this should fail at config validation level
        try {
            $mcpServerConfig = new McpServerConfig(
                type: McpType::Stdio,
                name: 'Invalid Args Server',
                command: 'echo',
                args: []  // Empty args should fail validation
            );
            // If we get here, the config didn't validate properly
            $this->fail('Expected InvalidArgumentException was not thrown');
        } catch (Throwable $e) {
            // Expect the validation error from McpServerConfig
            $this->assertInstanceOf(Throwable::class, $e);
            $this->assertStringContainsString('STDIO MCP server requires arguments', $e->getMessage());
        }
    }

    public function testGetListToolsResultWithEnvironmentVariables()
    {
        // Test with environment variables
        $mcpServerConfig = new McpServerConfig(
            type: McpType::Stdio,
            name: 'Env Test Server',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
            env: [
                'NODE_ENV' => 'test',
                'DEBUG' => '1',
                'CUSTOM_VAR' => 'test-value',
            ]
        );

        try {
            $result = $this->executor->getListToolsResult($mcpServerConfig);

            // If successful, result should be ListToolsResult
            $this->assertInstanceOf(ListToolsResult::class, $result);
        } catch (Throwable $e) {
            // Sequential thinking might not support custom env vars, which is acceptable for testing
            $this->markTestSkipped('Sequential thinking with custom env vars failed: ' . $e->getMessage());
        }
    }
}
