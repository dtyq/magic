<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use Exception;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use ReflectionClass;

use function Hyperf\Translation\__;

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

    public function testImageOutputTokensUseImageModalityDetails(): void
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
                'promptTokenCount' => 1904,
                'candidatesTokenCount' => 2172,
                'candidatesTokensDetails' => [
                    [
                        'modality' => 'IMAGE',
                        'tokenCount' => 1120,
                    ],
                ],
                'thoughtsTokenCount' => 0,
                'totalTokenCount' => 4076,
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
            'prompt_tokens' => 1904,
            'completion_tokens' => 1120,
            'total_tokens' => 4076,
            'generated_images' => 1,
            'thoughts_tokens' => 0,
        ], $response->getUsage()->toArray());
    }

    public function testImageOutputTokensFallbackToCandidateCountWithoutImageDetails(): void
    {
        $model = new TestableGoogleGeminiModel();
        $reflection = new ReflectionClass(GoogleGeminiModel::class);
        $method = $reflection->getMethod('extractTokenUsage');
        $method->setAccessible(true);

        $usage = $method->invoke($model, [
            'candidatesTokenCount' => 34,
            'candidatesTokensDetails' => [
                ['modality' => 'TEXT', 'tokenCount' => 34],
            ],
        ]);

        self::assertSame(34, $usage['completion_tokens']);
    }

    public function testImageSafetyResponseThrowsBusinessExceptionWithRawResponse(): void
    {
        $finishMessage = 'Unable to show the generated image because it violated safety policies.';
        $result = [
            'candidates' => [
                [
                    'content' => [
                        'role' => 'model',
                    ],
                    'finishMessage' => $finishMessage,
                    'finishReason' => 'IMAGE_SAFETY',
                ],
            ],
            'usageMetadata' => [
                'promptTokenCount' => 965,
                'thoughtsTokenCount' => 457,
                'totalTokenCount' => 1422,
            ],
        ];

        $model = new TestableGoogleGeminiModel();
        $request = new GoogleGeminiRequest('1024', '1024', 'test prompt', '', 'gemini-image');
        $response = new OpenAIFormatResponse([
            'created' => time(),
            'provider' => 'google',
            'data' => [],
        ]);

        $reflection = new ReflectionClass(GoogleGeminiModel::class);
        $method = $reflection->getMethod('addImageDataToResponseGemini');
        $method->setAccessible(true);
        try {
            $method->invoke($model, $response, $result, $request);
            self::fail('Expected a BusinessException to be thrown.');
        } catch (BusinessException $exception) {
            self::assertSame(44005, $exception->getCode());
            self::assertSame(__('image_generate.output_image_audit_failed'), $exception->getMessage());
            self::assertInstanceOf(Exception::class, $exception->getPrevious());
            self::assertSame(json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR), $exception->getPrevious()?->getMessage());
            self::assertStringContainsString($finishMessage, $exception->getPrevious()?->getMessage() ?? '');
        }
        self::assertSame([], $response->getData());
        self::assertSame([
            'prompt_tokens' => 965,
            'completion_tokens' => 0,
            'total_tokens' => 1422,
            'generated_images' => 0,
            'thoughts_tokens' => 457,
        ], $response->getUsage()?->toArray());
    }

    /**
     * @dataProvider nonSafetyFinishReasonProvider
     */
    public function testEmptyImageResponseUsesFinishReasonErrorCode(string $finishReason, int $expectedErrorCode): void
    {
        $finishMessage = 'provider-specific detail must not be exposed';
        $result = [
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            ['text' => ''],
                        ],
                        'role' => 'model',
                    ],
                    'finishMessage' => $finishMessage,
                    'finishReason' => $finishReason,
                ],
            ],
        ];

        $model = new TestableGoogleGeminiModel();
        $request = new GoogleGeminiRequest('1024', '1024', 'test prompt', '', 'gemini-image');
        $response = new OpenAIFormatResponse([
            'created' => time(),
            'provider' => 'google',
            'data' => [],
        ]);

        $reflection = new ReflectionClass(GoogleGeminiModel::class);
        $method = $reflection->getMethod('addImageDataToResponseGemini');
        $method->setAccessible(true);
        try {
            $method->invoke($model, $response, $result, $request);
            self::fail('Expected a BusinessException to be thrown.');
        } catch (BusinessException $exception) {
            self::assertSame($expectedErrorCode, $exception->getCode());
            self::assertInstanceOf(Exception::class, $exception->getPrevious());
            self::assertSame(json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR), $exception->getPrevious()?->getMessage());
            self::assertStringContainsString($finishMessage, $exception->getPrevious()?->getMessage() ?? '');
        }
        self::assertSame([], $response->getData());
    }

    public static function nonSafetyFinishReasonProvider(): array
    {
        return [
            'prohibited content' => ['IMAGE_PROHIBITED_CONTENT', 44014],
            'recitation' => ['IMAGE_RECITATION', 44000],
            'image other' => ['IMAGE_OTHER', 44000],
            'stop' => ['STOP', 44000],
            'unknown' => ['UNKNOWN', 44000],
        ];
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
