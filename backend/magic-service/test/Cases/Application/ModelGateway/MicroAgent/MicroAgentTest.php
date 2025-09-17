<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\MicroAgent;

use App\Application\ModelGateway\MicroAgent\AgentParser\AgentParserFactory;
use App\Application\ModelGateway\MicroAgent\MicroAgent;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use HyperfTest\HttpTestCase;
use ReflectionClass;

/**
 * @internal
 */
class MicroAgentTest extends HttpTestCase
{
    private MicroAgent $agent;

    private MicroAgentFactory $microAgentFactory;

    protected function setUp(): void
    {
        parent::setUp();

        // Create MicroAgent with test data for basic tests
        $this->agent = new MicroAgent(
            name: 'test_agent',
            modelId: 'gpt-4',
            systemTemplate: 'You are a {{role}} assistant. Your task is to {{task}}.',
            temperature: 0.8,
            maxTokens: 8192,
            enabledModelFallbackChain: true
        );

        // Create factory for real file tests
        $this->microAgentFactory = new MicroAgentFactory(new AgentParserFactory());
    }

    public function testConstructor(): void
    {
        $agent = new MicroAgent(
            name: 'test',
            modelId: 'gpt-3.5-turbo',
            systemTemplate: 'Test template',
            temperature: 0.5,
            maxTokens: 4096,
            enabledModelFallbackChain: false
        );

        // Test that constructor sets properties correctly
        $this->assertEquals('test', $agent->getName());
        $this->assertEquals('gpt-3.5-turbo', $agent->getModelId());
        $this->assertEquals(0.5, $agent->getTemperature());
        $this->assertEquals(4096, $agent->getMaxTokens());
        $this->assertFalse($agent->isEnabledModelFallbackChain());
    }

    public function testReplaceSystemVariables(): void
    {
        // Use reflection to test private method
        $reflection = new ReflectionClass($this->agent);
        $method = $reflection->getMethod('replaceSystemVariables');
        $method->setAccessible(true);

        $variables = [
            'role' => 'coding',
            'task' => 'help with PHP development',
        ];

        $result = $method->invoke($this->agent, $variables);

        $this->assertEquals(
            'You are a coding assistant. Your task is to help with PHP development.',
            $result
        );
    }

    public function testReplaceSystemVariablesWithEmpty(): void
    {
        $reflection = new ReflectionClass($this->agent);
        $method = $reflection->getMethod('replaceSystemVariables');
        $method->setAccessible(true);

        $result = $method->invoke($this->agent, []);

        // Should return original template when no variables provided
        $this->assertEquals(
            'You are a {{role}} assistant. Your task is to {{task}}.',
            $result
        );
    }

    public function testReplaceSystemVariablesPartial(): void
    {
        $reflection = new ReflectionClass($this->agent);
        $method = $reflection->getMethod('replaceSystemVariables');
        $method->setAccessible(true);

        $variables = ['role' => 'translation'];

        $result = $method->invoke($this->agent, $variables);

        // Should replace only the provided variable
        $this->assertEquals(
            'You are a translation assistant. Your task is to {{task}}.',
            $result
        );
    }

    public function testReplaceSystemVariablesSpecialCharacters(): void
    {
        $agent = new MicroAgent(
            name: 'test',
            modelId: 'gpt-4',
            systemTemplate: 'Test {{special}} content with {{regex}} patterns.',
            temperature: 0.7,
            enabledModelFallbackChain: true
        );

        $reflection = new ReflectionClass($agent);
        $method = $reflection->getMethod('replaceSystemVariables');
        $method->setAccessible(true);

        $variables = [
            'special' => 'content+with*special[chars]',
            'regex' => 'pattern.with^special$chars',
        ];

        $result = $method->invoke($agent, $variables);

        $this->assertEquals(
            'Test content+with*special[chars] content with pattern.with^special$chars patterns.',
            $result
        );
    }

    public function testEasyCallWithEmptySystemThrowsException(): void
    {
        $agentWithEmptySystem = new MicroAgent(
            name: 'empty_test',
            modelId: 'gpt-4',
            systemTemplate: '', // Empty system template
            temperature: 0.7,
            enabledModelFallbackChain: true
        );

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicApiErrorCode::ValidateFailed->value);

