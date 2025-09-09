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
class MicroAgentIntegrationTest extends HttpTestCase
{
    private AgentParserFactory $agentParserFactory;

    private MicroAgentFactory $microAgentFactory;

    protected function setUp(): void
    {
        parent::setUp();

        // Use real dependencies, no mocking
        $this->agentParserFactory = new AgentParserFactory();
        $this->microAgentFactory = new MicroAgentFactory($this->agentParserFactory);
    }

    public function testExampleAgentLoading(): void
    {
        // Test loading the real example.agent.yaml file
        $agent = $this->microAgentFactory->getAgent('example');

        $this->assertInstanceOf(MicroAgent::class, $agent);

        // Verify agent is cached
        $this->assertTrue($this->microAgentFactory->hasAgent('example'));
        $this->assertEquals(1, $this->microAgentFactory->getCacheSize());

        // Getting the same agent should return cached instance
        $cachedAgent = $this->microAgentFactory->getAgent('example');
        $this->assertSame($agent, $cachedAgent);
    }

    public function testExampleAgentConfiguration(): void
    {
        $agent = $this->microAgentFactory->getAgent('example');

        // Verify the configuration was loaded correctly using public methods
        $this->assertEquals('example', $agent->getName());
        $this->assertEquals('gpt-4o', $agent->getModelId());
        $this->assertEquals(0.7, $agent->getTemperature());
        $this->assertTrue($agent->isEnabledModelFallbackChain());

        $systemTemplate = $agent->getSystemTemplate();

        // Verify system template contains the expected variables
        $this->assertStringContainsString('{{domain}}', $systemTemplate);
        $this->assertStringContainsString('{{task}}', $systemTemplate);
        $this->assertStringContainsString('{{guidelines}}', $systemTemplate);
        $this->assertStringContainsString('{{context}}', $systemTemplate);
        $this->assertStringContainsString('You are a helpful assistant', $systemTemplate);
    }

    public function testSystemVariableReplacement(): void
    {
        $agent = $this->microAgentFactory->getAgent('example');

        // Test variable replacement using reflection to access private method
        $reflection = new ReflectionClass($agent);
        $method = $reflection->getMethod('replaceSystemVariables');
        $method->setAccessible(true);

        $variables = [
            'domain' => 'software development',
            'task' => 'help with PHP coding',
            'guidelines' => '1. Write clean code\n2. Follow PSR standards',
            'context' => 'Working on a Hyperf project',
        ];

        $result = $method->invoke($agent, $variables);

        // Verify all variables were replaced
        $this->assertStringContainsString('specializing in software development', $result);
        $this->assertStringContainsString('help with PHP coding', $result);
        $this->assertStringContainsString('Write clean code', $result);
        $this->assertStringContainsString('Follow PSR standards', $result);
        $this->assertStringContainsString('Working on a Hyperf project', $result);

        // Verify no unreplaced variables remain
        $this->assertStringNotContainsString('{{domain}}', $result);
        $this->assertStringNotContainsString('{{task}}', $result);
        $this->assertStringNotContainsString('{{guidelines}}', $result);
        $this->assertStringNotContainsString('{{context}}', $result);
    }

    public function testPartialVariableReplacement(): void
    {
        $agent = $this->microAgentFactory->getAgent('example');

        $reflection = new ReflectionClass($agent);
        $method = $reflection->getMethod('replaceSystemVariables');
        $method->setAccessible(true);

        // Only provide some variables
        $variables = [
            'domain' => 'data science',
            'task' => 'analyze datasets',
        ];

        $result = $method->invoke($agent, $variables);

        // Verify provided variables were replaced
        $this->assertStringContainsString('specializing in data science', $result);
        $this->assertStringContainsString('analyze datasets', $result);

        // Verify unprovided variables remain as placeholders
        $this->assertStringContainsString('{{guidelines}}', $result);
        $this->assertStringContainsString('{{context}}', $result);
    }

    public function testEmptyVariableReplacement(): void
    {
        $agent = $this->microAgentFactory->getAgent('example');

        $reflection = new ReflectionClass($agent);
        $method = $reflection->getMethod('replaceSystemVariables');
        $method->setAccessible(true);

        $result = $method->invoke($agent, []);

        // Should return original template when no variables provided
        $originalTemplate = $agent->getSystemTemplate();

        $this->assertEquals($originalTemplate, $result);
    }

