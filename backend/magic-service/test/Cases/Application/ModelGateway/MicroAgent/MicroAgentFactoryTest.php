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
        $this->assertEquals('gpt-4o', $agent->getModelId());
        $this->assertEquals(0.7, $agent->getTemperature());
        $this->assertEquals(16384, $agent->getMaxTokens());
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
        $this->assertEquals('gpt-4o', $agent->getModelId());
        $this->assertEquals(0.7, $agent->getTemperature());
        $this->assertEquals(16384, $agent->getMaxTokens());
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
        $this->assertEquals('gpt-4o', $reloadedAgent->getModelId());
        $this->assertEquals(16384, $reloadedAgent->getMaxTokens());

        // The reloaded agent should be the new cached instance
        $cachedAgent = $this->factory->getAgent('example');
        $this->assertSame($reloadedAgent, $cachedAgent);
    }

    public function testMaxTokensFromConfiguration(): void
    {
        // Test that maxTokens is correctly parsed from configuration
        $agent = $this->factory->getAgent('example');

        // Should get maxTokens from example.agent.yaml
        $this->assertEquals(16384, $agent->getMaxTokens());
        $this->assertIsInt($agent->getMaxTokens());
    }

    public function testMaxTokensDefaultAndBoundaryValues(): void
    {
        // Create temporary YAML files to test different max_tokens scenarios
        $testCases = [
            // [yamlContent, expectedMaxTokens, description]
            ['max_tokens: 0', 0, 'zero value'],
            ['max_tokens: 8192', 8192, 'positive value'],
            ['max_tokens: -100', 0, 'negative value (should be clamped to 0)'],
            ['max_tokens: "2048"', 2048, 'string number'],
            ['', 0, 'missing max_tokens (should use factory default)'],
        ];

        foreach ($testCases as [$maxTokensLine, $expectedValue, $description]) {
            $yamlContent = <<<YAML
---
model_id: test-model
temperature: 0.7
{$maxTokensLine}
enabled_model_fallback_chain: true
---
system: |
  Test system content
YAML;

            $tempFile = tempnam(sys_get_temp_dir(), 'test_agent_') . '.agent.yaml';
            file_put_contents($tempFile, $yamlContent);

            try {
                $agent = $this->agentParserFactory->getAgentContentFromFile($tempFile);
                $testAgent = new MicroAgent(
                    name: 'test',
                    modelId: $agent['config']['model_id'] ?? '',
                    systemTemplate: $agent['system'],
                    temperature: $agent['config']['temperature'] ?? 0.7,
                    maxTokens: max(0, (int) ($agent['config']['max_tokens'] ?? 0)),
                    enabledModelFallbackChain: $agent['config']['enabled_model_fallback_chain'] ?? true,
                );

                $this->assertEquals($expectedValue, $testAgent->getMaxTokens(), "Failed for case: {$description}");
                $this->assertGreaterThanOrEqual(0, $testAgent->getMaxTokens(), 'maxTokens should never be negative');
            } finally {
                if (file_exists($tempFile)) {
                    unlink($tempFile);
                }
            }
        }
    }

    public function testEasyCall()
    {
        $this->markTestSkipped('Requires actual API calls and valid configuration.');
        $example = $this->factory->getAgent('example');
        $response = $example->easyCall(organizationCode: 'DT001', userPrompt: '你好', businessParams: [
            'organization_id' => 'DT001',
            'user_id' => 'user_123456',
        ]);
        var_dump($response);
        $this->assertNotEmpty($response);
    }
}