        // Mock the dependencies that would be called via di()
        // Note: In a real test, you'd want to mock these dependencies properly
        $agentWithEmptySystem->easyCall('ORG001', [], 'test prompt');
    }

    public function testGetResolvedModelIdWithFallbackDisabled(): void
    {
        $agent = new MicroAgent(
            name: 'test',
            modelId: 'claude-3',
            systemTemplate: 'test',
            temperature: 0.7,
            enabledModelFallbackChain: false // Disabled
        );

        $reflection = new ReflectionClass($agent);
        $method = $reflection->getMethod('getResolvedModelId');
        $method->setAccessible(true);

        $result = $method->invoke($agent, 'ORG001');

        // Should return original model ID when fallback is disabled
        $this->assertEquals('claude-3', $result);
    }

    public function testDefaultValues(): void
    {
        $agent = new MicroAgent(name: 'minimal_test');

        $this->assertEquals('minimal_test', $agent->getName());
        $this->assertEquals('', $agent->getModelId());
        $this->assertEquals(0.7, $agent->getTemperature());
        $this->assertEquals(0, $agent->getMaxTokens());
        $this->assertTrue($agent->isEnabledModelFallbackChain());
        $this->assertEquals('', $agent->getSystemTemplate());
    }

    public function testExampleAgentVariableReplacement(): void
    {
        // Test variable replacement with real example agent
        $exampleAgent = $this->microAgentFactory->getAgent('example');

        $reflection = new ReflectionClass($exampleAgent);
        $method = $reflection->getMethod('replaceSystemVariables');
        $method->setAccessible(true);

        $variables = [
            'domain' => 'software development',
            'task' => 'help with PHP coding',
            'guidelines' => 'Follow PSR standards',
            'context' => 'Working on a web application',
        ];

        $result = $method->invoke($exampleAgent, $variables);

        // Verify all variables were replaced
        $this->assertStringContainsString('specializing in software development', $result);
        $this->assertStringContainsString('help with PHP coding', $result);
        $this->assertStringContainsString('Follow PSR standards', $result);
        $this->assertStringContainsString('Working on a web application', $result);

        // Verify no unreplaced variables remain
        $this->assertStringNotContainsString('{{domain}}', $result);
        $this->assertStringNotContainsString('{{task}}', $result);
        $this->assertStringNotContainsString('{{guidelines}}', $result);
        $this->assertStringNotContainsString('{{context}}', $result);
    }

    public function testMaxTokensConfiguration(): void
    {
        // Test maxTokens with different values
        $agent1 = new MicroAgent(name: 'test1', maxTokens: 2048);
        $this->assertEquals(2048, $agent1->getMaxTokens());

        $agent2 = new MicroAgent(name: 'test2', maxTokens: 0);
        $this->assertEquals(0, $agent2->getMaxTokens());

        // Test with default value
        $agent3 = new MicroAgent(name: 'test3');
        $this->assertEquals(0, $agent3->getMaxTokens());
    }

    public function testExampleAgentConfiguration(): void
    {
        // Test that example agent loads with correct configuration
        $exampleAgent = $this->microAgentFactory->getAgent('example');

        $this->assertEquals('example', $exampleAgent->getName());
        $this->assertEquals('gpt-4o', $exampleAgent->getModelId());
        $this->assertEquals(0.7, $exampleAgent->getTemperature());
        $this->assertEquals(16384, $exampleAgent->getMaxTokens()); // From example.agent.yaml
        $this->assertTrue($exampleAgent->isEnabledModelFallbackChain());

        // Test system template contains expected variables
        $systemTemplate = $exampleAgent->getSystemTemplate();
        $this->assertStringContainsString('{{domain}}', $systemTemplate);
        $this->assertStringContainsString('{{task}}', $systemTemplate);
        $this->assertStringContainsString('{{guidelines}}', $systemTemplate);
        $this->assertStringContainsString('{{context}}', $systemTemplate);
    }

    public function testExampleAgentProperties(): void
    {
        // Test example agent properties in detail
        $exampleAgent = $this->microAgentFactory->getAgent('example');

        // Verify name
        $this->assertEquals('example', $exampleAgent->getName());

        // Verify system template content
        $exampleSystem = $exampleAgent->getSystemTemplate();

        // Should contain all expected content
        $this->assertStringContainsString('You are a helpful assistant', $exampleSystem);
        $this->assertStringContainsString('{{domain}}', $exampleSystem);
        $this->assertStringContainsString('{{task}}', $exampleSystem);
        $this->assertStringContainsString('{{guidelines}}', $exampleSystem);
        $this->assertStringContainsString('{{context}}', $exampleSystem);
        $this->assertStringContainsString('Always respond in a professional and helpful manner', $exampleSystem);

        // System should not be empty
        $this->assertNotEmpty($exampleSystem);
    }
}
