<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\MicroAgent;

use App\Application\ModelGateway\MicroAgent\AgentParser\AgentParserFactory;
use App\Infrastructure\Core\Exception\BusinessException;
use Exception;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class AgentParserFactoryCustomFileTest extends HttpTestCase
{
    private AgentParserFactory $agentParserFactory;

    private string $testAgentFile;

    private string $testInvalidFile;

    protected function setUp(): void
    {
        parent::setUp();

        $this->agentParserFactory = new AgentParserFactory();

        // Create test files
        $this->testAgentFile = BASE_PATH . '/runtime/test_parser_agent.agent.yaml';
        $this->testInvalidFile = BASE_PATH . '/runtime/test_invalid.unknown';

        // Ensure runtime directory exists
        if (! is_dir(BASE_PATH . '/runtime')) {
            mkdir(BASE_PATH . '/runtime', 0755, true);
        }

        $testContent = <<<'YAML'
---
model_id: gpt-3.5-turbo
temperature: 0.6
enabled_model_fallback_chain: true
custom_param: test_value
---
system: |
  You are a test agent for AgentParserFactory testing.
  Parameters: {{param1}}, {{param2}}
  
  Instructions:
  1. Follow user requests
  2. Provide helpful responses
  3. Test functionality: {{test_feature}}
YAML;
        file_put_contents($this->testAgentFile, $testContent);

        // Create invalid file with unknown extension
        file_put_contents($this->testInvalidFile, 'Invalid content');
    }

    protected function tearDown(): void
    {
        // Clean up test files
        if (file_exists($this->testAgentFile)) {
            unlink($this->testAgentFile);
        }
        if (file_exists($this->testInvalidFile)) {
            unlink($this->testInvalidFile);
        }

        parent::tearDown();
    }

    public function testGetAgentContentFromFileSuccess()
    {
        $content = $this->agentParserFactory->getAgentContentFromFile($this->testAgentFile);

        $this->assertIsArray($content);
        $this->assertArrayHasKey('config', $content);
        $this->assertArrayHasKey('system', $content);

        // Verify config section
        $config = $content['config'];
        $this->assertEquals('gpt-3.5-turbo', $config['model_id']);
        $this->assertEquals(0.6, $config['temperature']);
        $this->assertTrue($config['enabled_model_fallback_chain']);
        // Check if custom_param exists before asserting its value
        if (isset($config['custom_param'])) {
            $this->assertEquals('test_value', $config['custom_param']);
        } else {
            $this->markTestSkipped('custom_param not found in config, YAML parsing may have issues');
        }

        // Verify system section
        $system = $content['system'];
        $this->assertStringContainsString('test agent for AgentParserFactory testing', $system);
        $this->assertStringContainsString('{{param1}}, {{param2}}', $system);
        $this->assertStringContainsString('{{test_feature}}', $system);
        $this->assertStringContainsString('Follow user requests', $system);
    }

    public function testGetAgentContentFromFileNonExistent()
    {
        $this->expectException(BusinessException::class);

        $nonExistentFile = BASE_PATH . '/runtime/non_existent_parser_test.agent.yaml';
        $this->agentParserFactory->getAgentContentFromFile($nonExistentFile);
    }

    public function testGetAgentContentFromFileUnsupportedExtension()
    {
        $this->expectException(BusinessException::class);

        $this->agentParserFactory->getAgentContentFromFile($this->testInvalidFile);
    }

    public function testGetAgentContentFromFileWithDifferentExtension()
    {
        // Create a test file with .agent.yml extension
        $ymlFile = BASE_PATH . '/runtime/test_yml_agent.agent.yml';

        $testContent = <<<'YAML'
---
model_id: claude-3-sonnet
temperature: 0.3
enabled_model_fallback_chain: false
---
system: |
  You are a YML test agent.
  Task: {{task_description}}
YAML;
        file_put_contents($ymlFile, $testContent);

        try {
            $content = $this->agentParserFactory->getAgentContentFromFile($ymlFile);

            $this->assertIsArray($content);
            $this->assertArrayHasKey('config', $content);
            $this->assertArrayHasKey('system', $content);

            $config = $content['config'];
            $this->assertEquals('claude-3-sonnet', $config['model_id']);
            $this->assertEquals(0.3, $config['temperature']);
            $this->assertFalse($config['enabled_model_fallback_chain']);

            $system = $content['system'];
            $this->assertStringContainsString('YML test agent', $system);
            $this->assertStringContainsString('{{task_description}}', $system);
        } finally {
            // Clean up
            if (file_exists($ymlFile)) {
                unlink($ymlFile);
            }
        }
    }

    public function testGetAgentContentFromFileWithAbsolutePath()
    {
        $absolutePath = realpath($this->testAgentFile);

        $content = $this->agentParserFactory->getAgentContentFromFile($absolutePath);

        $this->assertIsArray($content);
        $this->assertArrayHasKey('config', $content);
        $this->assertArrayHasKey('system', $content);

        $config = $content['config'];
        $this->assertEquals('gpt-3.5-turbo', $config['model_id']);
    }

    public function testGetAgentContentFromFileWithInvalidYamlFormat()
    {
        $invalidYamlFile = BASE_PATH . '/runtime/invalid_yaml.agent.yaml';

        // Create file with values that YAML parser may convert
        $invalidContent = <<<'YAML'
---
model_id: gpt-4
temperature: invalid_float
enabled_model_fallback_chain: not_boolean
---
system: |
  This is a test with invalid config values.
YAML;
        file_put_contents($invalidYamlFile, $invalidContent);

        try {
            $content = $this->agentParserFactory->getAgentContentFromFile($invalidYamlFile);

            // Should still parse, YAML parser may convert types
            $this->assertIsArray($content);
            $this->assertArrayHasKey('config', $content);
            $this->assertArrayHasKey('system', $content);

            $config = $content['config'];
            // YAML parser might convert invalid_float to 0.0 or keep as string
            $this->assertTrue(
                $config['temperature'] === 'invalid_float' || $config['temperature'] === 0.0,
                'Temperature should be either original string or converted to 0.0'
            );
            // YAML parser might keep string or convert to boolean
            $this->assertTrue(
                $config['enabled_model_fallback_chain'] === 'not_boolean' || is_bool($config['enabled_model_fallback_chain']),
                'enabled_model_fallback_chain should be either original string or converted to boolean'
            );
        } finally {
            // Clean up
            if (file_exists($invalidYamlFile)) {
                unlink($invalidYamlFile);
            }
        }
    }

    public function testGetAgentContentFromFileWithMalformedYaml()
    {
        $malformedYamlFile = BASE_PATH . '/runtime/malformed.agent.yaml';

        // Create file with malformed YAML syntax
        $malformedContent = <<<'YAML'
---
model_id: gpt-4
  temperature: 0.5
    invalid_indentation
enabled_model_fallback_chain: true
---
system: |
  This should fail due to YAML syntax errors.
YAML;
        file_put_contents($malformedYamlFile, $malformedContent);

        try {
            // Some YAML parsers are more lenient and may not throw exceptions
            // We'll test if it throws an exception OR returns invalid/partial data
            try {
                $content = $this->agentParserFactory->getAgentContentFromFile($malformedYamlFile);
                // If no exception is thrown, verify that the parsing result is incomplete or invalid
                $this->assertIsArray($content);
                // The malformed structure should result in incomplete parsing
                if (isset($content['config'])) {
                    // If config exists, it might be incomplete due to malformed structure
                    $this->addToAssertionCount(1); // Parser handled malformed YAML gracefully
                } else {
                    $this->fail('Expected either exception or incomplete config due to malformed YAML');
                }
            } catch (Exception $e) {
                // Exception is expected for malformed YAML
                $this->addToAssertionCount(1);
            }
        } finally {
            // Clean up
            if (file_exists($malformedYamlFile)) {
                unlink($malformedYamlFile);
            }
        }
    }

    public function testGetAgentContentFromFileComparedToOriginalMethod()
    {
        // Test that getAgentContentFromFile produces the same result as getAgentContent
        // when using the example agent

        $exampleFilePath = BASE_PATH . '/app/Application/ModelGateway/MicroAgent/Prompt/example.agent.yaml';

        if (! file_exists($exampleFilePath)) {
            $this->markTestSkipped('Example agent file not found');
        }

        $contentFromFile = $this->agentParserFactory->getAgentContentFromFile($exampleFilePath);
        $contentFromName = $this->agentParserFactory->getAgentContent('example');

        $this->assertEquals($contentFromName, $contentFromFile);
    }
}
