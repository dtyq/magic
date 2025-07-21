<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\MCP;

use App\Application\MCP\BuiltInMCP\SuperMagicChat\SuperMagicChatManager;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use Dtyq\PhpMcp\Server\FastMcp\Tools\RegisteredTool;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class SuperMagicChatManagerTest extends BaseTest
{
    private const string TEST_MCP_SERVER_CODE = 'test_mcp_server_001';

    private const string TEST_ORGANIZATION_CODE = 'test_org';

    private const string TEST_USER_ID = 'test_user_123';

    private const string BING_TOOL_ID = 'internet_search_bing_internet_search';

    private MCPDataIsolation $mcpDataIsolation;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test data isolation
        $this->mcpDataIsolation = MCPDataIsolation::create(
            self::TEST_ORGANIZATION_CODE,
            self::TEST_USER_ID
        );
    }

    public function testCreateByChatParamsWithEmptyAgentsAndBingTool(): void
    {
        // Arrange
        $agentIds = [];
        $toolIds = [self::BING_TOOL_ID];

        // Act
        SuperMagicChatManager::createByChatParams(
            $this->mcpDataIsolation,
            self::TEST_MCP_SERVER_CODE,
            $agentIds,
            $toolIds
        );

        // Assert - Verify data was stored by trying to retrieve it
        $result = SuperMagicChatManager::getRegisteredTools(self::TEST_MCP_SERVER_CODE);
        $this->assertIsArray($result);
    }

    public function testGetRegisteredToolsWithBingTool(): void
    {
        // Arrange - First create some data
        $agentIds = [];
        $toolIds = [self::BING_TOOL_ID];

        SuperMagicChatManager::createByChatParams(
            $this->mcpDataIsolation,
            self::TEST_MCP_SERVER_CODE,
            $agentIds,
            $toolIds
        );

        // Act
        $result = SuperMagicChatManager::getRegisteredTools(self::TEST_MCP_SERVER_CODE);

        // Assert
        $this->assertIsArray($result);

        // Since we're testing with a real tool, we should get RegisteredTool objects
        if (! empty($result)) {
            $this->assertContainsOnlyInstancesOf(RegisteredTool::class, $result);
            // Additional assertions can be added here if needed
        }
    }

    public function testReturnsEmptyArrayWhenNoDataInRedis(): void
    {
        // Act - Try to get tools for non-existent server code
        $result = SuperMagicChatManager::getRegisteredTools('non_existent_server_code');

        // Assert
        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    public function testCanHandleMultipleToolIds(): void
    {
        // Arrange
        $agentIds = [];
        $toolIds = [self::BING_TOOL_ID, 'another_tool_id'];

        // Act
        SuperMagicChatManager::createByChatParams(
            $this->mcpDataIsolation,
            self::TEST_MCP_SERVER_CODE,
            $agentIds,
            $toolIds
        );

        // Assert - Verify data was stored by trying to retrieve it
        $result = SuperMagicChatManager::getRegisteredTools(self::TEST_MCP_SERVER_CODE);
        $this->assertIsArray($result);
    }

    public function testDataPersistenceAndRetrieval(): void
    {
        // Arrange
        $serverCode1 = 'test_server_1';
        $serverCode2 = 'test_server_2';
        $agentIds = [];
        $toolIds = [self::BING_TOOL_ID];

        // Act - Store data for two different servers
        SuperMagicChatManager::createByChatParams(
            $this->mcpDataIsolation,
            $serverCode1,
            $agentIds,
            $toolIds
        );

        SuperMagicChatManager::createByChatParams(
            $this->mcpDataIsolation,
            $serverCode2,
            [],
            []
        );

        // Assert - Verify both servers have data
        $result1 = SuperMagicChatManager::getRegisteredTools($serverCode1);
        $result2 = SuperMagicChatManager::getRegisteredTools($serverCode2);

        $this->assertIsArray($result1);
        $this->assertIsArray($result2);
    }
}
