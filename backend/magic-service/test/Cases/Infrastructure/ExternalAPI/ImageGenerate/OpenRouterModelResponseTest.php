<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\OpenRouter\OpenRouterModel;
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
}
