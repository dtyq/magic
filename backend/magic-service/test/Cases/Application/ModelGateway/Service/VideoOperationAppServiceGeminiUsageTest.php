<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Service;

use App\Application\ModelGateway\Service\VideoOperationAppService;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

/** @internal */
final class VideoOperationAppServiceGeminiUsageTest extends TestCase
{
    public function testNormalizesGeminiUsageForBilling(): void
    {
        $operation = new VideoQueueOperationEntity(
            'operation-1',
            'video',
            'gemini-omni-1.1-flash',
            'gemini-omni-1.1-flash',
            'provider-model',
            'Gemini',
            'Google',
            'org-test',
            'user-test',
            VideoOperationStatus::SUCCEEDED,
            1,
            providerResult: [
                'usage' => [
                    'total_input_tokens' => 100,
                    'total_output_tokens' => 540,
                    'total_thought_tokens' => 40,
                    'output_tokens_by_modality' => [
                        ['modality' => 'text', 'tokens' => 200],
                        ['modality' => 'video', 'tokens' => 300],
                    ],
                ],
            ],
        );
        $service = (new ReflectionClass(VideoOperationAppService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(VideoOperationAppService::class, 'resolveVideoProviderUsageTokens');
        $method->setAccessible(true);

        self::assertSame([
            'completion_tokens' => 540,
            'total_tokens' => 640,
            'thought_tokens' => 40,
            'billing_token_usage' => [
                'input_tokens' => 100,
                'output_text_tokens' => 200,
                'output_video_tokens' => 300,
            ],
        ], $method->invoke($service, $operation));
    }

    public function testUsesProviderCodeToResolveGeminiUsage(): void
    {
        $operation = new VideoQueueOperationEntity(
            'operation-2',
            'video',
            'custom-video-model',
            'custom-video-model',
            'provider-model',
            'Gemini',
            'Google',
            'org-test',
            'user-test',
            VideoOperationStatus::SUCCEEDED,
            1,
            providerResult: [
                'usage' => [
                    'total_input_tokens' => 10,
                    'total_output_tokens' => 8,
                    'total_tokens' => 20,
                    'total_thought_tokens' => 2,
                    'output_tokens_by_modality' => [
                        ['modality' => 'video', 'tokens' => 8],
                    ],
                ],
            ],
        );
        $service = (new ReflectionClass(VideoOperationAppService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(VideoOperationAppService::class, 'resolveVideoProviderUsageTokens');
        $method->setAccessible(true);

        self::assertSame([
            'completion_tokens' => 8,
            'total_tokens' => 20,
            'thought_tokens' => 2,
            'billing_token_usage' => [
                'input_tokens' => 10,
                'output_text_tokens' => 0,
                'output_video_tokens' => 8,
            ],
        ], $method->invoke($service, $operation));
    }

    public function testPreservesGeminiProviderTotalsWhenModalityBreakdownIsNotExhaustive(): void
    {
        $operation = new VideoQueueOperationEntity(
            'operation-4',
            'video',
            'gemini-omni-1.1-flash',
            'gemini-omni-1.1-flash',
            'provider-model',
            'Gemini',
            'Google',
            'org-test',
            'user-test',
            VideoOperationStatus::SUCCEEDED,
            1,
            providerResult: [
                'usage' => [
                    'total_tokens' => 60036,
                    'total_input_tokens' => 528,
                    'total_output_tokens' => 59056,
                    'total_thought_tokens' => 452,
                    'output_tokens_by_modality' => [
                        ['modality' => 'video', 'tokens' => 57920],
                    ],
                ],
            ],
        );
        $service = (new ReflectionClass(VideoOperationAppService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(VideoOperationAppService::class, 'resolveVideoProviderUsageTokens');
        $method->setAccessible(true);

        self::assertSame([
            'completion_tokens' => 59056,
            'total_tokens' => 60036,
            'thought_tokens' => 452,
            'billing_token_usage' => [
                'input_tokens' => 528,
                'output_text_tokens' => 0,
                'output_video_tokens' => 57920,
            ],
        ], $method->invoke($service, $operation));
    }

    public function testKeepsLegacyUsageForNonGeminiProvider(): void
    {
        $operation = new VideoQueueOperationEntity(
            'operation-3',
            'video',
            'gemini-omni-1.1-flash',
            'gemini-omni-1.1-flash',
            'provider-model',
            'VolcengineArk',
            'Volcengine Ark',
            'org-test',
            'user-test',
            VideoOperationStatus::SUCCEEDED,
            1,
            providerResult: [
                'usage' => [
                    'completion_tokens' => 17,
                    'total_tokens' => 23,
                    'total_input_tokens' => 10,
                    'output_tokens_by_modality' => [
                        ['modality' => 'video', 'tokens' => 8],
                    ],
                ],
            ],
        );
        $service = (new ReflectionClass(VideoOperationAppService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(VideoOperationAppService::class, 'resolveVideoProviderUsageTokens');
        $method->setAccessible(true);

        self::assertSame([
            'completion_tokens' => 17,
            'total_tokens' => 23,
            'thought_tokens' => 0,
            'billing_token_usage' => null,
        ], $method->invoke($service, $operation));
    }
}
