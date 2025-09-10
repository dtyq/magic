<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\MicroAgent;

use App\Application\ModelGateway\MicroAgent\AgentParser\AgentParserFactory;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Infrastructure\Core\Exception\BusinessException;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class CustomFileIntegrationTest extends HttpTestCase
{
    private MicroAgentFactory $microAgentFactory;

    private string $tempDir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->microAgentFactory = new MicroAgentFactory(new AgentParserFactory());

        // Create temporary directory for test files
        $this->tempDir = BASE_PATH . '/runtime/test_integration_' . uniqid();
        mkdir($this->tempDir, 0755, true);
    }

    protected function tearDown(): void
    {
        // Clean up temporary directory and all files
        $this->deleteDirectory($this->tempDir);

        parent::tearDown();
    }

    public function testCompleteWorkflowWithCustomFiles()
    {
        // Create multiple agent files
        $agentFile1 = $this->tempDir . '/workflow_agent1.agent.yaml';
        $agentFile2 = $this->tempDir . '/workflow_agent2.agent.yaml';

        $content1 = <<<'YAML'
---
model_id: gpt-3.5-turbo
temperature: 0.3
enabled_model_fallback_chain: false
---
system: |
  You are Agent 1 for workflow testing.
  User input: {{user_input}}
  Context: {{context}}
YAML;

        $content2 = <<<'YAML'
---
model_id: gpt-4
temperature: 0.7
enabled_model_fallback_chain: true
---
system: |
  You are Agent 2 for workflow testing.
  Previous result: {{previous_result}}
  Action: {{action}}
YAML;

        file_put_contents($agentFile1, $content1);
        file_put_contents($agentFile2, $content2);

        // Test complete workflow
        $agent1 = $this->microAgentFactory->getAgent('workflow_step1', $agentFile1);
        $agent2 = $this->microAgentFactory->getAgent('workflow_step2', $agentFile2);

        // Verify agents are created correctly
        $this->assertEquals('workflow_step1', $agent1->getName());
        $this->assertEquals('workflow_step2', $agent2->getName());
        $this->assertEquals('gpt-3.5-turbo', $agent1->getModelId());
        $this->assertEquals('gpt-4', $agent2->getModelId());

        // Test caching
        $this->assertTrue($this->microAgentFactory->hasAgent('workflow_step1', $agentFile1));
        $this->assertTrue($this->microAgentFactory->hasAgent('workflow_step2', $agentFile2));

        // Test cache independence
        $this->assertFalse($this->microAgentFactory->hasAgent('workflow_step1'));
        $this->assertFalse($this->microAgentFactory->hasAgent('workflow_step2'));
    }

    public function testMixedUsageTraditionalAndCustomFiles()
    {
        // Create custom agent file
        $customFile = $this->tempDir . '/custom_mixed.agent.yaml';
        $customContent = <<<'YAML'
---
model_id: claude-3-haiku
temperature: 0.2
enabled_model_fallback_chain: true
---
system: |
  You are a custom agent in mixed usage test.
  Custom parameter: {{custom_param}}
YAML;
        file_put_contents($customFile, $customContent);

        // Use both traditional and custom file approaches
        $traditionalAgent = $this->microAgentFactory->getAgent('example');
        $customAgent = $this->microAgentFactory->getAgent('mixed_test', $customFile);

        // Verify both work independently
        $this->assertEquals('example', $traditionalAgent->getName());
        $this->assertEquals('mixed_test', $customAgent->getName());
        $this->assertEquals('gpt-4o', $traditionalAgent->getModelId()); // from example.agent.yaml
        $this->assertEquals('claude-3-haiku', $customAgent->getModelId());

        // Verify independent caching
        // Traditional agent is cached by name
        $this->assertTrue($this->microAgentFactory->hasAgent('example'));
        // Custom file agent is cached by file path
        $this->assertTrue($this->microAgentFactory->hasAgent('mixed_test', $customFile));
        // This should be false because mixed_test without file path uses name as cache key
        $this->assertFalse($this->microAgentFactory->hasAgent('mixed_test')); // No file path, different cache key
        // This should be true because the custom file path is already cached (regardless of agent name)
        $this->assertTrue($this->microAgentFactory->hasAgent('example', $customFile)); // Same file path, so cached
    }

    public function testAgentReloadingWithFileModifications()
    {
        $dynamicFile = $this->tempDir . '/dynamic_agent.agent.yaml';

        // Initial version
        $initialContent = <<<'YAML'
---
model_id: gpt-3.5-turbo
temperature: 0.1
enabled_model_fallback_chain: false
version: 1
---
system: |
  Version 1 agent.
  Input: {{input}}
YAML;
        file_put_contents($dynamicFile, $initialContent);

        $agent1 = $this->microAgentFactory->getAgent('dynamic', $dynamicFile);
        $this->assertEquals('gpt-3.5-turbo', $agent1->getModelId());
        $this->assertEquals(0.1, $agent1->getTemperature());
        $this->assertStringContainsString('Version 1', $agent1->getSystemTemplate());

        // Modify file
        $modifiedContent = <<<'YAML'
---
model_id: gpt-4-turbo
temperature: 0.9
enabled_model_fallback_chain: true
version: 2
---
system: |
  Version 2 agent with updates.
  Enhanced input handling: {{input}}
  New feature: {{feature}}
YAML;
        file_put_contents($dynamicFile, $modifiedContent);

        // Without reload, should get cached version
        $agent2 = $this->microAgentFactory->getAgent('dynamic', $dynamicFile);
        $this->assertSame($agent1, $agent2);
        $this->assertEquals('gpt-3.5-turbo', $agent2->getModelId());

        // After reload, should get new version
        $agent3 = $this->microAgentFactory->reloadAgent('dynamic', $dynamicFile);
        $this->assertNotSame($agent1, $agent3);
        $this->assertEquals('gpt-4-turbo', $agent3->getModelId());
        $this->assertEquals(0.9, $agent3->getTemperature());
        $this->assertStringContainsString('Version 2', $agent3->getSystemTemplate());
        $this->assertStringContainsString('Enhanced input', $agent3->getSystemTemplate());
    }

    public function testCacheKeyCollisions()
    {
        // Test that different file paths don't cause cache collisions even with same agent names
        $file1 = $this->tempDir . '/subdir1/collision_test.agent.yaml';
        $file2 = $this->tempDir . '/subdir2/collision_test.agent.yaml';

        // Create subdirectories
        mkdir($this->tempDir . '/subdir1', 0755, true);
        mkdir($this->tempDir . '/subdir2', 0755, true);

        $content1 = <<<'YAML'
---
model_id: model-1
temperature: 0.1
---
system: |
  Agent from subdir1.
YAML;

        $content2 = <<<'YAML'
---
model_id: model-2
temperature: 0.9
---
system: |
  Agent from subdir2.
YAML;

        file_put_contents($file1, $content1);
        file_put_contents($file2, $content2);

        // Create agents with same name but different files
        $agent1 = $this->microAgentFactory->getAgent('collision_agent', $file1);
        $agent2 = $this->microAgentFactory->getAgent('collision_agent', $file2);

        // Should be different instances with different configurations
        $this->assertNotSame($agent1, $agent2);
        $this->assertEquals('model-1', $agent1->getModelId());
        $this->assertEquals('model-2', $agent2->getModelId());
        $this->assertEquals(0.1, $agent1->getTemperature());
        $this->assertEquals(0.9, $agent2->getTemperature());

        // Cache should maintain both independently
        $this->assertTrue($this->microAgentFactory->hasAgent('collision_agent', $file1));
        $this->assertTrue($this->microAgentFactory->hasAgent('collision_agent', $file2));

        // Remove one shouldn't affect the other
        $this->microAgentFactory->removeAgent('collision_agent', $file1);
        $this->assertFalse($this->microAgentFactory->hasAgent('collision_agent', $file1));
        $this->assertTrue($this->microAgentFactory->hasAgent('collision_agent', $file2));
    }

    public function testErrorHandlingChain()
    {
        // Test various error conditions

        // 1. Non-existent file
        try {
            $this->microAgentFactory->getAgent('nonexistent', '/non/existent/path.agent.yaml');
            $this->fail('Expected exception for non-existent file');
        } catch (BusinessException $e) {
            $this->assertStringContainsString('file_not_found', $e->getMessage());
        }

        // 2. Unsupported file extension
        $unsupportedFile = $this->tempDir . '/unsupported.txt';
        file_put_contents($unsupportedFile, 'not an agent file');

        try {
            $this->microAgentFactory->getAgent('unsupported', $unsupportedFile);
            $this->fail('Expected exception for unsupported file extension');
        } catch (BusinessException $e) {
            $this->assertStringContainsString('unsupported_format', $e->getMessage());
        }

        // 3. Directory instead of file
        $dirPath = $this->tempDir . '/directory_not_file';
        mkdir($dirPath);

        try {
            $this->microAgentFactory->getAgent('directory', $dirPath);
            $this->fail('Expected exception for directory instead of file');
        } catch (BusinessException $e) {
            // Should fail because it's a directory, not a file
            $this->addToAssertionCount(1);
        }
    }

    public function testLargeScaleCaching()
    {
        // Test cache behavior with many agents
        $agents = [];
        $files = [];

        // Create many agent files
        for ($i = 0; $i < 20; ++$i) {
            $file = $this->tempDir . "/scale_test_{$i}.agent.yaml";
            $content = <<<YAML
---
model_id: model-{$i}
temperature: 0.{$i}
---
system: |
  Scale test agent {$i}.
  Parameter: {{param_{$i}}}
YAML;
            file_put_contents($file, $content);
            $files[] = $file;

            $agent = $this->microAgentFactory->getAgent("scale_agent_{$i}", $file);
            $agents[] = $agent;

            $this->assertEquals("model-{$i}", $agent->getModelId());
            $this->assertEquals("scale_agent_{$i}", $agent->getName());
        }

        // Verify cache size
        $this->assertEquals(20, $this->microAgentFactory->getCacheSize());

        // Verify all are cached
        for ($i = 0; $i < 20; ++$i) {
            $this->assertTrue($this->microAgentFactory->hasAgent("scale_agent_{$i}", $files[$i]));
        }

        // Clear cache and verify
        $this->microAgentFactory->clearCache();
        $this->assertEquals(0, $this->microAgentFactory->getCacheSize());

        for ($i = 0; $i < 20; ++$i) {
            $this->assertFalse($this->microAgentFactory->hasAgent("scale_agent_{$i}", $files[$i]));
        }
    }

    public function testRelativeAndAbsolutePathHandling()
    {
        $agentFile = $this->tempDir . '/path_test.agent.yaml';
        $content = <<<'YAML'
---
model_id: path-test-model
temperature: 0.5
---
system: |
  Path handling test agent.
YAML;
        file_put_contents($agentFile, $content);

        // Test with absolute path
        $absolutePath = realpath($agentFile);

        // Create agent with absolute path
        $agentAbsolute = $this->microAgentFactory->getAgent('path_test_abs', $absolutePath);

        $this->assertEquals('path-test-model', $agentAbsolute->getModelId());

        // Should be cached with absolute path
        $this->assertTrue($this->microAgentFactory->hasAgent('path_test_abs', $absolutePath));

        // Create second agent with same file but different name
        $agentAbsolute2 = $this->microAgentFactory->getAgent('path_test_abs2', $absolutePath);
        $this->assertEquals('path-test-model', $agentAbsolute2->getModelId());

        // Both should use the same cache entry because cache key is the file path
        $this->assertSame($agentAbsolute, $agentAbsolute2); // Same instance from cache
        $this->assertTrue($this->microAgentFactory->hasAgent('path_test_abs', $absolutePath));
        $this->assertTrue($this->microAgentFactory->hasAgent('path_test_abs2', $absolutePath));

        // Should have only one cache entry because both use the same file path as cache key
        $this->assertEquals(1, $this->microAgentFactory->getCacheSize());
    }

    private function deleteDirectory(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            if (is_dir($path)) {
                $this->deleteDirectory($path);
            } else {
                unlink($path);
            }
        }
        rmdir($dir);
    }
}
