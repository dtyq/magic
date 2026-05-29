<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use ReflectionClass;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiModel
 */
class GoogleGeminiModelResponseTest extends TestCase
{
    public function testExtractImageDataSkipsGeminiThoughtImages(): void
    {
        $result = [
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            [
                                'thought' => true,
                                'inlineData' => [
                                    'data' => 'thought-image-data',
                                ],
                            ],
                            [
                                'inlineData' => [
                                    'data' => 'final-image-data',
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $reflection = new ReflectionClass(GoogleGeminiModel::class);
        $model = $reflection->newInstanceWithoutConstructor();
        $method = $reflection->getMethod('extractImageDataFromResponse');
        $method->setAccessible(true);

        $this->assertSame('final-image-data', $method->invoke($model, $result));
    }

    public function testAddImageDataToResponseGeminiCarriesThoughtsTokens(): void
    {
        $result = [
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            [
                                'inlineData' => [
                                    'data' => 'final-image-data',
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            'usageMetadata' => [
                'promptTokenCount' => 12,
                'candidatesTokenCount' => 34,
                'thoughtsTokenCount' => 56,
                'totalTokenCount' => 102,
            ],
        ];

        $model = new TestableGoogleGeminiModel();
        $request = new GoogleGeminiRequest('1024', '1024', '小猫吃鱼', '', 'gemini-image');
        $response = new OpenAIFormatResponse([
            'created' => time(),
            'provider' => 'google',
            'data' => [],
        ]);

        $reflection = new ReflectionClass(GoogleGeminiModel::class);
        $method = $reflection->getMethod('addImageDataToResponseGemini');
        $method->setAccessible(true);
        $method->invoke($model, $response, $result, $request);

        $this->assertSame([
            ['url' => 'watermarked://final-image-data'],
        ], $response->getData());
        $this->assertNotNull($response->getUsage());
        $this->assertSame([
            'prompt_tokens' => 12,
            'completion_tokens' => 34,
            'total_tokens' => 102,
            'generated_images' => 1,
            'thoughts_tokens' => 56,
        ], $response->getUsage()->toArray());
    }
}

final class TestableGoogleGeminiModel extends GoogleGeminiModel
{
    public function __construct()
    {
        $this->logger = new NullLogger();
        $this->watermarkProcessor = new class extends ImageWatermarkProcessor {
            public function addWatermarkToBase64(string $base64Image, ImageGenerateRequest $imageGenerateRequest): string
            {
                return 'watermarked://' . $base64Image;
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
