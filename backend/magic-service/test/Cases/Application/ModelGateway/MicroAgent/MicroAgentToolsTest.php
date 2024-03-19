<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\MicroAgent;

use App\Application\ModelGateway\MicroAgent\MicroAgent;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class MicroAgentToolsTest extends HttpTestCase
{
    private MicroAgent $agent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->agent = new MicroAgent(
            name: 'test_agent',
            modelId: 'gpt-4',
            systemTemplate: 'You are a test agent with tools: {{tools}}',
            temperature: 0.7,
            enabledModelFallbackChain: true,
        );
    }

    public function testConstructorWithEmptyTools(): void
    {
        $agent = new MicroAgent('test', 'gpt-4', 'test system');

        $this->assertEquals([], $agent->getTools());
    }

    public function testConstructorWithTools(): void
    {
        $tools = [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_weather',
                    'description' => 'Get weather information',
                ],
            ],
        ];

        $agent = new MicroAgent(
            name: 'test',
            modelId: 'gpt-4',
            systemTemplate: 'test',
            tools: $tools
        );

        $this->assertEquals($tools, $agent->getTools());
    }

    public function testSetTools(): void
    {
        $tools = [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'calculator',
                    'description' => 'Perform calculations',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'expression' => [
                                'type' => 'string',
                                'description' => 'Mathematical expression to evaluate',
                            ],
                        ],
                        'required' => ['expression'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_time',
                    'description' => 'Get current time',
                ],
            ],
        ];

        $this->agent->setTools($tools);

        $this->assertEquals($tools, $this->agent->getTools());
        $this->assertCount(2, $this->agent->getTools());
    }

    public function testSetToolsOverwritesPrevious(): void
    {
        // Set initial tools
        $initialTools = [
            [
                'type' => 'function',
                'function' => ['name' => 'tool1'],
            ],
        ];
        $this->agent->setTools($initialTools);
        $this->assertCount(1, $this->agent->getTools());

        // Set new tools (should overwrite)
        $newTools = [
            [
                'type' => 'function',
                'function' => ['name' => 'tool2'],
            ],
            [
                'type' => 'function',
                'function' => ['name' => 'tool3'],
            ],
        ];
        $this->agent->setTools($newTools);

        $this->assertEquals($newTools, $this->agent->getTools());
        $this->assertCount(2, $this->agent->getTools());
    }

    public function testAddTool(): void
    {
        $this->assertEquals([], $this->agent->getTools());

        $tool1 = [
            'type' => 'function',
            'function' => [
                'name' => 'search_web',
                'description' => 'Search the web for information',
            ],
        ];

        $this->agent->addTool($tool1);
        $this->assertEquals([$tool1], $this->agent->getTools());
        $this->assertCount(1, $this->agent->getTools());

        $tool2 = [
            'type' => 'function',
            'function' => [
                'name' => 'send_email',
                'description' => 'Send an email',
            ],
        ];

        $this->agent->addTool($tool2);
        $this->assertEquals([$tool1, $tool2], $this->agent->getTools());
        $this->assertCount(2, $this->agent->getTools());
    }

    public function testAddToolToExistingTools(): void
    {
        $existingTools = [
            [
                'type' => 'function',
                'function' => ['name' => 'existing_tool'],
            ],
        ];

        $this->agent->setTools($existingTools);
        $this->assertCount(1, $this->agent->getTools());

        $newTool = [
            'type' => 'function',
            'function' => ['name' => 'new_tool'],
        ];

        $this->agent->addTool($newTool);

        $expectedTools = array_merge($existingTools, [$newTool]);
        $this->assertEquals($expectedTools, $this->agent->getTools());
        $this->assertCount(2, $this->agent->getTools());
    }

    public function testClearTools(): void
    {
        $tools = [
            [
                'type' => 'function',
                'function' => ['name' => 'tool1'],
            ],
            [
                'type' => 'function',
                'function' => ['name' => 'tool2'],
            ],
        ];

        $this->agent->setTools($tools);
        $this->assertCount(2, $this->agent->getTools());

        $this->agent->clearTools();
        $this->assertEquals([], $this->agent->getTools());
        $this->assertCount(0, $this->agent->getTools());
    }

    public function testClearToolsOnEmptyTools(): void
    {
        $this->assertEquals([], $this->agent->getTools());

        $this->agent->clearTools();
        $this->assertEquals([], $this->agent->getTools());
    }

    public function testToolsChaining(): void
    {
        $tool1 = ['type' => 'function', 'function' => ['name' => 'tool1']];
        $tool2 = ['type' => 'function', 'function' => ['name' => 'tool2']];
        $tool3 = ['type' => 'function', 'function' => ['name' => 'tool3']];

        // Chain operations
        $this->agent->addTool($tool1);
        $this->agent->addTool($tool2);
        $this->agent->addTool($tool3);

        $this->assertCount(3, $this->agent->getTools());
        $this->assertEquals([$tool1, $tool2, $tool3], $this->agent->getTools());

        // Clear and set new tools
        $this->agent->clearTools();
        $this->agent->setTools([$tool1, $tool3]);

        $this->assertCount(2, $this->agent->getTools());
        $this->assertEquals([$tool1, $tool3], $this->agent->getTools());
    }

    public function testEasyCallUsesTools(): void
    {
        $this->markTestSkipped('Requires mocking model gateway for full integration test');

        // This test would require mocking the ModelGatewayMapper and model
        // to verify that tools are passed correctly to the chat model

        $tools = [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_weather',
                    'description' => 'Get weather information',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'city' => ['type' => 'string', 'description' => 'City name'],
                        ],
                        'required' => ['city'],
                    ],
                ],
            ],
        ];

        $this->agent->setTools($tools);

        $response = $this->agent->easyCall(
            organizationCode: 'TEST_ORG',
            systemReplace: ['tools' => 'weather tools'],
            userPrompt: 'What is the weather in Beijing?'
        );

        $this->assertInstanceOf(ChatCompletionResponse::class, $response);
    }

    public function testWithToolsChaining(): void
    {
        $tools = [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'calculator',
                    'description' => 'Perform calculations',
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'weather',
                    'description' => 'Get weather info',
                ],
            ],
        ];

        // Test that withTools returns self for chaining
        $result = $this->agent->withTools($tools);

        $this->assertSame($this->agent, $result);
        $this->assertEquals($tools, $this->agent->getTools());
        $this->assertCount(2, $this->agent->getTools());
    }

    public function testWithToolsChainWithOtherMethods(): void
    {
        $tools1 = [
            ['type' => 'function', 'function' => ['name' => 'tool1']],
        ];

        $tools2 = [
            ['type' => 'function', 'function' => ['name' => 'tool2']],
            ['type' => 'function', 'function' => ['name' => 'tool3']],
        ];

        // Test chaining with multiple operations
        $result = $this->agent
            ->withTools($tools1)
            ->withTools($tools2); // Should overwrite tools1

        $this->assertSame($this->agent, $result);
        $this->assertEquals($tools2, $this->agent->getTools());
        $this->assertCount(2, $this->agent->getTools());
    }

    public function testWithToolsOverwritesPreviousTools(): void
    {
        // Set initial tools using setTools
        $initialTools = [
            ['type' => 'function', 'function' => ['name' => 'initial_tool']],
        ];
        $this->agent->setTools($initialTools);
        $this->assertCount(1, $this->agent->getTools());

        // Use withTools to overwrite
        $newTools = [
            ['type' => 'function', 'function' => ['name' => 'new_tool1']],
            ['type' => 'function', 'function' => ['name' => 'new_tool2']],
        ];

        $result = $this->agent->withTools($newTools);

        $this->assertSame($this->agent, $result);
        $this->assertEquals($newTools, $this->agent->getTools());
        $this->assertCount(2, $this->agent->getTools());
    }

    public function testWithToolsEmptyArray(): void
    {
        // Add some tools first
        $this->agent->addTool(['type' => 'function', 'function' => ['name' => 'test_tool']]);
        $this->assertCount(1, $this->agent->getTools());

        // Use withTools with empty array
        $result = $this->agent->withTools([]);

        $this->assertSame($this->agent, $result);
        $this->assertEquals([], $this->agent->getTools());
        $this->assertCount(0, $this->agent->getTools());
    }

    public function testComplexToolDefinition(): void
    {
        $complexTool = [
            'type' => 'function',
            'function' => [
                'name' => 'database_query',
                'description' => 'Query database with complex parameters',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'query' => [
                            'type' => 'string',
                            'description' => 'SQL query to execute',
                        ],
                        'parameters' => [
                            'type' => 'array',
                            'description' => 'Query parameters',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'name' => ['type' => 'string'],
                                    'value' => ['type' => 'string'],
                                    'type' => ['type' => 'string', 'enum' => ['string', 'number', 'boolean']],
                                ],
                            ],
                        ],
                        'limit' => [
                            'type' => 'integer',
                            'description' => 'Maximum number of results',
                            'minimum' => 1,
                            'maximum' => 1000,
                        ],
                    ],
                    'required' => ['query'],
                ],
            ],
        ];

        $this->agent->addTool($complexTool);

        $retrievedTools = $this->agent->getTools();
        $this->assertCount(1, $retrievedTools);
        $this->assertEquals($complexTool, $retrievedTools[0]);

        // Verify nested structure is preserved
        $functionDef = $retrievedTools[0]['function'];
        $this->assertEquals('database_query', $functionDef['name']);
        $this->assertArrayHasKey('parameters', $functionDef);
        $this->assertArrayHasKey('properties', $functionDef['parameters']);
        $this->assertArrayHasKey('query', $functionDef['parameters']['properties']);
        $this->assertArrayHasKey('parameters', $functionDef['parameters']['properties']);
        $this->assertArrayHasKey('limit', $functionDef['parameters']['properties']);
    }

    public function testFluentInterfaceExample(): void
    {
        // Demonstrate fluent interface usage
        $weatherTool = [
            'type' => 'function',
            'function' => [
                'name' => 'get_weather',
                'description' => 'Get current weather',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'location' => ['type' => 'string', 'description' => 'Location name'],
                    ],
                    'required' => ['location'],
                ],
            ],
        ];

        $calculatorTool = [
            'type' => 'function',
            'function' => [
                'name' => 'calculate',
                'description' => 'Perform mathematical calculations',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'expression' => ['type' => 'string', 'description' => 'Math expression'],
                    ],
                    'required' => ['expression'],
                ],
            ],
        ];

        // This demonstrates how the API can be used fluently
        $configuredAgent = $this->agent->withTools([$weatherTool, $calculatorTool]);

        $this->assertSame($this->agent, $configuredAgent);
        $this->assertCount(2, $configuredAgent->getTools());

        $tools = $configuredAgent->getTools();
        $this->assertEquals('get_weather', $tools[0]['function']['name']);
        $this->assertEquals('calculate', $tools[1]['function']['name']);
    }
}
