<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\OpenRouter\OpenRouterModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use ReflectionClass;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\OpenRouter\OpenRouterModel
 */
class OpenRouterModelResponseTest extends TestCase
{
    public function testExtractImagesSkipsThoughtImages(): void
    {
        $responseData = [
            'choices' => [
                [
                    'message' => [
                        'images' => [
                            [
                                'thought' => true,
                                'image_url' => [
                                    'url' => 'https://example.com/thought.png',
                                ],
                            ],
                            [
                                'image_url' => [
                                    'url' => 'https://example.com/final.png',
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $reflection = new ReflectionClass(OpenRouterModel::class);
        $model = $reflection->newInstanceWithoutConstructor();
        $model->logger = new NullLogger();

        $method = $reflection->getMethod('extractImagesFromResponse');
        $method->setAccessible(true);

        $this->assertSame([
            ['url' => 'https://example.com/final.png'],
        ], $method->invoke($model, $responseData));
    }

    public function testExtractImagesSkipsNonArrayImageItems(): void
    {
        $responseData = [
            'choices' => [
                [
                    'message' => [
                        'images' => [
                            'unexpected',
                            [
                                'image_url' => [
                                    'url' => 'https://example.com/final.png',
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $reflection = new ReflectionClass(OpenRouterModel::class);
        $model = $reflection->newInstanceWithoutConstructor();
        $model->logger = new NullLogger();

        $method = $reflection->getMethod('extractImagesFromResponse');
        $method->setAccessible(true);

        $this->assertSame([
            ['url' => 'https://example.com/final.png'],
        ], $method->invoke($model, $responseData));
    }

    public function testExtractImagesIgnoresNonArrayImagesField(): void
    {
        $responseData = [
            'choices' => [
                [
                    'message' => [
                        'images' => 'unexpected',
                    ],
                ],
            ],
        ];

        $reflection = new ReflectionClass(OpenRouterModel::class);
        $model = $reflection->newInstanceWithoutConstructor();
        $model->logger = new NullLogger();

        $method = $reflection->getMethod('extractImagesFromResponse');
        $method->setAccessible(true);

        $this->assertSame([], $method->invoke($model, $responseData));
    }

    public function testAddImageDataToResponseCarriesUsageWithoutThoughtsTokens(): void
    {
        $images = [
            ['url' => 'https://example.com/final.png'],
        ];
        $responseData = [
            'usage' => [
                'prompt_tokens' => 12,
                'completion_tokens' => 34,
                'total_tokens' => 46,
            ],
        ];

        $model = new TestableOpenRouterModel();
        $request = new ImageGenerateRequest('1024', '1024', '小猫吃鱼', '', 'openrouter-image');
        $response = new OpenAIFormatResponse([
            'created' => time(),
            'provider' => 'openrouter',
            'data' => [],
        ]);

        $reflection = new ReflectionClass(OpenRouterModel::class);
        $method = $reflection->getMethod('addImageDataToResponse');
        $method->setAccessible(true);
        $method->invoke($model, $response, $images, $responseData, $request);

        $this->assertSame([
            ['url' => 'watermarked://https://example.com/final.png'],
        ], $response->getData());
        $this->assertNotNull($response->getUsage());
        $this->assertSame([
            'prompt_tokens' => 12,
            'completion_tokens' => 34,
            'total_tokens' => 46,
            'generated_images' => 1,
            'thoughts_tokens' => 0,
        ], $response->getUsage()->toArray());
    }
}

final class TestableOpenRouterModel extends OpenRouterModel
{
    public function __construct()
    {
        $this->logger = new NullLogger();
        $this->watermarkProcessor = new class extends ImageWatermarkProcessor {
            public function addWatermarkToUrl(string $imageUrl, ImageGenerateRequest $imageGenerateRequest): string
            {
                return 'watermarked://' . $imageUrl;
            }
        };
    }

    protected function lockResponse(OpenAIFormatResponse $response): string
    {
        return 'test-owner';
    }

    protected function unlockResponse(OpenAIFormatResponse $response, string $owner): void
    {
    }
}