    public function testExampleAgentCaching(): void
    {
        // Load example agent multiple times
        $exampleAgent1 = $this->microAgentFactory->getAgent('example');
        $exampleAgent2 = $this->microAgentFactory->getAgent('example');
        $exampleAgent3 = $this->microAgentFactory->getAgent('example');

        // All should be the same cached instance
        $this->assertSame($exampleAgent1, $exampleAgent2);
        $this->assertSame($exampleAgent2, $exampleAgent3);

        // Only one agent should be cached
        $this->assertEquals(1, $this->microAgentFactory->getCacheSize());

        $cachedNames = $this->microAgentFactory->getCachedAgentNames();
        $this->assertContains('example', $cachedNames);
        $this->assertCount(1, $cachedNames);

        // Verify the cached agent has correct configuration
        $this->assertEquals('gpt-4o', $exampleAgent1->getModelId());
    }

    public function testCacheManagement(): void
    {
        // Load an agent
        $agent = $this->microAgentFactory->getAgent('example');
        $this->assertTrue($this->microAgentFactory->hasAgent('example'));

        // Remove from cache
        $this->microAgentFactory->removeAgent('example');
        $this->assertFalse($this->microAgentFactory->hasAgent('example'));
        $this->assertEquals(0, $this->microAgentFactory->getCacheSize());

        // Load again (should create new instance)
        $newAgent = $this->microAgentFactory->getAgent('example');
        $this->assertNotSame($agent, $newAgent);
        $this->assertTrue($this->microAgentFactory->hasAgent('example'));
    }

    public function testReloadAgent(): void
    {
        // Load initial agent
        $originalAgent = $this->microAgentFactory->getAgent('example');
        $this->assertEquals(1, $this->microAgentFactory->getCacheSize());

        // Reload agent (should create new instance but keep cache size)
        $reloadedAgent = $this->microAgentFactory->reloadAgent('example');

        $this->assertNotSame($originalAgent, $reloadedAgent);
        $this->assertEquals(1, $this->microAgentFactory->getCacheSize());
        $this->assertTrue($this->microAgentFactory->hasAgent('example'));

        // The reloaded agent should be the new cached instance
        $cachedAgent = $this->microAgentFactory->getAgent('example');
        $this->assertSame($reloadedAgent, $cachedAgent);
    }

    public function testAgentParserFactoryDirectly(): void
    {
        // Test the parser factory directly with the real example file
        $parsed = $this->agentParserFactory->getAgentContent('example');

        $this->assertIsArray($parsed);
        $this->assertArrayHasKey('config', $parsed);
        $this->assertArrayHasKey('system', $parsed);

        $config = $parsed['config'];
        $this->assertEquals('gpt-4o', $config['model_id']);
        $this->assertEquals(0.7, $config['temperature']);
        $this->assertTrue($config['enabled_model_fallback_chain']);

        $system = $parsed['system'];
        $this->assertStringContainsString('You are a helpful assistant', $system);
        $this->assertStringContainsString('{{domain}}', $system);
    }

    public function testRealWorldUsageScenario(): void
    {
        // Simulate a real-world usage scenario
        $agent = $this->microAgentFactory->getAgent('example');

        // Prepare realistic variables
        $variables = [
            'domain' => 'web development',
            'task' => 'create a RESTful API using PHP and Hyperf framework',
            'guidelines' => implode("\n", [
                '1. Follow RESTful conventions',
                '2. Use proper HTTP status codes',
                '3. Implement proper error handling',
                '4. Add request validation',
                '5. Use dependency injection',
            ]),
            'context' => 'Building a microservice for user management with authentication and CRUD operations',
        ];

        // Get the processed system content
        $reflection = new ReflectionClass($agent);
        $method = $reflection->getMethod('replaceSystemVariables');
        $method->setAccessible(true);

        $processedSystemContent = $method->invoke($agent, $variables);

        // Verify the result looks like what we'd expect in a real scenario
        $this->assertStringContainsString('web development', $processedSystemContent);
        $this->assertStringContainsString('RESTful API', $processedSystemContent);
        $this->assertStringContainsString('HTTP status codes', $processedSystemContent);
        $this->assertStringContainsString('microservice for user management', $processedSystemContent);

        // Verify it's properly formatted and professional
        $this->assertStringContainsString('You are a helpful assistant specializing in web development', $processedSystemContent);
        $this->assertStringContainsString('Always respond in a professional and helpful manner', $processedSystemContent);

        // Verify no template variables remain
        $this->assertStringNotContainsString('{{', $processedSystemContent);
        $this->assertStringNotContainsString('}}', $processedSystemContent);
    }
}
