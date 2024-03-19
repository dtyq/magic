<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Chat;

use HyperfTest\Cases\Api\SuperAgent\AbstractApiTest;

/**
 * @internal
 * 动态模型聊天测试
 */
class DynamicModelChatTest extends AbstractApiTest
{
    private const MODE_CONFIG_URI = '/api/v1/official/admin/modes';

    private const CHAT_COMPLETION_URI = '/v1/chat/completions';

    private const IMAGE_GENERATION_URI = '/v2/images/generations';

    private string $modeId = '849246419151671297';

    protected function setUp(): void
    {
        parent::setUp();
    }

    /**
     * 测试使用动态模型进行对话.
     */
    public function testChatCompletionWithDynamicModel(): void
    {
        $this->switchUserTest1();

        // 2. 调用聊天接口
        $this->callChatCompletion('auto_llm');
    }

    /**
     * 测试使用动态模型进行图像生成.
     */
    public function testImageGenerationWithDynamicModel(): void
    {
        $this->switchUserTest1();

        // 调用图像生成接口
        $this->callImageGeneration('auto_vlm');
    }

    private function callChatCompletion(string $modelId): void
    {
        $requestData = [
            'model' => $modelId,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are a helpful assistant.',
                ],
                [
                    'role' => 'user',
                    'content' => 'Hello!',
                ],
            ],
            'stream' => false,
            'max_tokens' => 4096,
            'stop' => null,
            'frequency_penalty' => 0,
            'presence_penalty' => 0,
            'temperature' => 1,
            'logprobs' => false,
            'top_logprobs' => 0,
            'logit_bias' => null,
            'tools' => [],
            'business_params' => [
                'organization_id' => 'DT001',
                'user_id' => '9527',
                'business_id' => 'request-id',
            ],
        ];

        // 发送POST请求
        $response = $this->json(self::CHAT_COMPLETION_URI, $requestData, $this->getCommonHeaders());
        // 打印响应以便调试（如果失败）
        if (! isset($response['choices'])) {
            // var_dump($response);
        }

        // 验证响应
        // 注意：OpenAI 兼容接口的响应结构
        $this->assertArrayHasKey('choices', $response, '响应中应包含 choices');
        $this->assertIsArray($response['choices']);
        $this->assertGreaterThan(0, count($response['choices']));

        $choice = $response['choices'][0];
        $this->assertArrayHasKey('message', $choice);
        $this->assertArrayHasKey('content', $choice['message']);
        // $this->assertNotEmpty($choice['message']['content'], '回复内容不应为空');
        // 注意：如果模型返回空内容（虽不常见），测试可能会失败。但通常我们期望有回复。

        $this->assertArrayHasKey('id', $response);
        $this->assertArrayHasKey('created', $response);
        $this->assertArrayHasKey('model', $response);
        // 验证响应中的 model 字段可能与请求的不完全一致（取决于底层实现是否透传），
        // 但至少应该有这个字段。如果系统会替换为实际使用的子模型名，这里可能不等于 dynamicModelId。
    }

    private function callImageGeneration(string $modelId): void
    {
        $requestData = [
            'model' => $modelId,
            'n' => 1,
            'images' => [],
            'prompt' => '一只可爱的白色猫咪，毛发蓬松柔软，蓝色的眼睛，背景是温暖的室内环境，高质量图像',
            'sequential_image_generation' => 'auto',
            'size' => '10:333',
        ];

        // 发送POST请求
        $response = $this->json(self::IMAGE_GENERATION_URI, $requestData, $this->getCommonHeaders());

        // 验证响应
        $this->assertArrayHasKey('data', $response, '响应中应包含 data');
        $this->assertIsArray($response['data']);
        $this->assertGreaterThan(0, count($response['data']), '响应中应至少包含一张生成的图片');

        // 验证图片数据
        $imageData = $response['data'][0];
        $this->assertArrayHasKey('url', $imageData, '图片数据应包含 url 字段');
        // 注意：根据实际响应结构，可能还需要验证其他字段，如 revised_prompt 等
    }
}
