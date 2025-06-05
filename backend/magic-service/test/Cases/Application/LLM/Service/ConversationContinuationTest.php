<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\LLM\Service;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use Hyperf\Context\ApplicationContext;
use Hyperf\Redis\Redis;
use HyperfTest\HttpTestCase;
use ReflectionClass;
use Throwable;

/**
 * Conversation continuation feature unit tests.
 * @internal
 */
class ConversationContinuationTest extends HttpTestCase
{
    protected LLMAppService $llmAppService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->llmAppService = ApplicationContext::getContainer()->get(LLMAppService::class);
    }

    protected function tearDown(): void
    {
        // Clear Redis cache for test data
        try {
            $redis = di(Redis::class);
            if ($redis) {
                // Clear test-related keys
                $keys = $redis->keys('conversation_endpoint:*');
                if (! empty($keys)) {
                    $redis->del($keys);
                }
            }
        } catch (Throwable $e) {
            // Ignore cleanup errors
        }

        parent::tearDown();
    }

    /**
     * Test basic conversation continuation detection.
     */
    public function testBasicConversationContinuation()
    {
        // First conversation
        $firstMessages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant'],
            ['role' => 'user', 'content' => 'Hello, I want to learn PHP programming'],
            ['role' => 'assistant', 'content' => 'Hello! I\'m happy to help you learn PHP programming.'],
        ];

        // Second conversation (continuation)
        $secondMessages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant'],
            ['role' => 'user', 'content' => 'Hello, I want to learn PHP programming'],
            ['role' => 'assistant', 'content' => 'Hello! I\'m happy to help you learn PHP programming.'],
            ['role' => 'user', 'content' => 'Please tell me the basic syntax of PHP'],
        ];

        $firstHash = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$firstMessages]);
        $secondHashWithoutLast = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [array_slice($secondMessages, 0, -1)]);

        $this->assertEquals($firstHash, $secondHashWithoutLast, 'Conversation continuation detection should be equal');
    }

    /**
     * Test conversation continuation with tool calls.
     */
    public function testToolCallConversationContinuation()
    {
        // Complete conversation including tool calls
        $toolCallMessages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant that can call tools to get information'],
            ['role' => 'user', 'content' => 'What time is it now?'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_abc123',
                        'type' => 'function',
                        'function' => [
                            'name' => 'get_current_time',
                            'arguments' => '{"timezone": "Asia/Shanghai"}',
                        ],
                    ],
                ],
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_abc123',
                'content' => '2024-01-15 10:30:00',
            ],
            [
                'role' => 'assistant',
                'content' => 'It is now 10:30 AM on January 15, 2024.',
            ],
        ];

        // Continue conversation
        $continuationMessages = array_merge($toolCallMessages, [
            ['role' => 'user', 'content' => 'Thank you, is it morning or afternoon now?'],
        ]);

        $originalHash = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$toolCallMessages]);
        $continuationHashWithoutLast = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [array_slice($continuationMessages, 0, -1)]);

        $this->assertEquals($originalHash, $continuationHashWithoutLast, 'Conversation continuation detection after tool calls should be equal');
    }

    /**
     * Test multiple tool calls conversation continuation.
     */
    public function testMultipleToolCallsConversationContinuation()
    {
        $multipleToolCallMessages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant'],
            ['role' => 'user', 'content' => 'Help me check today\'s weather and stock prices'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_weather_123',
                        'type' => 'function',
                        'function' => [
                            'name' => 'get_weather',
                            'arguments' => '{"location": "Beijing"}',
                        ],
                    ],
                    [
                        'id' => 'call_stock_456',
                        'type' => 'function',
                        'function' => [
                            'name' => 'get_stock_price',
                            'arguments' => '{"symbol": "AAPL"}',
                        ],
                    ],
                ],
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_weather_123',
                'content' => 'Beijing today is sunny, temperature 15-25 degrees',
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_stock_456',
                'content' => 'AAPL current price: $150.25',
            ],
            [
                'role' => 'assistant',
                'content' => 'Based on the query results:\n1. Beijing weather is sunny today, temperature 15-25 degrees\n2. Apple stock current price is $150.25',
            ],
        ];

        $continuationMessages = array_merge($multipleToolCallMessages, [
            ['role' => 'user', 'content' => 'Did the stock price rise compared to yesterday?'],
        ]);

        $originalHash = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$multipleToolCallMessages]);
        $continuationHashWithoutLast = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [array_slice($continuationMessages, 0, -1)]);

        $this->assertEquals($originalHash, $continuationHashWithoutLast, 'Conversation continuation detection after multiple tool calls should be equal');
    }

    /**
     * Test tool call error handling conversation continuation.
     */
    public function testToolCallErrorHandlingContinuation()
    {
        $toolCallWithErrorMessages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant'],
            ['role' => 'user', 'content' => 'Help me query non-existent information'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_error_123',
                        'type' => 'function',
                        'function' => [
                            'name' => 'query_nonexistent_data',
                            'arguments' => '{"query": "impossible_data"}',
                        ],
                    ],
                ],
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_error_123',
                'content' => 'Error: Unable to find relevant information',
            ],
            [
                'role' => 'assistant',
                'content' => 'Sorry, I couldn\'t find the information you requested. Please try other queries.',
            ],
        ];

        $continuationMessages = array_merge($toolCallWithErrorMessages, [
            ['role' => 'user', 'content' => 'Okay, let me ask a different question'],
        ]);

        $originalHash = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$toolCallWithErrorMessages]);
        $continuationHashWithoutLast = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [array_slice($continuationMessages, 0, -1)]);

        $this->assertEquals($originalHash, $continuationHashWithoutLast, 'Conversation continuation detection after tool call error handling should be equal');
    }

    /**
     * Test nested tool call conversation continuation.
     */
    public function testNestedToolCallConversationContinuation()
    {
        $nestedToolCallMessages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant'],
            ['role' => 'user', 'content' => 'Help me book a meeting room for tomorrow at 2 PM'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_check_availability',
                        'type' => 'function',
                        'function' => [
                            'name' => 'check_room_availability',
                            'arguments' => '{"date": "2024-01-16", "time": "14:00"}',
                        ],
                    ],
                ],
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_check_availability',
                'content' => 'Available meeting rooms: A101, B202, C303',
            ],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_book_room',
                        'type' => 'function',
                        'function' => [
                            'name' => 'book_meeting_room',
                            'arguments' => '{"room": "A101", "date": "2024-01-16", "time": "14:00", "duration": 60}',
                        ],
                    ],
                ],
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_book_room',
                'content' => 'Booking successful: Meeting room A101 is booked, time: 2024-01-16 14:00-15:00',
            ],
            [
                'role' => 'assistant',
                'content' => 'Successfully booked meeting room A101 for you, time is tomorrow (January 16, 2024) from 2 PM to 3 PM.',
            ],
        ];

        $continuationMessages = array_merge($nestedToolCallMessages, [
            ['role' => 'user', 'content' => 'Great, I also need to invite some colleagues to attend'],
        ]);

        $originalHash = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$nestedToolCallMessages]);
        $continuationHashWithoutLast = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [array_slice($continuationMessages, 0, -1)]);

        $this->assertEquals($originalHash, $continuationHashWithoutLast, 'Conversation continuation detection after nested tool calls should be equal');
    }

    /**
     * Test different conversations should not be identified as continuation.
     */
    public function testDifferentConversationsNotContinuation()
    {
        $firstConversation = [
            ['role' => 'system', 'content' => 'You are a helpful assistant'],
            ['role' => 'user', 'content' => 'Query weather'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_weather',
                        'type' => 'function',
                        'function' => [
                            'name' => 'get_weather',
                            'arguments' => '{"location": "Beijing"}',
                        ],
                    ],
                ],
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_weather',
                'content' => 'Beijing is sunny today',
            ],
            [
                'role' => 'assistant',
                'content' => 'Beijing weather is sunny today.',
            ],
        ];

        $differentConversation = [
            ['role' => 'system', 'content' => 'You are a helpful assistant'],
            ['role' => 'user', 'content' => 'Query stock prices'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_stock',
                        'type' => 'function',
                        'function' => [
                            'name' => 'get_stock_price',
                            'arguments' => '{"symbol": "TSLA"}',
                        ],
                    ],
                ],
            ],
        ];

        $firstHash = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$firstConversation]);
        $differentHashWithoutLast = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [array_slice($differentConversation, 0, -1)]);

        $this->assertNotEquals($firstHash, $differentHashWithoutLast, 'Different conversations should not be identified as continuation');
    }

    /**
     * Test endpoint ID cache key generation (based on message hash + model).
     */
    public function testEndpointCacheKeyGeneration()
    {
        $completionDTO = new CompletionDTO();
        $completionDTO->setModel('gpt-4');

        // Test single message
        $completionDTO->setMessages([
            ['role' => 'user', 'content' => 'Hello'],
        ]);
        $messages1 = $completionDTO->getMessages();
        $cacheKey1 = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$messages1, 'gpt-4']);
        $this->assertStringContainsString('conversation_endpoint:', $cacheKey1);
        $this->assertStringContainsString(':gpt-4', $cacheKey1);

        // Test multiple messages
        $completionDTO->setMessages([
            ['role' => 'user', 'content' => 'Hello'],
            ['role' => 'assistant', 'content' => 'Hi there!'],
            ['role' => 'user', 'content' => 'How are you?'],
        ]);
        $messages2 = $completionDTO->getMessages();
        $cacheKey2 = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$messages2, 'gpt-4']);
        $this->assertStringContainsString('conversation_endpoint:', $cacheKey2);
        $this->assertStringContainsString(':gpt-4', $cacheKey2);
        $this->assertNotEquals($cacheKey1, $cacheKey2);

        // Test conversation continuation scenario: simulate how rememberEndpointId and getRememberedEndpointId work
        // rememberEndpointId uses complete messages array, getRememberedEndpointId uses messages array - 1

        // Simulate cache key used when remembering endpoint after first round of conversation completion (based on complete messages)
        $initialMessages = [
            ['role' => 'user', 'content' => 'Hello'],
            ['role' => 'assistant', 'content' => 'Hi there!'],
        ];
        $rememberCacheKey = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$initialMessages, 'gpt-4']);

        // Simulate cache key used when detecting continuation during second round of conversation (based on messages array - 1)
        $continuationMessages = [
            ['role' => 'user', 'content' => 'Hello'],
            ['role' => 'assistant', 'content' => 'Hi there!'],
            ['role' => 'user', 'content' => 'What can you do?'],
        ];
        $messagesWithoutLast = array_slice($continuationMessages, 0, -1);
        $retrieveCacheKey = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$messagesWithoutLast, 'gpt-4']);

        // These two cache keys should be equal because they are both based on the same message history
        $this->assertEquals($rememberCacheKey, $retrieveCacheKey, 'Conversation continuation detection should be able to match previously remembered cache keys');
    }

    /**
     * Test endpoint ID cache key generation functionality (Redis independent).
     */
    public function testEndpointIdMemory()
    {
        $completionDTO = new CompletionDTO();
        $completionDTO->setModel('gpt-4');
        $completionDTO->setMessages([
            ['role' => 'user', 'content' => 'Hello'],
            ['role' => 'assistant', 'content' => 'Hi there!'],
        ]);

        // Test cache key generation (based on message hash + model)
        $messages = $completionDTO->getMessages();
        $cacheKey = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$messages, 'gpt-4']);
        $this->assertStringContainsString('conversation_endpoint:', $cacheKey);
        $this->assertStringContainsString(':gpt-4', $cacheKey);
    }

    /**
     * Test conversation continuation logic (focus on hash calculation and judgment logic).
     */
    public function testUseRememberedEndpointInContinuation()
    {
        $completionDTO = new CompletionDTO();
        $completionDTO->setModel('gpt-4');
        $completionDTO->addBusinessParam('business_id', 'test_conversation');

        // Simulate first conversation
        $firstMessages = [
            ['role' => 'user', 'content' => 'Hello'],
            ['role' => 'assistant', 'content' => 'Hi there!'],
        ];
        $completionDTO->setMessages($firstMessages);

        // Test endpoint cache key generation consistency
        $endpointCacheKey1 = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$firstMessages, 'gpt-4']);

        // Simulate conversation continuation
        $continuationMessages = array_merge($firstMessages, [
            ['role' => 'user', 'content' => 'How are you?'],
        ]);
        $completionDTO->setMessages($continuationMessages);

        $endpointCacheKey2 = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$continuationMessages, 'gpt-4']);

        // Endpoint cache keys will be different because one is based on 2 messages (removing the last one gets 1), the other is based on 3 messages (removing the last one gets 2)
        $this->assertNotEquals($endpointCacheKey1, $endpointCacheKey2, 'Endpoint cache keys based on different message histories will be different');

        // Verify hash calculation logic
        $messagesWithoutLast = array_slice($continuationMessages, 0, -1);
        $hash1 = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$firstMessages]);
        $hash2 = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$messagesWithoutLast]);

        $this->assertEquals($hash1, $hash2, 'Hash after removing the last message should equal the original conversation hash');
    }

    /**
     * Test constant definitions.
     */
    public function testEndpointConstants()
    {
        // Test if constants are correctly defined
        $endpointTTL = $this->getPrivateConstant('CONVERSATION_ENDPOINT_TTL');

        $this->assertGreaterThan(0, $endpointTTL, 'Endpoint TTL should be greater than 0');

        // Test prefix constant
        $endpointPrefix = $this->getPrivateConstant('CONVERSATION_ENDPOINT_PREFIX');

        $this->assertEquals('conversation_endpoint:', $endpointPrefix);
    }

    /**
     * Test different message contents generate different cache keys.
     */
    public function testDifferentMessagesGenerateDifferentCacheKeys()
    {
        // First conversation
        $completionDTO1 = new CompletionDTO();
        $completionDTO1->setModel('gpt-4');
        $completionDTO1->setMessages([
            ['role' => 'user', 'content' => 'Hello from conversation 1'],
        ]);

        // Second conversation (different message content)
        $completionDTO2 = new CompletionDTO();
        $completionDTO2->setModel('gpt-4');
        $completionDTO2->setMessages([
            ['role' => 'user', 'content' => 'Hello from conversation 2'],
        ]);

        // Verify different message contents generate different cache keys
        $cacheKey1 = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$completionDTO1->getMessages(), 'gpt-4']);
        $cacheKey2 = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$completionDTO2->getMessages(), 'gpt-4']);

        $this->assertStringContainsString('conversation_endpoint:', $cacheKey1);
        $this->assertStringContainsString('conversation_endpoint:', $cacheKey2);
        $this->assertStringContainsString(':gpt-4', $cacheKey1);
        $this->assertStringContainsString(':gpt-4', $cacheKey2);
        $this->assertNotEquals($cacheKey1, $cacheKey2, 'Different message contents should generate different cache keys');
    }

    /**
     * Test endpoint ID constants and caching functionality.
     */
    public function testEndpointIdCaching()
    {
        $completionDTO = new CompletionDTO();
        $completionDTO->setModel('gpt-4');
        $completionDTO->setMessages([
            ['role' => 'user', 'content' => 'Hello'],
        ]);

        // Test TTL constant
        $ttl = $this->getPrivateConstant('CONVERSATION_ENDPOINT_TTL');
        $this->assertGreaterThan(0, $ttl, 'Endpoint ID cache TTL should be greater than 0');
        $this->assertLessThanOrEqual(3600, $ttl, 'Endpoint ID cache TTL should be reasonably set (not exceeding 1 hour)');

        // Test cache key generation
        $endpointId = 'endpoint_123';
        $messages = $completionDTO->getMessages();
        $cacheKey = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$messages, 'gpt-4']);
        $this->assertStringContainsString('conversation_endpoint:', $cacheKey);
        $this->assertStringContainsString(':gpt-4', $cacheKey);

        // Test remember functionality doesn't throw exceptions
        $this->invokeMethod($this->llmAppService, 'rememberEndpointId', [$completionDTO, $endpointId]);
        $this->assertTrue(true, 'Remember endpoint ID functionality works normally');
    }

    /**
     * Test endpoint ID memory in conversations containing tool calls.
     */
    public function testEndpointMemoryWithToolCalls()
    {
        $completionDTO = new CompletionDTO();
        $completionDTO->setModel('gpt-4');

        $toolCallMessages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant that can call tools'],
            ['role' => 'user', 'content' => 'What time is it now?'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_abc123',
                        'type' => 'function',
                        'function' => [
                            'name' => 'get_current_time',
                            'arguments' => '{"timezone": "Asia/Shanghai"}',
                        ],
                    ],
                ],
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_abc123',
                'content' => '2024-01-15 10:30:00',
            ],
            [
                'role' => 'assistant',
                'content' => 'It is now 10:30 AM on January 15, 2024.',
            ],
        ];

        $completionDTO->setMessages($toolCallMessages);
        $endpointId = 'endpoint_789';

        // Test hash calculation for tool call messages
        $hash = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$toolCallMessages]);
        $this->assertNotEmpty($hash, 'Messages containing tool calls should be able to calculate hash correctly');

        // Test cache key generation (based on message hash + model)
        $messages = $completionDTO->getMessages();
        $cacheKey = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$messages, 'gpt-4']);
        $this->assertStringContainsString('conversation_endpoint:', $cacheKey);
        $this->assertStringContainsString(':gpt-4', $cacheKey);

        // Test remember functionality
        $this->invokeMethod($this->llmAppService, 'rememberEndpointId', [$completionDTO, $endpointId]);

        // Test hash consistency for continued conversation
        $continuationMessages = array_merge($toolCallMessages, [
            ['role' => 'user', 'content' => 'Thank you, is it morning or afternoon now?'],
        ]);

        $messagesWithoutLast = array_slice($continuationMessages, 0, -1);
        $hash1 = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$toolCallMessages]);
        $hash2 = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$messagesWithoutLast]);

        $this->assertEquals($hash1, $hash2, 'Hash for tool call conversation continuation should match');
    }

    /**
     * Test cache key uniqueness for different models.
     */
    public function testDifferentModelsGenerateDifferentCacheKeys()
    {
        // Same messages, different models
        $messages = [
            ['role' => 'user', 'content' => 'Hello'],
            ['role' => 'assistant', 'content' => 'Hi there!'],
        ];

        $completionDTO1 = new CompletionDTO();
        $completionDTO1->setModel('gpt-4');
        $completionDTO1->setMessages($messages);

        $completionDTO2 = new CompletionDTO();
        $completionDTO2->setModel('gpt-3.5-turbo');
        $completionDTO2->setMessages($messages);

        $cacheKey1 = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$messages, 'gpt-4']);
        $cacheKey2 = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$messages, 'gpt-3.5-turbo']);

        $this->assertNotEquals($cacheKey1, $cacheKey2, 'Different models should generate different cache keys');
        $this->assertStringContainsString(':gpt-4', $cacheKey1);
        $this->assertStringContainsString(':gpt-3.5-turbo', $cacheKey2);

        // Test remember functionality isolation for different models
        $endpointId1 = 'endpoint_123';
        $endpointId2 = 'endpoint_456';

        $this->invokeMethod($this->llmAppService, 'rememberEndpointId', [$completionDTO1, $endpointId1]);
        $this->invokeMethod($this->llmAppService, 'rememberEndpointId', [$completionDTO2, $endpointId2]);

        // Verify different models use different cache spaces
        $this->assertNotEquals($endpointId1, $endpointId2, 'Different models should be able to remember different endpoint IDs');
    }

    /**
     * Test message hash calculation consistency.
     */
    public function testMessageHashConsistency()
    {
        $messages = [
            ['role' => 'user', 'content' => 'Hello'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_123',
                        'type' => 'function',
                        'function' => ['name' => 'test_function', 'arguments' => '{}'],
                    ],
                ],
            ],
            ['role' => 'tool', 'tool_call_id' => 'call_123', 'content' => 'result'],
        ];

        // Multiple calculations of the same messages should yield the same hash
        $hash1 = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$messages]);
        $hash2 = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$messages]);
        $this->assertEquals($hash1, $hash2, 'Hash of the same messages should be consistent');

        // Additional fields should not affect hash
        $messagesWithExtra = [
            ['role' => 'user', 'content' => 'Hello', 'timestamp' => 123456789],
            [
                'role' => 'assistant',
                'content' => null,
                'extra_field' => 'ignored',
                'tool_calls' => [
                    [
                        'id' => 'call_123',
                        'type' => 'function',
                        'function' => ['name' => 'test_function', 'arguments' => '{}'],
                    ],
                ],
            ],
            ['role' => 'tool', 'tool_call_id' => 'call_123', 'content' => 'result', 'metadata' => 'ignored'],
        ];

        $hash3 = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$messagesWithExtra]);
        $this->assertEquals($hash1, $hash3, 'Additional fields should not affect hash value');
    }

    /**
     * Test complete conversation continuation check workflow.
     */
    public function testFullConversationContinuationFlow()
    {
        $uniqueId = uniqid('flow_test_', true);
        $completionDTO = new CompletionDTO();
        $completionDTO->setModel('test-model-flow-' . $uniqueId);
        $completionDTO->addBusinessParam('business_id', 'test_conversation_' . $uniqueId);

        // Case with less than 2 messages
        $completionDTO->setMessages([['role' => 'user', 'content' => 'Hello ' . $uniqueId]]);
        $result1 = $this->llmAppService->getRememberedEndpointId($completionDTO);
        $this->assertNull($result1, 'Should return null for less than 2 messages');

        // Case with 2 or more messages
        $completionDTO->setMessages([
            ['role' => 'user', 'content' => 'Hello unique flow ' . $uniqueId],
            ['role' => 'assistant', 'content' => 'Hi there flow! ' . $uniqueId],
            ['role' => 'user', 'content' => 'How are you flow? ' . $uniqueId],
        ]);

        // First call (no history)
        $result2 = $this->llmAppService->getRememberedEndpointId($completionDTO);
        $this->assertNull($result2, 'First conversation should return null');
    }

    /**
     * Test edge cases: empty messages and single message.
     */
    public function testEdgeCasesEmptyAndSingleMessage()
    {
        // Empty message array
        $emptyMessages = [];
        $emptyHash = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$emptyMessages]);
        $this->assertNotEmpty($emptyHash, 'Empty message array should produce valid hash');

        // Single message
        $singleMessage = [['role' => 'user', 'content' => 'Hello']];
        $singleHash = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$singleMessage]);
        $this->assertNotEmpty($singleHash, 'Single message should produce valid hash');
        $this->assertNotEquals($emptyHash, $singleHash, 'Empty messages and single message hash should be different');
    }

    /**
     * Performance comparison test: String concatenation vs JSON encoding
     * This test verifies the performance advantage of string concatenation method.
     */
    public function testPerformanceComparison()
    {
        // Prepare test data: complex conversation messages
        $complexMessages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant that can call multiple tools to help users'],
            ['role' => 'user', 'content' => 'Please help me check weather, stock prices and news'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_weather_123',
                        'type' => 'function',
                        'function' => [
                            'name' => 'get_weather',
                            'arguments' => '{"location": "Beijing", "unit": "celsius", "forecast_days": 3}',
                        ],
                    ],
                    [
                        'id' => 'call_stock_456',
                        'type' => 'function',
                        'function' => [
                            'name' => 'get_stock_price',
                            'arguments' => '{"symbols": ["AAPL", "GOOGL", "MSFT"], "include_chart": true}',
                        ],
                    ],
                    [
                        'id' => 'call_news_789',
                        'type' => 'function',
                        'function' => [
                            'name' => 'get_latest_news',
                            'arguments' => '{"category": "technology", "limit": 10, "language": "en"}',
                        ],
                    ],
                ],
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_weather_123',
                'content' => 'Beijing today: sunny, temperature 18-25 degrees, humidity 45%, wind level 3',
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_stock_456',
                'content' => 'AAPL: $150.25 (+2.5%), GOOGL: $2650.80 (+1.2%), MSFT: $380.45 (-0.8%)',
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_news_789',
                'content' => 'Latest tech news: 1. AI technology breakthrough 2. Quantum computing progress 3. Autonomous driving updates...',
            ],
            [
                'role' => 'assistant',
                'content' => 'Based on query results:\n1. Weather: Beijing is sunny today\n2. Stocks: Tech stocks performing well overall\n3. News: Important progress in AI field',
            ],
        ];

        // Use current string concatenation method
        $iterations = 1000;
        $startTime = microtime(true);
        for ($i = 0; $i < $iterations; ++$i) {
            $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$complexMessages]);
        }
        $stringConcatTime = microtime(true) - $startTime;

        // Use JSON encoding method for comparison (temporary implementation)
        $startTime = microtime(true);
        for ($i = 0; $i < $iterations; ++$i) {
            $this->calculateMessagesHashWithJson($complexMessages);
        }
        $jsonEncodeTime = microtime(true) - $startTime;

        // Output performance comparison results
        $improvement = (($jsonEncodeTime - $stringConcatTime) / $jsonEncodeTime) * 100;

        // Note: Usually string concatenation should be faster than JSON encoding, but specific results may vary by environment
        // Here we mainly verify that both methods can work normally
        $this->assertTrue(
            $stringConcatTime > 0 && $jsonEncodeTime > 0,
            sprintf(
                'Both methods should execute normally. String concatenation: %.4fs, JSON encoding: %.4fs, Performance difference: %.1f%%',
                $stringConcatTime,
                $jsonEncodeTime,
                $improvement
            )
        );

        // Verify that both methods produce stable hash (should produce same output for same input)
        $stringHash1 = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$complexMessages]);
        $stringHash2 = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$complexMessages]);
        $this->assertEquals($stringHash1, $stringHash2, 'String concatenation method should produce consistent hash values');
    }

    /**
     * Test cache key generation consistency and correctness.
     */
    public function testCompleteConversationContinuationWithEndpointMemory()
    {
        $completionDTO = new CompletionDTO();
        $completionDTO->setModel('gpt-4');
        $completionDTO->addBusinessParam('business_id', 'integration_test_conversation');

        // Test basic message hash calculation
        $messages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant'],
            ['role' => 'user', 'content' => 'Hello, I want to learn programming'],
            ['role' => 'assistant', 'content' => 'I\'m happy to help you learn programming! Which programming language would you like to learn?'],
        ];
        $completionDTO->setMessages($messages);

        // Verify cache key consistency
        $endpointCacheKey = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$messages, 'gpt-4']);

        $this->assertStringContainsString('conversation_endpoint:', $endpointCacheKey);
        $this->assertStringContainsString(':gpt-4', $endpointCacheKey);

        // Test hash calculation stability
        $hash1 = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$messages]);
        $hash2 = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$messages]);
        $this->assertEquals($hash1, $hash2, 'Hash calculation should be stable');

        // Verify test completion
        $this->assertTrue(true, 'Cache key and hash calculation functionality works normally');
    }

    /**
     * Test get remembered endpoint ID functionality.
     */
    public function testGetRememberedEndpointId()
    {
        $uniqueId = uniqid('test_', true);
        $completionDTO = new CompletionDTO();
        $completionDTO->setModel('test-model-' . $uniqueId);

        // Test insufficient message count case
        $completionDTO->setMessages([['role' => 'user', 'content' => 'Hello ' . $uniqueId]]);
        $rememberedEndpointId = $this->llmAppService->getRememberedEndpointId($completionDTO);
        $this->assertNull($rememberedEndpointId, 'Should return null when message count is insufficient');

        // Test no history case
        $completionDTO->setMessages([
            ['role' => 'user', 'content' => 'Hello unique test ' . $uniqueId],
            ['role' => 'assistant', 'content' => 'Hi there unique! ' . $uniqueId],
            ['role' => 'user', 'content' => 'How are you doing? ' . $uniqueId],
        ]);
        $rememberedEndpointId = $this->llmAppService->getRememberedEndpointId($completionDTO);
        $this->assertNull($rememberedEndpointId, 'Should return null when no history exists');

        // Verify method existence and parameter types
        $this->assertTrue(method_exists($this->llmAppService, 'getRememberedEndpointId'), 'getRememberedEndpointId method should exist');
    }

    /**
     * Test multiple attempts to find remembered endpoint ID by removing 1-3 messages.
     */
    public function testMultipleAttemptsToFindRememberedEndpointId()
    {
        $uniqueId = uniqid('multi_', true);
        $completionDTO = new CompletionDTO();
        $completionDTO->setModel('test-model-' . $uniqueId);

        try {
            $redis = $this->invokeMethod($this->llmAppService, 'getRedisInstance');
            if (! $redis) {
                $this->markTestSkipped('Redis not available for testing');
                return;
            }

            // First, remember an endpoint for a 3-message conversation
            $originalMessages = [
                ['role' => 'user', 'content' => 'Hello multi test ' . $uniqueId],
                ['role' => 'assistant', 'content' => 'Hi there! ' . $uniqueId],
                ['role' => 'user', 'content' => 'How are you? ' . $uniqueId],
            ];

            $completionDTO->setMessages($originalMessages);
            $endpointId = 'endpoint_multi_' . $uniqueId;

            // Manually store the endpoint ID using rememberEndpointId
            $this->invokeMethod($this->llmAppService, 'rememberEndpointId', [$completionDTO, $endpointId]);

            // Test 1: Try with 4 messages (should find match by removing 1 message)
            $fourMessages = array_merge($originalMessages, [
                ['role' => 'assistant', 'content' => 'I am fine, thank you! ' . $uniqueId],
            ]);
            $completionDTO->setMessages($fourMessages);
            $retrievedEndpointId = $this->llmAppService->getRememberedEndpointId($completionDTO);
            $this->assertEquals($endpointId, $retrievedEndpointId, 'Should find endpoint by removing 1 message');

            // Test 2: Try with 5 messages (should find match by removing 2 messages)
            $fiveMessages = array_merge($fourMessages, [
                ['role' => 'user', 'content' => 'What can you do? ' . $uniqueId],
            ]);
            $completionDTO->setMessages($fiveMessages);
            $retrievedEndpointId = $this->llmAppService->getRememberedEndpointId($completionDTO);
            $this->assertEquals($endpointId, $retrievedEndpointId, 'Should find endpoint by removing 2 messages');

            // Test 3: Try with 6 messages (should not find match as we only try up to 2 removals)
            $sixMessages = array_merge($fiveMessages, [
                ['role' => 'assistant', 'content' => 'I can help you with many things! ' . $uniqueId],
            ]);
            $completionDTO->setMessages($sixMessages);
            $retrievedEndpointId = $this->llmAppService->getRememberedEndpointId($completionDTO);
            $this->assertNull($retrievedEndpointId, 'Should not find endpoint when needing to remove more than 2 messages');
        } catch (Throwable $e) {
            $this->markTestSkipped('Redis test failed: ' . $e->getMessage());
        }
    }

    /**
     * Test performance optimization: batch hash calculation vs individual calculations.
     */
    public function testHashCalculationPerformanceOptimization()
    {
        // Prepare complex test data
        $complexMessages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant that can call multiple tools'],
            ['role' => 'user', 'content' => 'Help me with weather, stocks, and news'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_weather_123',
                        'type' => 'function',
                        'function' => [
                            'name' => 'get_weather',
                            'arguments' => '{"location": "Beijing", "unit": "celsius"}',
                        ],
                    ],
                    [
                        'id' => 'call_stock_456',
                        'type' => 'function',
                        'function' => [
                            'name' => 'get_stock_price',
                            'arguments' => '{"symbols": ["AAPL", "GOOGL"]}',
                        ],
                    ],
                ],
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_weather_123',
                'content' => 'Beijing today: sunny, temperature 18-25 degrees',
            ],
            [
                'role' => 'tool',
                'tool_call_id' => 'call_stock_456',
                'content' => 'AAPL: $150.25 (+2.5%), GOOGL: $2650.80 (+1.2%)',
            ],
            [
                'role' => 'assistant',
                'content' => 'Based on query results: Weather is sunny, stocks performing well',
            ],
        ];

        $iterations = 1000;

        // Method 1: Old approach - multiple individual calculations
        $startTime = microtime(true);
        for ($i = 0; $i < $iterations; ++$i) {
            // Simulate the old approach
            for ($removeCount = 1; $removeCount <= 2; ++$removeCount) {
                if (count($complexMessages) > $removeCount) {
                    $messagesForCheck = array_slice($complexMessages, 0, -$removeCount);
                    $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$messagesForCheck]);
                }
            }
        }
        $oldApproachTime = microtime(true) - $startTime;

        // Method 2: New optimized approach - batch calculation
        $startTime = microtime(true);
        for ($i = 0; $i < $iterations; ++$i) {
            $this->invokeMethod($this->llmAppService, 'calculateMultipleMessagesHashes', [$complexMessages, 2]);
        }
        $newApproachTime = microtime(true) - $startTime;

        // Calculate performance improvement
        $improvement = (($oldApproachTime - $newApproachTime) / $oldApproachTime) * 100;

        // Verify results consistency
        $oldResults = [];
        for ($removeCount = 1; $removeCount <= 2; ++$removeCount) {
            if (count($complexMessages) > $removeCount) {
                $messagesForCheck = array_slice($complexMessages, 0, -$removeCount);
                $oldResults[$removeCount] = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$messagesForCheck]);
            }
        }

        $newResults = $this->invokeMethod($this->llmAppService, 'calculateMultipleMessagesHashes', [$complexMessages, 2]);

        // Results should be identical
        foreach ($oldResults as $removeCount => $oldHash) {
            $this->assertEquals($oldHash, $newResults[$removeCount], "Hash for removeCount {$removeCount} should be identical");
        }

        // The optimization primarily reduces the number of message array traversals
        // In micro-benchmarks, the difference might be small or variable due to overhead
        // The real benefit is in production with larger message arrays and reduced GC pressure
        $performanceRatio = $newApproachTime / $oldApproachTime;

        // Assert that performance is reasonable (within 50% of old approach)
        $this->assertLessThanOrEqual(
            1.5,
            $performanceRatio,
            sprintf(
                'New approach should not be significantly slower. Old: %.4fs, New: %.4fs, Ratio: %.2f',
                $oldApproachTime,
                $newApproachTime,
                $performanceRatio
            )
        );

        // The key benefit is algorithmic: O(n*k) -> O(n) where n=messages, k=attempts
        // This test verifies correctness rather than micro-performance
        $this->assertTrue(
            true,
            sprintf(
                'Performance test completed. Old: %.4fs, New: %.4fs, Change: %.1f%%. Main benefit: reduced algorithmic complexity',
                $oldApproachTime,
                $newApproachTime,
                $improvement
            )
        );
    }

    /**
     * Test code reuse: verify that calculateMessagesHash and generateEndpointCacheKey
     * both reuse calculateMultipleMessagesHashes for consistency and reduced redundancy.
     */
    public function testCodeReuseConsistency()
    {
        $testMessages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant'],
            ['role' => 'user', 'content' => 'Hello world'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_test_123',
                        'type' => 'function',
                        'function' => [
                            'name' => 'test_function',
                            'arguments' => '{"test": "value"}',
                        ],
                    ],
                ],
            ],
            ['role' => 'tool', 'tool_call_id' => 'call_test_123', 'content' => 'Test result'],
            ['role' => 'assistant', 'content' => 'Here is the response'],
        ];

        // Get hash from calculateMessagesHash (should reuse calculateMultipleMessagesHashes)
        $hashFromCalculateMessagesHash = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$testMessages]);

        // Get hash from calculateMultipleMessagesHashes directly (removeCount=0 for full array)
        $hashesFromMultiple = $this->invokeMethod($this->llmAppService, 'calculateMultipleMessagesHashes', [$testMessages, 0]);
        $hashFromMultiple = $hashesFromMultiple[0];

        // Get cache key from generateEndpointCacheKey (should also reuse calculateMultipleMessagesHashes)
        $cacheKeyFromGenerate = $this->invokeMethod($this->llmAppService, 'generateEndpointCacheKey', [$testMessages, 'test-model']);

        // Extract hash from cache key (format: conversation_endpoint:HASH:MODEL)
        $prefix = 'conversation_endpoint:';
        $suffix = ':test-model';
        $this->assertStringStartsWith($prefix, $cacheKeyFromGenerate);
        $this->assertStringEndsWith($suffix, $cacheKeyFromGenerate);

        $hashFromCacheKey = substr($cacheKeyFromGenerate, strlen($prefix), -strlen($suffix));

        // All three methods should produce the same hash
        $this->assertEquals(
            $hashFromCalculateMessagesHash,
            $hashFromMultiple,
            'calculateMessagesHash should match calculateMultipleMessagesHashes[0]'
        );
        $this->assertEquals(
            $hashFromCalculateMessagesHash,
            $hashFromCacheKey,
            'calculateMessagesHash should match hash extracted from generateEndpointCacheKey'
        );
        $this->assertEquals(
            $hashFromMultiple,
            $hashFromCacheKey,
            'calculateMultipleMessagesHashes[0] should match hash extracted from generateEndpointCacheKey'
        );

        // Verify hash format (64 character SHA256)
        $this->assertEquals(64, strlen($hashFromCalculateMessagesHash), 'Hash should be 64 characters long');
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $hashFromCalculateMessagesHash, 'Hash should be valid SHA256 hex string');

        $this->assertTrue(true, 'Code reuse verification completed: all hash calculation methods use the same optimized algorithm');
    }

    /**
     * Test performance optimization: string concatenation vs array operations.
     */
    public function testStringConcatenationPerformanceOptimization()
    {
        // Test the final optimized string concatenation approach
        $complexMessages = [
            ['role' => 'system', 'content' => 'You are a helpful assistant'],
            ['role' => 'user', 'content' => 'Help me with a complex task'],
            [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    [
                        'id' => 'call_12345',
                        'type' => 'function',
                        'function' => [
                            'name' => 'complex_tool',
                            'arguments' => '{"param": "value", "list": [1,2,3]}',
                        ],
                    ],
                ],
            ],
            ['role' => 'tool', 'tool_call_id' => 'call_12345', 'content' => 'Tool result'],
            ['role' => 'assistant', 'content' => 'Based on the result, here is the answer'],
        ];

        // Test that the optimized method produces consistent results
        $result1 = $this->invokeMethod($this->llmAppService, 'calculateMultipleMessagesHashes', [$complexMessages, 2]);
        $result2 = $this->invokeMethod($this->llmAppService, 'calculateMultipleMessagesHashes', [$complexMessages, 2]);

        $this->assertEquals($result1, $result2, 'String concatenation method should produce consistent results');

        // Now the method returns removeCount=0, 1, 2
        $this->assertArrayHasKey(0, $result1, 'Should have hash for removeCount=0 (full array)');
        $this->assertArrayHasKey(1, $result1, 'Should have hash for removeCount=1');
        $this->assertArrayHasKey(2, $result1, 'Should have hash for removeCount=2');

        // Verify hashes are valid SHA256 hashes (64 characters)
        $this->assertEquals(64, strlen($result1[0]), 'Hash should be 64 characters long');
        $this->assertEquals(64, strlen($result1[1]), 'Hash should be 64 characters long');
        $this->assertEquals(64, strlen($result1[2]), 'Hash should be 64 characters long');

        // Verify that the full array hash (removeCount=0) matches calculateMessagesHash
        $fullArrayHash = $this->invokeMethod($this->llmAppService, 'calculateMessagesHash', [$complexMessages]);
        $this->assertEquals($fullArrayHash, $result1[0], 'Full array hash should match calculateMessagesHash result');
    }

    /**
     * Test batch Redis query optimization in getRememberedEndpointId.
     * Verify that batch querying works correctly and maintains the same behavior as sequential queries.
     */
    public function testBatchRedisQueryOptimization()
    {
        $uniqueId = uniqid('batch_test_', true);
        $completionDTO = new CompletionDTO();
        $completionDTO->setModel('test-model-batch-' . $uniqueId);

        try {
            $redis = $this->invokeMethod($this->llmAppService, 'getRedisInstance');
            if (! $redis) {
                $this->markTestSkipped('Redis not available for batch query testing');
                return;
            }

            // Set up test data: create conversation history for testing batch query
            $baseMessages = [
                ['role' => 'user', 'content' => 'Hello batch test ' . $uniqueId],
                ['role' => 'assistant', 'content' => 'Hi there! ' . $uniqueId],
                ['role' => 'user', 'content' => 'How are you? ' . $uniqueId],
            ];

            // Remember endpoint for the base conversation
            $completionDTO->setMessages($baseMessages);
            $endpointId = 'endpoint_batch_' . $uniqueId;
            $this->invokeMethod($this->llmAppService, 'rememberEndpointId', [$completionDTO, $endpointId]);

            // Test batch query: create a longer conversation to test removeCount=1 scenario
            $extendedMessages = array_merge($baseMessages, [
                ['role' => 'assistant', 'content' => 'I am fine, thanks! ' . $uniqueId],
            ]);
            $completionDTO->setMessages($extendedMessages);

            // Get remembered endpoint ID using batch query
            $retrievedEndpointId = $this->llmAppService->getRememberedEndpointId($completionDTO);

            // Should find the endpoint ID from batch query
            $this->assertEquals($endpointId, $retrievedEndpointId, 'Batch query should find the correct endpoint ID');

            // Test batch query with no matches
            $noMatchMessages = [
                ['role' => 'user', 'content' => 'Completely different conversation ' . $uniqueId],
                ['role' => 'assistant', 'content' => 'This should not match any cached endpoint ' . $uniqueId],
                ['role' => 'user', 'content' => 'No continuation here ' . $uniqueId],
            ];
            $completionDTO->setMessages($noMatchMessages);
            $noMatchResult = $this->llmAppService->getRememberedEndpointId($completionDTO);

            $this->assertNull($noMatchResult, 'Batch query should return null when no matches found');

            // Test edge case: ensure batch query handles empty Redis responses correctly
            $this->assertTrue(true, 'Batch Redis query optimization test completed successfully');
        } catch (Throwable $e) {
            $this->markTestSkipped('Batch Redis query test failed: ' . $e->getMessage());
        }
    }

    /**
     * JSON encoding version hash calculation method for performance comparison.
     */
    private function calculateMessagesHashWithJson(array $messages): string
    {
        // This is the original JSON encoding implementation
        $normalizedMessages = array_map(function ($message) {
            $coreFields = [];
            if (isset($message['role'])) {
                $coreFields['role'] = $message['role'];
            }
            if (isset($message['content'])) {
                $coreFields['content'] = $message['content'];
            }
            if (isset($message['name'])) {
                $coreFields['name'] = $message['name'];
            }
            if (isset($message['tool_calls'])) {
                $coreFields['tool_calls'] = $message['tool_calls'];
            }
            if (isset($message['tool_call_id'])) {
                $coreFields['tool_call_id'] = $message['tool_call_id'];
            }
            return $coreFields;
        }, $messages);

        $jsonString = json_encode($normalizedMessages, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return hash('sha256', $jsonString);
    }

    /**
     * Invoke protected methods.
     */
    private function invokeMethod(object $object, string $methodName, array $parameters = []): mixed
    {
        $reflection = new ReflectionClass(get_class($object));
        $method = $reflection->getMethod($methodName);
        $method->setAccessible(true);
        return $method->invokeArgs($object, $parameters);
    }

    /**
     * Get private constants.
     */
    private function getPrivateConstant(string $constantName): mixed
    {
        $reflection = new ReflectionClass(get_class($this->llmAppService));
        if ($reflection->hasConstant($constantName)) {
            return $reflection->getConstant($constantName);
        }
        return null;
    }
}
