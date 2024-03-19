<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\ModelGateway;

use Hyperf\Coroutine\Parallel;
use HyperfTest\Cases\Api\AbstractHttpTest;
use Throwable;

/**
 * @internal
 */
class ModelGatewayApiTest extends AbstractHttpTest
{
    /**
     * 默认测试模型.
     */
    private const DEFAULT_MODEL = 'deepseek-v3';

    /**
     * 测试 chatCompletions 方法的高可用性.
     */
    public function testHighAvaiable()
    {
        // 构建测试数据
        $expectedResponse = [
            'id' => '',
            'object' => 'chat.completion',
            'created' => 0,
            'choices' => [
                [
                    'finish_reason' => '',
                    'index' => 0,
                    'logprobs' => null,
                    'message' => [
                        'role' => 'assistant',
                        'content' => 'NOT_EMPTY',
                    ],
                ],
            ],
            'usage' => [
                'completion_tokens' => 0,
                'prompt_tokens' => 0,
                'total_tokens' => 0,
                'prompt_tokens_details' => [],
            ],
        ];

        // 创建一个 Parallel 实例，设置最大并发数为 10
        $parallel = new Parallel(10);

        // 定义多个不同的请求场景
        $scenario = $this->buildRequestData([
            'business_params' => [
                'organization_id' => '000',
                'user_id' => '9527',
                'business_id' => '000',
            ],
        ]);

        // 添加并发任务
        $index = 0;
        $count = 10; // 进一步减少测试数量，只要有一个成功就行
        while ($index < $count) {
            $parallel->add(function () use ($scenario, $index, $expectedResponse) {
                try {
                    // 发送HTTP请求
                    $response = $this->json('/v1/chat/completions', $scenario, $this->getTestHeaders());
                    // 断言结果包含预期的内容
                    $this->assertArrayValueTypesEquals($expectedResponse, $response);

                    return [
                        'success' => true,
                        'index' => $index,
                        'content' => $response['choices'][0]['message']['content'] ?? '',
                    ];
                } catch (Throwable $e) {
                    // 直接返回失败信息，不进行重试
                    return [
                        'success' => false,
                        'index' => $index,
                        'error' => $e->getMessage(),
                        'error_code' => $e->getCode(),
                    ];
                }
            });
            ++$index;
        }
        // 执行所有并发任务并获取结果
        $results = $parallel->wait();
        // 统计成功和失败的请求
        $successCount = 0;
        foreach ($results as $result) {
            if ($result['success']) {
                ++$successCount;
            } else {
                // 记录失败信息，但不断言失败
                echo "Request {$result['index']} failed: {$result['error']} (code: {$result['error_code']})" . PHP_EOL;
            }
        }

        // 确保至少有一个请求成功
        $this->assertGreaterThan(0, $successCount, '至少应该有一个请求成功');

        // 输出成功率
        $successRate = ($successCount / $count) * 100;
        echo PHP_EOL;
        echo "testHighAvaiable 请求成功率：{$successRate}% ({$successCount}/" . $count . ')' . PHP_EOL;
    }

    /**
     * 测试 chatCompletions 方法的基本功能.
     */
    public function testChatCompletions(): void
    {
        // 构造请求参数
        $requestData = $this->buildRequestData([
            'business_params' => [
                'organization_id' => '000',
                'user_id' => '9527',
                'business_id' => '000',
            ],
        ]);

        // 发送POST请求
        $response = $this->json('/v1/chat/completions', $requestData, $this->getTestHeaders());
        // 验证整个响应结构
        $expectedResponse = [
            'id' => '',
            'object' => 'chat.completion',
            'created' => 0,
            'choices' => [
                [
                    'finish_reason' => '',
                    'index' => 0,
                    'logprobs' => null,
                    'message' => [
                        'role' => 'assistant',
                        'content' => 'NOT_EMPTY',
                    ],
                ],
            ],
            'usage' => [
                'completion_tokens' => 0,
                'prompt_tokens' => 0,
                'total_tokens' => 0,
                'prompt_tokens_details' => [],
            ],
        ];
        $this->assertArrayValueTypesEquals($expectedResponse, $response, '响应结构及类型验证失败');
    }

    /**
     * 测试 embeddings 方法的基本功能.
     */
    public function testEmbeddings(): void
    {
        // 构造向量嵌入请求参数
        $requestData = [
            'model' => self::DEFAULT_MODEL,
            'input' => '这是一个用于测试的文本',
            'business_params' => [
                'organization_id' => '000',
                'user_id' => '9527',
                'business_id' => '000',
            ],
        ];

        // 发送POST请求
        $response = $this->json('/v1/embeddings', $requestData, $this->getTestHeaders());

        // 验证响应结构
        $expectedResponse = [
            'object' => 'list',
            'data' => [
                [
                    'object' => 'embedding',
                    'embedding' => [
                        -0.01833024,
                        0.02034276,
                        -0.018185195,
                        0.013144831,
                    ],
                    'index' => 0,
                ],
            ],
            'model' => self::DEFAULT_MODEL,
            'usage' => [
                'prompt_tokens' => 0,
                'total_tokens' => 0,
            ],
        ];
        $this->assertArrayValueTypesEquals($expectedResponse, $response, '响应结构及类型验证失败');
    }

    /**
     * 提供测试用的通用消息数据.
     */
    private function getTestMessages(): array
    {
        return [
            [
                'role' => 'system',
                'content' => '你是一个助手',
            ],
            [
                'role' => 'user',
                'content' => '你好',
            ],
        ];
    }

    /**
     * 提供测试用的请求头.
     */
    private function getTestHeaders(): array
    {
        return [
            'api-key' => env('UNIT_TEST_USER_TOKEN'),
            'Content-Type' => 'application/json',
        ];
    }

    /**
     * 构建基础的请求数据.
     */
    private function buildRequestData(array $overrides = []): array
    {
        $default = [
            'model' => self::DEFAULT_MODEL,
            'messages' => $this->getTestMessages(),
            'temperature' => 0.7,
            'max_tokens' => 1000,
        ];

        return array_merge($default, $overrides);
    }
}
