<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\MicroAgent\AgentParser;

use App\Application\ModelGateway\MicroAgent\AgentParser\AgentParserFactory;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class AgentParserFactoryTest extends TestCase
{
    private AgentParserFactory $factory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->factory = new AgentParserFactory();
    }

    public function testGetExampleAgentContent(): void
    {
        // Test getting the real example agent content
        $result = $this->factory->getAgentContent('example');

        $this->assertIsArray($result);
        $this->assertArrayHasKey('config', $result);
        $this->assertArrayHasKey('system', $result);

        // Verify example.agent.yaml configuration
        $config = $result['config'];
        $this->assertEquals('gpt-4o', $config['model_id']);
        $this->assertEquals(0.7, $config['temperature']);
        $this->assertTrue($config['enabled_model_fallback_chain']);

        // Verify system content
        $this->assertStringContainsString('You are a helpful assistant', $result['system']);
        $this->assertStringContainsString('{{domain}}', $result['system']);
        $this->assertStringContainsString('{{task}}', $result['system']);
    }

    public function testGetAgentContentFileNotFound(): void
    {
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicApiErrorCode::ValidateFailed->value);

        $this->factory->getAgentContent('non_existent_agent');
    }

    public function testGetAgentContentUnsupportedFormat(): void
    {
        // Create a temporary file with unsupported extension
        $tempFile = tempnam(sys_get_temp_dir(), 'test_agent') . '.txt';
        file_put_contents($tempFile, 'some content');

        try {
            $this->expectException(BusinessException::class);
            $this->expectExceptionCode(MagicApiErrorCode::ValidateFailed->value);

            // This should fail because we don't have a .txt parser
            $this->factory->getAgentContent(basename($tempFile, '.txt'));
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }

    public function testExampleAgentStructure(): void
    {
        // Test the example agent file structure
        $exampleResult = $this->factory->getAgentContent('example');

        // Should be valid array with config and system
        $this->assertIsArray($exampleResult);
        $this->assertArrayHasKey('config', $exampleResult);
        $this->assertArrayHasKey('system', $exampleResult);

        // Verify the specific example configuration
        $config = $exampleResult['config'];
        $this->assertEquals('gpt-4o', $config['model_id']);
        $this->assertEquals(0.7, $config['temperature']);
        $this->assertTrue($config['enabled_model_fallback_chain']);
    }

    public function testValidateExampleAgentStructure(): void
    {
        // Test that example agent file has proper structure
        $result = $this->factory->getAgentContent('example');

        // Agent should have config and system
        $this->assertArrayHasKey('config', $result, 'Agent example missing config');
        $this->assertArrayHasKey('system', $result, 'Agent example missing system');

        $config = $result['config'];

        // Agent should have these basic config keys
        $this->assertArrayHasKey('model_id', $config, 'Agent example missing model_id');
        $this->assertArrayHasKey('temperature', $config, 'Agent example missing temperature');
        $this->assertArrayHasKey('enabled_model_fallback_chain', $config, 'Agent example missing enabled_model_fallback_chain');

        // System should not be empty
        $this->assertNotEmpty($result['system'], 'Agent example has empty system content');

        // Verify specific values for example agent
        $this->assertEquals('gpt-4o', $config['model_id']);
        $this->assertEquals(0.7, $config['temperature']);
        $this->assertTrue($config['enabled_model_fallback_chain']);
        $this->assertStringContainsString('{{domain}}', $result['system']);
        $this->assertStringContainsString('{{task}}', $result['system']);
    }
}
