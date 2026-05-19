<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI\AzureOpenAIAPI;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI\AzureOpenAIImageGenerateModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\Client\AbstractGoogleGeminiClient;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\Client\GoogleGeminiInterface;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Official\OfficialProxyModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\OpenRouter\OpenRouterAPI;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Qwen\QwenImageAPI;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\VolcengineArk\VolcengineArkAPI;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\AzureOpenAIImageRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Support\ImageBase64DataUriParser;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;

/**
 * @internal
 */
final class ImageBase64PassthroughTest extends TestCase
{
    public function testAzureOpenAICreatesMultipartPartFromBase64DataUri(): void
    {
        $base64Image = 'data:image/png;base64,' . base64_encode('azure-image-binary');

        $reflection = new ReflectionClass(AzureOpenAIAPI::class);
        $api = $reflection->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(AzureOpenAIAPI::class, 'createImageMultipartPart');

        $part = $method->invoke($api, 'image', $base64Image, 0);

        $this->assertSame('image', $part['name']);
        $this->assertSame('image0.png', $part['filename']);
        $this->assertSame('image/png', $part['headers']['Content-Type'] ?? null);
        $this->assertSame('azure-image-binary', $part['contents']);
    }

    public function testGoogleGeminiFormatsBase64ReferenceAsInlineData(): void
    {
        $base64Data = base64_encode('gemini-image-binary');
        $base64Image = 'data:image/jpeg;base64,' . $base64Data;

        $api = $this->createMock(GoogleGeminiInterface::class);
        $api->expects($this->once())
            ->method('generateContent')
            ->with(
                '编辑图片',
                [[
                    'type' => 'base64',
                    'mimeType' => 'image/jpeg',
                    'data' => $base64Data,
                ]],
                []
            )
            ->willReturn(['ok' => true]);

        $reflection = new ReflectionClass(GoogleGeminiModel::class);
        $model = $reflection->newInstanceWithoutConstructor();
        $apiProperty = new ReflectionProperty(GoogleGeminiModel::class, 'api');
        $apiProperty->setValue($model, $api);

        $method = new ReflectionMethod(GoogleGeminiModel::class, 'processImageEdit');
        $this->assertSame(['ok' => true], $method->invoke($model, [$base64Image], '编辑图片'));
    }

    public function testGoogleGeminiLogPayloadMasksInlineData(): void
    {
        $base64Data = base64_encode('gemini-inline-image-binary');
        $client = new class extends AbstractGoogleGeminiClient {
            public function __construct()
            {
            }

            protected function validateConfig(): void
            {
            }

            protected function getAuthHeaders(): array
            {
                return [];
            }

            protected function buildUrl(string $endpoint): string
            {
                return $endpoint;
            }

            public function uploadFile(string $filePath, string $mimeType): string
            {
                return $filePath;
            }
        };

        $method = new ReflectionMethod($client::class, 'sanitizePayloadForLog');
        $sanitized = $method->invoke($client, [
            'contents' => [[
                'parts' => [[
                    'inlineData' => [
                        'mimeType' => 'image/jpeg',
                        'data' => $base64Data,
                    ],
                ]],
            ]],
        ]);

        $data = $sanitized['contents'][0]['parts'][0]['inlineData']['data'];
        $this->assertSame('base64_image', $data['type']);
        $this->assertSame('image/jpeg', $data['mime_type']);
        $this->assertSame(strlen('gemini-inline-image-binary'), $data['bytes']);
        $this->assertArrayHasKey('sha256', $data);
    }

    public function testGoogleGeminiKeepsUrlReferenceAsFileData(): void
    {
        $imageUrl = 'https://example.com/input.png';

        $reflection = new ReflectionClass(GoogleGeminiModel::class);
        $model = $reflection->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(GoogleGeminiModel::class, 'formatReferenceImage');

        $this->assertSame([
            'type' => 'fileData',
            'fileUri' => $imageUrl,
            'mimeType' => 'image/png',
        ], $method->invoke($model, $imageUrl));
    }

    public function testAzureOpenAIDoesNotTreatUrlAsBase64Image(): void
    {
        $this->assertNull(ImageBase64DataUriParser::parse('https://example.com/input.jpg'));
    }

    public function testImageBase64DataUriParserRejectsInvalidBase64(): void
    {
        $this->assertFalse(ImageBase64DataUriParser::isValid('data:image/jpeg;base64,invalid-base64'));
    }

    public function testAzureOpenAIModelAllowsBase64ReferenceImage(): void
    {
        $request = new AzureOpenAIImageRequest(prompt: '编辑图片');
        $request->setReferenceImages([
            'data:image/jpeg;base64,' . base64_encode('azure-reference-image-binary'),
        ]);
        $request->setN(1);

        $reflection = new ReflectionClass(AzureOpenAIImageGenerateModel::class);
        $model = $reflection->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(AzureOpenAIImageGenerateModel::class, 'validateRequest');
        $method->invoke($model, $request);

        $this->addToAssertionCount(1);
    }

    public function testAzureOpenAIModelLogPayloadMasksBase64ReferenceImage(): void
    {
        $reflection = new ReflectionClass(AzureOpenAIImageGenerateModel::class);
        $model = $reflection->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(AzureOpenAIImageGenerateModel::class, 'sanitizePayloadForLog');

        $sanitized = $method->invoke($model, [
            'data:image/jpeg;base64,' . base64_encode('azure-model-reference-image-binary'),
        ]);

        $this->assertSame('base64_image', $sanitized[0]['type']);
        $this->assertSame('image/jpeg', $sanitized[0]['mime_type']);
        $this->assertSame(strlen('azure-model-reference-image-binary'), $sanitized[0]['bytes']);
        $this->assertArrayHasKey('sha256', $sanitized[0]);
    }

