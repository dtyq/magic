<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\MicroAgent;

use App\Application\ModelGateway\MicroAgent\AgentParser\AgentParserFactory;
use App\Application\ModelGateway\MicroAgent\MicroAgent;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use HyperfTest\HttpTestCase;
use ReflectionClass;

/**
 * @internal
 */
class MicroAgentFactoryTest extends HttpTestCase
{
    private MicroAgentFactory $factory;

    private AgentParserFactory $agentParserFactory;

    protected function setUp(): void
    {
        parent::setUp();

        // Use real dependencies, no mocking
        $this->agentParserFactory = new AgentParserFactory();
        $this->factory = new MicroAgentFactory($this->agentParserFactory);
    }

    public function testGetAgentCreatesAndCachesNewAgent(): void
    {
        // Use the real example agent
        $agent = $this->factory->getAgent('example');

        $this->assertInstanceOf(MicroAgent::class, $agent);
        $this->assertEquals(1, $this->factory->getCacheSize());
        $this->assertTrue($this->factory->hasAgent('example'));

        // Verify it loaded the correct configuration from example.agent.yaml
        $reflection = new ReflectionClass($agent);
        $modelIdProperty = $reflection->getProperty('modelId');
        $modelIdProperty->setAccessible(true);
        $this->assertEquals('gpt-4', $modelIdProperty->getValue($agent));

        $temperatureProperty = $reflection->getProperty('temperature');
        $temperatureProperty->setAccessible(true);
        $this->assertEquals(0.7, $temperatureProperty->getValue($agent));
    }

    public function testGetAgentReturnsCachedAgent(): void
    {
        // Get example agent twice
        $agent1 = $this->factory->getAgent('example');
        $agent2 = $this->factory->getAgent('example');

        // Should be the same instance (cached)
        $this->assertSame($agent1, $agent2);
        $this->assertEquals(1, $this->factory->getCacheSize());
    }

    public function testGetAgentConfigurationFromExample(): void
    {
        // Test that example agent has the correct configuration
        $agent = $this->factory->getAgent('example');

        $this->assertEquals('example', $agent->getName());
        $this->assertEquals('gpt-4', $agent->getModelId());
        $this->assertEquals(0.7, $agent->getTemperature());
        $this->assertTrue($agent->isEnabledModelFallbackChain());

        $systemContent = $agent->getSystemTemplate();
        $this->assertStringContainsString('{{domain}}', $systemContent);
        $this->assertStringContainsString('{{task}}', $systemContent);
    }

    public function testHasAgent(): void
    {
        $this->assertFalse($this->factory->hasAgent('non_existent'));

        // Load example agent
        $this->factory->getAgent('example');

        $this->assertTrue($this->factory->hasAgent('example'));
        $this->assertFalse($this->factory->hasAgent('non_existent_agent'));
    }

    public function testRemoveAgent(): void
    {
        // Load example agent
        $this->factory->getAgent('example');

        $this->assertTrue($this->factory->hasAgent('example'));
        $this->assertEquals(1, $this->factory->getCacheSize());

        // Remove agent
        $this->factory->removeAgent('example');

        $this->assertFalse($this->factory->hasAgent('example'));
        $this->assertEquals(0, $this->factory->getCacheSize());
    }

    public function testClearCache(): void
    {
        // Load example agent multiple times (simulating multiple different agents)
        $this->factory->getAgent('example');

        $this->assertEquals(1, $this->factory->getCacheSize());

        // Clear cache
        $this->factory->clearCache();

        $this->assertEquals(0, $this->factory->getCacheSize());
        $this->assertEmpty($this->factory->getCachedAgentNames());
    }

    public function testGetCachedAgentNames(): void
    {
        $this->assertEmpty($this->factory->getCachedAgentNames());

        // Load example agent
        $this->factory->getAgent('example');

        $cachedNames = $this->factory->getCachedAgentNames();
        $this->assertContains('example', $cachedNames);
        $this->assertCount(1, $cachedNames);
    }

    public function testReloadAgent(): void
    {
        // Get original example agent
        $originalAgent = $this->factory->getAgent('example');
        $this->assertEquals(1, $this->factory->getCacheSize());

        // Reload agent (will re-read the same file, but create new instance)
        $reloadedAgent = $this->factory->reloadAgent('example');

        // Should be a new instance but same configuration since it's the same file
        $this->assertNotSame($originalAgent, $reloadedAgent);
        $this->assertEquals(1, $this->factory->getCacheSize());

        // Both should have same configuration from example.agent.yaml
        $this->assertEquals('gpt-4', $reloadedAgent->getModelId());

        // The reloaded agent should be the new cached instance
        $cachedAgent = $this->factory->getAgent('example');
        $this->assertSame($reloadedAgent, $cachedAgent);
    }
}
