<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiModel;
use PHPUnit\Framework\TestCase;
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
}
