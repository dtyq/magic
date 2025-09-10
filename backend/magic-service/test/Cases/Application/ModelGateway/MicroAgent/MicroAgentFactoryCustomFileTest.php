<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\MicroAgent;

use App\Application\ModelGateway\MicroAgent\AgentParser\AgentParserFactory;
use App\Application\ModelGateway\MicroAgent\MicroAgent;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Infrastructure\Core\Exception\BusinessException;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class MicroAgentFactoryCustomFileTest extends HttpTestCase
{
    private MicroAgentFactory $microAgentFactory;

    private AgentParserFactory $agentParserFactory;

    private string $testAgentFile;

    private string $testAgentFile2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->agentParserFactory = new AgentParserFactory();
        $this->microAgentFactory = new MicroAgentFactory($this->agentParserFactory);

        // Create test agent files
        $this->testAgentFile = BASE_PATH . '/runtime/test_custom_agent.agent.yaml';
        $this->testAgentFile2 = BASE_PATH . '/runtime/test_custom_agent2.agent.yaml';

        // Ensure runtime directory exists
        if (! is_dir(BASE_PATH . '/runtime')) {
            mkdir(BASE_PATH . '/runtime', 0755, true);
        }

        $testContent = <<<'YAML'
---
model_id: gpt-3.5-turbo
temperature: 0.5
enabled_model_fallback_chain: false
---
system: |
  You are a custom test agent for unit testing.
  Your name is: {{agent_name}}
  Your task is: {{task}}
YAML;
        file_put_contents($this->testAgentFile, $testContent);

        $testContent2 = <<<'YAML'
---
model_id: gpt-4
temperature: 0.8
enabled_model_fallback_chain: true
---
system: |
  You are a second custom test agent.
  Your capabilities include: {{capabilities}}
YAML;
        file_put_contents($this->testAgentFile2, $testContent2);
    }

    protected function tearDown(): void
    {
        // Clean up test files
        if (file_exists($this->testAgentFile)) {
            unlink($this->testAgentFile);
        }
        if (file_exists($this->testAgentFile2)) {
            unlink($this->testAgentFile2);
        }

        parent::tearDown();
    }

    public function testGetAgentWithCustomFilePath()
    {
        // Test creating agent with custom file path
        $agent = $this->microAgentFactory->getAgent('custom_test_agent', $this->testAgentFile);

        $this->assertInstanceOf(MicroAgent::class, $agent);
        $this->assertEquals('custom_test_agent', $agent->getName());
        $this->assertEquals('gpt-3.5-turbo', $agent->getModelId());
        $this->assertEquals(0.5, $agent->getTemperature());
        $this->assertFalse($agent->isEnabledModelFallbackChain());
        $this->assertStringContainsString('custom test agent', $agent->getSystemTemplate());
    }

    public function testGetAgentWithoutFilePathUsesOriginalLogic()
    {
        // Test that without filePath, it still uses the original logic
        $agent = $this->microAgentFactory->getAgent('example');

        $this->assertInstanceOf(MicroAgent::class, $agent);
        $this->assertEquals('example', $agent->getName());
        // Should use the example.agent.yaml file
        $this->assertEquals('gpt-4o', $agent->getModelId());
    }

    public function testGetAgentCachingWithCustomFilePath()
    {
        // First call
        $agent1 = $this->microAgentFactory->getAgent('test_agent', $this->testAgentFile);

        // Second call should return cached instance
        $agent2 = $this->microAgentFactory->getAgent('test_agent', $this->testAgentFile);

        $this->assertSame($agent1, $agent2);
    }

    public function testGetAgentCachingWithDifferentFilePaths()
    {
        // Create two agents with same name but different file paths
        $agent1 = $this->microAgentFactory->getAgent('test_agent', $this->testAgentFile);
        $agent2 = $this->microAgentFactory->getAgent('test_agent', $this->testAgentFile2);

        // Should be different instances
        $this->assertNotSame($agent1, $agent2);
        $this->assertEquals('gpt-3.5-turbo', $agent1->getModelId());
        $this->assertEquals('gpt-4', $agent2->getModelId());
    }

    public function testHasAgentWithCustomFilePath()
    {
        $this->assertFalse($this->microAgentFactory->hasAgent('test_agent', $this->testAgentFile));

        $this->microAgentFactory->getAgent('test_agent', $this->testAgentFile);

        $this->assertTrue($this->microAgentFactory->hasAgent('test_agent', $this->testAgentFile));
    }

    public function testHasAgentWithDifferentFilePaths()
    {
        $this->microAgentFactory->getAgent('test_agent', $this->testAgentFile);

        // Should not have the same name with different file path
        $this->assertFalse($this->microAgentFactory->hasAgent('test_agent', $this->testAgentFile2));
        $this->assertFalse($this->microAgentFactory->hasAgent('test_agent'));
    }

    public function testRemoveAgentWithCustomFilePath()
    {
        $this->microAgentFactory->getAgent('test_agent', $this->testAgentFile);
        $this->assertTrue($this->microAgentFactory->hasAgent('test_agent', $this->testAgentFile));

        $this->microAgentFactory->removeAgent('test_agent', $this->testAgentFile);
        $this->assertFalse($this->microAgentFactory->hasAgent('test_agent', $this->testAgentFile));
    }

    public function testRemoveAgentWithDifferentFilePathsAreIndependent()
    {
        $this->microAgentFactory->getAgent('test_agent', $this->testAgentFile);
        $this->microAgentFactory->getAgent('test_agent', $this->testAgentFile2);

        $this->microAgentFactory->removeAgent('test_agent', $this->testAgentFile);

        // Should only remove the specific file path
        $this->assertFalse($this->microAgentFactory->hasAgent('test_agent', $this->testAgentFile));
        $this->assertTrue($this->microAgentFactory->hasAgent('test_agent', $this->testAgentFile2));
    }

    public function testReloadAgentWithCustomFilePath()
    {
        // Create initial agent
        $agent1 = $this->microAgentFactory->getAgent('test_agent', $this->testAgentFile);
        $this->assertEquals('gpt-3.5-turbo', $agent1->getModelId());

        // Modify the test file
        $modifiedContent = <<<'YAML'
---
model_id: gpt-4-turbo
temperature: 0.9
enabled_model_fallback_chain: true
---
system: |
  You are a modified test agent.
YAML;
        file_put_contents($this->testAgentFile, $modifiedContent);

        // Reload should get new configuration
        $agent2 = $this->microAgentFactory->reloadAgent('test_agent', $this->testAgentFile);

        $this->assertNotSame($agent1, $agent2);
        $this->assertEquals('gpt-4-turbo', $agent2->getModelId());
        $this->assertEquals(0.9, $agent2->getTemperature());
        $this->assertTrue($agent2->isEnabledModelFallbackChain());
    }

    public function testGetAgentWithNonExistentFileThrowsException()
    {
        $this->expectException(BusinessException::class);

        $nonExistentFile = BASE_PATH . '/runtime/non_existent.agent.yaml';
        $this->microAgentFactory->getAgent('non_existent_agent', $nonExistentFile);
    }

    public function testClearCacheRemovesAllAgents()
    {
        $this->microAgentFactory->getAgent('agent1', $this->testAgentFile);
        $this->microAgentFactory->getAgent('agent2', $this->testAgentFile2);
        $this->microAgentFactory->getAgent('example');

        $this->assertEquals(3, $this->microAgentFactory->getCacheSize());

        $this->microAgentFactory->clearCache();

        $this->assertEquals(0, $this->microAgentFactory->getCacheSize());
        $this->assertFalse($this->microAgentFactory->hasAgent('agent1', $this->testAgentFile));
        $this->assertFalse($this->microAgentFactory->hasAgent('agent2', $this->testAgentFile2));
        $this->assertFalse($this->microAgentFactory->hasAgent('example'));
    }

    public function testGetCachedAgentNamesIncludesCustomFilePaths()
    {
        $this->microAgentFactory->getAgent('agent1', $this->testAgentFile);
        $this->microAgentFactory->getAgent('agent2', $this->testAgentFile2);
        $this->microAgentFactory->getAgent('example');

        $cachedNames = $this->microAgentFactory->getCachedAgentNames();

        $this->assertCount(3, $cachedNames);
        $this->assertContains($this->testAgentFile, $cachedNames);
        $this->assertContains($this->testAgentFile2, $cachedNames);
        $this->assertContains('example', $cachedNames);
    }
}
