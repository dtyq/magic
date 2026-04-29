<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\ImageGenerate;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\VolcengineArk\VolcengineArkModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\VolcengineArk\VolcengineArkRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * @internal
 * @covers \App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\VolcengineArk\VolcengineArkModel
 */
class VolcengineArkModelResponseTest extends TestCase
{
    public function testOpenAIFormatResponseCarriesVolcengineArkTokenUsage(): void
    {
        $model = new TestableVolcengineArkModel([
            [
                'data' => [
                    [
                        'url' => 'https://example.com/generated.png',
                        'size' => '1792x2400',
                    ],
                ],
                'usage' => [
                    'input_tokens' => 12,
                    'output_tokens' => 1680,
                    'total_tokens' => 1692,
                    'generated_images' => 1,
                ],
            ],
        ]);

        $request = new VolcengineArkRequest('1792', '2400', '小猫吃鱼', '', 'doubao-seedream');

        $response = $model->generateImageOpenAIFormat($request);

        $this->assertSame([
            [
                'url' => 'https://example.com/generated.png',
                'size' => '1792x2400',
            ],
        ], $response->getData());
        $this->assertNotNull($response->getUsage());
        $this->assertSame([
            'prompt_tokens' => 12,
            'completion_tokens' => 1680,
            'total_tokens' => 1692,
            'generated_images' => 1,
        ], $response->getUsage()->toArray());
    }
}

final class TestableVolcengineArkModel extends VolcengineArkModel
{
    public function __construct(private array $queuedResults)
    {
        $this->logger = new NullLogger();
        $this->watermarkProcessor = new class extends ImageWatermarkProcessor {
            public function addWatermarkToUrl(string $imageUrl, ImageGenerateRequest $imageGenerateRequest): string
            {
                return $imageUrl;
            }
        };
    }

    protected function requestImageGenerationV2(VolcengineArkRequest $imageGenerateRequest): array
    {
        return array_shift($this->queuedResults);
    }

    protected function lockResponse(OpenAIFormatResponse $response): string
    {
        return 'test-owner';
    }

    protected function unlockResponse(OpenAIFormatResponse $response, string $owner): void
    {
    }
}
