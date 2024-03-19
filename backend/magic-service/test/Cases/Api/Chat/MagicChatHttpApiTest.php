<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Chat;

use HyperfTest\Cases\Api\AbstractHttpTest;

/**
 * @internal
 */
class MagicChatHttpApiTest extends AbstractHttpTest
{
    /**
     * 测试会话窗口中的聊天补全功能.
     */
    public function testConversationChatCompletions(): void
    {
        // 构造请求参数
        $requestData = [
            'conversation_id' => 'test_conversation_id',
            'topic_id' => 'test_topic_id',
            'message' => '你好，测试消息',
            'history' => [
                [
                    'role' => 'user',
                    'content' => '你好',
                ],
                [
                    'role' => 'assistant',
                    'content' => '你好，有什么可以帮助你的吗？',
                ],
            ],
        ];

        // 设置请求头
        $headers = [
            // todo mock authorization的校验
            'authorization' => '',
            'Content-Type' => 'application/json',
        ];

        // 发送POST请求到正确的接口路径
        $response = $this->json('/api/v2/magic/conversation/chatCompletions', $requestData, $headers);

        // 验证响应码
        $this->assertEquals(1000, $response['code'] ?? 0, '响应码应为1000');
        $this->assertEquals('ok', $response['message'] ?? '', '响应消息应为ok');

        // 定义期望的响应结构
        $expectedStructure = [
            'data' => [
                'choices' => [
                    [
                        'message' => [
                            'role' => 'assistant',
                            'content' => '',
                        ],
                    ],
                ],
                'request_info' => [
                    'conversation_id' => 'test_conversation_id',
                    'topic_id' => 'test_topic_id',
                    'message' => '你好，测试消息',
                    'history' => [],
                ],
            ],
        ];

        // 使用assertArrayValueTypesEquals验证响应结构
        $this->assertArrayValueTypesEquals($expectedStructure, $response, '响应结构不符合预期');

        // 额外验证role是否是assistant（这个是精确值验证）
        $this->assertEquals('assistant', $response['data']['choices'][0]['message']['role'], 'role应为assistant');
    }

    /**
     * 测试会话窗口中的聊天补全功能 - 参数验证失败.
     */
    public function testConversationChatCompletionsWithInvalidParams(): void
    {
        // 构造缺少必要参数的请求
        $requestData = [
            // 缺少 conversation_id
            'topic_id' => 'test_topic_id',
            'message' => '你好，测试消息',
        ];

        // 设置请求头
        $headers = [
            'Authorization' => env('TEST_TOKEN', 'test_token'),
            'Content-Type' => 'application/json',
        ];

        // 发送POST请求到正确的接口路径
        $response = $this->json('/api/v2/magic/chat/chatCompletions', $requestData, $headers);

        // 定义期望的错误响应结构
        $expectedErrorStructure = [
            'code' => 0, // 预期不是1000的code，但具体数值可能不确定，所以这里只是占位
            'message' => '', // 只验证存在message字段，具体内容可能不确定
        ];

        // 验证响应应该是参数验证错误
        $this->assertNotEquals(1000, $response['code'] ?? 0, '缺少必要参数时，响应码不应为1000');
        $this->assertArrayValueTypesEquals($expectedErrorStructure, $response, '错误响应结构不符合预期');
    }

    /**
     * 测试会话窗口中的聊天补全功能 - 授权验证失败.
     */
    public function testConversationChatCompletionsWithInvalidAuth(): void
    {
        // 构造请求参数
        $requestData = [
            'conversation_id' => 'test_conversation_id',
            'message' => '你好，测试消息',
        ];

        // 设置无效的请求头
        $headers = [
            'Authorization' => 'invalid_token',
            'Content-Type' => 'application/json',
        ];

        // 发送POST请求到正确的接口路径
        $response = $this->json('/api/v2/magic/chat/chatCompletions', $requestData, $headers);

        // 定义期望的错误响应结构
        $expectedErrorStructure = [
            'code' => 0, // 预期不是1000的code，具体数值可能不确定
            'message' => '', // 只验证存在message字段，具体内容可能不确定
        ];

        // 验证响应应该是授权错误
        $this->assertNotEquals(1000, $response['code'] ?? 0, '无效授权时，响应码不应为1000');
        $this->assertArrayValueTypesEquals($expectedErrorStructure, $response, '授权错误响应结构不符合预期');
    }
}
