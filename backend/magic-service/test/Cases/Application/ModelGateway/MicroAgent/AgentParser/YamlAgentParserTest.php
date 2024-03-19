<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\MicroAgent\AgentParser;

use App\Application\ModelGateway\MicroAgent\AgentParser\YamlAgentParser;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class YamlAgentParserTest extends TestCase
{
    private YamlAgentParser $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new YamlAgentParser();
    }

    public function testGetSupportedExtensions(): void
    {
        $extensions = $this->parser->getSupportedExtensions();

        $this->assertIsArray($extensions);
        $this->assertContains('agent.yaml', $extensions);
        $this->assertContains('agent.yml', $extensions);
    }

    public function testSupports(): void
    {
        $this->assertTrue($this->parser->supports('agent.yaml'));
        $this->assertTrue($this->parser->supports('agent.yml'));
        $this->assertFalse($this->parser->supports('agent.json'));
        $this->assertFalse($this->parser->supports('txt'));
    }

    public function testLoadFromExampleFile(): void
    {
        // Use the real example.agent.yaml file
        $exampleFile = BASE_PATH . '/app/Application/ModelGateway/MicroAgent/Prompt/example.agent.yaml';

        $result = $this->parser->loadFromFile($exampleFile);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('config', $result);
        $this->assertArrayHasKey('system', $result);

        // Test config values from example.agent.yaml
        $config = $result['config'];
        $this->assertEquals('gpt-4o', $config['model_id']);
        $this->assertEquals(0.7, $config['temperature']);
        $this->assertEquals(16384, $config['max_tokens']);
        $this->assertTrue($config['enabled_model_fallback_chain']);

        // Test system content from example.agent.yaml
        $this->assertStringContainsString('You are a helpful assistant', $result['system']);
        $this->assertStringContainsString('{{domain}}', $result['system']);
        $this->assertStringContainsString('{{task}}', $result['system']);
        $this->assertStringContainsString('{{guidelines}}', $result['system']);
        $this->assertStringContainsString('{{context}}', $result['system']);
    }

    public function testLoadFromFileNotFound(): void
    {
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(MagicApiErrorCode::ValidateFailed->value);

        $this->parser->loadFromFile('/non/existent/file.agent.yaml');
    }

    public function testLoadFromInvalidFormatFile(): void
    {
        // Create a file without --- separator
        $tempFile = tempnam(sys_get_temp_dir(), 'invalid_agent_') . '.agent.yaml';
        file_put_contents($tempFile, 'This is not a valid agent file');

        try {
            $this->expectException(BusinessException::class);
            $this->expectExceptionCode(MagicApiErrorCode::ValidateFailed->value);

            $this->parser->loadFromFile($tempFile);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }

    public function testParseExampleConfiguration(): void
    {
        // Test parsing the real example.agent.yaml configuration
        $exampleFile = BASE_PATH . '/app/Application/ModelGateway/MicroAgent/Prompt/example.agent.yaml';

        $result = $this->parser->loadFromFile($exampleFile);
        $config = $result['config'];

        // Verify the actual example configuration values
        $this->assertEquals('gpt-4o', $config['model_id']);
        $this->assertEquals(0.7, $config['temperature']);
        $this->assertEquals(16384, $config['max_tokens']);
        $this->assertTrue($config['enabled_model_fallback_chain']);
    }

    public function testParseExampleSystemContentWithVariables(): void
    {
        $exampleFile = BASE_PATH . '/app/Application/ModelGateway/MicroAgent/Prompt/example.agent.yaml';

        $result = $this->parser->loadFromFile($exampleFile);
        $systemContent = $result['system'];

        // Verify all variables from example.agent.yaml are present
        $this->assertStringContainsString('{{domain}}', $systemContent);
        $this->assertStringContainsString('{{task}}', $systemContent);
        $this->assertStringContainsString('{{guidelines}}', $systemContent);
        $this->assertStringContainsString('{{context}}', $systemContent);
        $this->assertStringContainsString('Always respond in a professional and helpful manner', $systemContent);
    }

    public function testLoadFromExampleAgentComprehensive(): void
    {
        $basePath = BASE_PATH . '/app/Application/ModelGateway/MicroAgent/Prompt';

        // Test example.agent.yaml in detail
        $exampleResult = $this->parser->loadFromFile($basePath . '/example.agent.yaml');
        $this->assertIsArray($exampleResult);
        $this->assertArrayHasKey('config', $exampleResult);
        $this->assertArrayHasKey('system', $exampleResult);

        // Verify configuration
        $this->assertEquals('gpt-4o', $exampleResult['config']['model_id']);
        $this->assertEquals(0.7, $exampleResult['config']['temperature']);
        $this->assertEquals(16384, $exampleResult['config']['max_tokens']);
        $this->assertTrue($exampleResult['config']['enabled_model_fallback_chain']);

        // Verify system content has all expected variables
        $systemContent = $exampleResult['system'];
        $this->assertStringContainsString('{{domain}}', $systemContent);
        $this->assertStringContainsString('{{task}}', $systemContent);
        $this->assertStringContainsString('{{guidelines}}', $systemContent);
        $this->assertStringContainsString('{{context}}', $systemContent);
        $this->assertStringContainsString('You are a helpful assistant', $systemContent);
        $this->assertStringContainsString('Always respond in a professional and helpful manner', $systemContent);
    }

    public function testParseMaxTokensTypeConversion(): void
    {
        // Create temporary file with different max_tokens values
        $testCases = [
            ['max_tokens: 8192', 8192],
            ['max_tokens: "4096"', 4096], // String number
            ['max_tokens: 0', 0],
            ['max_tokens: -100', -100], // Will be handled by factory
            ['max_tokens: 1.5', 1.5], // Float value (will be converted to int by factory)
        ];

        foreach ($testCases as [$configLine, $expectedValue]) {
            $yamlContent = <<<YAML
---
model_id: test-model
temperature: 0.5
{$configLine}
enabled_model_fallback_chain: true
---
system: |
  Test system content
YAML;

            $tempFile = tempnam(sys_get_temp_dir(), 'test_agent_') . '.agent.yaml';
            file_put_contents($tempFile, $yamlContent);

            try {
                $result = $this->parser->loadFromFile($tempFile);
                $this->assertEquals($expectedValue, $result['config']['max_tokens']);

                // Type check: should be int or float for numeric values
                if (is_numeric($expectedValue)) {
                    $this->assertTrue(
                        is_int($result['config']['max_tokens']) || is_float($result['config']['max_tokens']),
                        'max_tokens should be int or float for numeric values'
                    );
                }
            } finally {
                if (file_exists($tempFile)) {
                    unlink($tempFile);
                }
            }
        }
    }

    public function testParseConfigurationWithMissingMaxTokens(): void
    {
        // Test YAML without max_tokens
        $yamlContent = <<<'YAML'
---
model_id: test-model
temperature: 0.5
enabled_model_fallback_chain: true
---
system: |
  Test system content
YAML;

        $tempFile = tempnam(sys_get_temp_dir(), 'test_agent_') . '.agent.yaml';
        file_put_contents($tempFile, $yamlContent);

        try {
            $result = $this->parser->loadFromFile($tempFile);

            // Should not have max_tokens key when not specified in YAML
            $this->assertArrayNotHasKey('max_tokens', $result['config']);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }
}