    public function testVolcengineArkLogPayloadMasksBase64Images(): void
    {
        $payload = [
            'image' => [
                'https://example.com/input.jpg',
                'data:image/png;base64,' . base64_encode('seedream-image-binary'),
            ],
        ];

        $reflection = new ReflectionClass(VolcengineArkAPI::class);
        $api = $reflection->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(VolcengineArkAPI::class, 'sanitizePayloadForLog');

        $sanitized = $method->invoke($api, $payload);

        $this->assertSame('https://example.com/input.jpg', $sanitized['image'][0]);
        $this->assertSame('base64_image', $sanitized['image'][1]['type']);
        $this->assertSame('image/png', $sanitized['image'][1]['mime_type']);
        $this->assertSame(strlen('seedream-image-binary'), $sanitized['image'][1]['bytes']);
        $this->assertArrayHasKey('sha256', $sanitized['image'][1]);
    }

    public function testLogSanitizersKeepUrlReferencesUnchanged(): void
    {
        $imageUrl = 'https://example.com/input.jpg';

        $cases = [
            VolcengineArkAPI::class,
            OfficialProxyModel::class,
            OpenRouterAPI::class,
            QwenImageAPI::class,
        ];

        foreach ($cases as $class) {
            $reflection = new ReflectionClass($class);
            $api = $reflection->newInstanceWithoutConstructor();
            $method = new ReflectionMethod($class, 'sanitizePayloadForLog');

            $sanitized = $method->invoke($api, ['image' => $imageUrl]);
            $this->assertSame($imageUrl, $sanitized['image'], $class . ' should keep URL unchanged');
        }
    }

    public function testOfficialProxyLogPayloadMasksBase64Images(): void
    {
        $payload = [
            'images' => [
                'data:image/png;base64,' . base64_encode('official-image-binary'),
            ],
        ];

        $reflection = new ReflectionClass(OfficialProxyModel::class);
        $model = $reflection->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(OfficialProxyModel::class, 'sanitizePayloadForLog');

        $sanitized = $method->invoke($model, $payload);

        $this->assertSame('base64_image', $sanitized['images'][0]['type']);
        $this->assertSame('image/png', $sanitized['images'][0]['mime_type']);
        $this->assertSame(strlen('official-image-binary'), $sanitized['images'][0]['bytes']);
        $this->assertArrayHasKey('sha256', $sanitized['images'][0]);
    }

    public function testOpenRouterLogPayloadMasksBase64Images(): void
    {
        $payload = [
            'messages' => [[
                'content' => [[
                    'type' => 'image_url',
                    'image_url' => [
                        'url' => 'data:image/jpeg;base64,' . base64_encode('open-router-image-binary'),
                    ],
                ]],
            ]],
        ];

        $reflection = new ReflectionClass(OpenRouterAPI::class);
        $api = $reflection->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(OpenRouterAPI::class, 'sanitizePayloadForLog');

        $sanitized = $method->invoke($api, $payload);
        $imageUrl = $sanitized['messages'][0]['content'][0]['image_url']['url'];

        $this->assertSame('base64_image', $imageUrl['type']);
        $this->assertSame('image/jpeg', $imageUrl['mime_type']);
        $this->assertSame(strlen('open-router-image-binary'), $imageUrl['bytes']);
        $this->assertArrayHasKey('sha256', $imageUrl);
    }

    public function testQwenLogPayloadMasksBase64Images(): void
    {
        $payload = [
            'input' => [
                'messages' => [[
                    'content' => [[
                        'image' => 'data:image/webp;base64,' . base64_encode('qwen-image-binary'),
                    ]],
                ]],
            ],
        ];

        $reflection = new ReflectionClass(QwenImageAPI::class);
        $api = $reflection->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(QwenImageAPI::class, 'sanitizePayloadForLog');

        $sanitized = $method->invoke($api, $payload);
        $image = $sanitized['input']['messages'][0]['content'][0]['image'];

        $this->assertSame('base64_image', $image['type']);
        $this->assertSame('image/webp', $image['mime_type']);
        $this->assertSame(strlen('qwen-image-binary'), $image['bytes']);
        $this->assertArrayHasKey('sha256', $image);
    }

    public function testQwenLogResponseBodyMasksBase64Images(): void
    {
        $responseBody = json_encode([
            'output' => [
                'choices' => [[
                    'message' => [
                        'content' => [[
                            'image' => 'data:image/png;base64,' . base64_encode('qwen-response-image-binary'),
                        ]],
                    ],
                ]],
            ],
        ]);

        $reflection = new ReflectionClass(QwenImageAPI::class);
        $api = $reflection->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(QwenImageAPI::class, 'sanitizeResponseBodyForLog');

        $sanitized = $method->invoke($api, $responseBody);
        $image = $sanitized['output']['choices'][0]['message']['content'][0]['image'];

        $this->assertSame('base64_image', $image['type']);
        $this->assertSame('image/png', $image['mime_type']);
        $this->assertSame(strlen('qwen-response-image-binary'), $image['bytes']);
        $this->assertArrayHasKey('sha256', $image);
    }
}
