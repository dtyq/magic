<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\Provider\Service\ProviderModelPricingTemplateAppService;
use App\Domain\Provider\DTO\Item\BillingType;
use App\Domain\Provider\DTO\Item\TokenPricing\BillingObject;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ProviderModelPricingTemplateAppServiceTest extends TestCase
{
    public function testQueriesReturnsProviderSpecificTemplate(): void
    {
        $service = new ProviderModelPricingTemplateAppService($this->templatesConfig());

        $templates = $service->queries(Category::VGM, ProviderCode::Keling);

        self::assertCount(1, $templates);
        self::assertSame(BillingType::KelingVideoResolutionMediaConditionDurationPricing->value, $templates[0]['code']);
        self::assertSame(Category::VGM->value, $templates[0]['category']);
        self::assertSame(BillingType::KelingVideoResolutionMediaConditionDurationPricing->value, $templates[0]['billing_type']);
        self::assertContains(
            BillingObject::videoAudioDuration('720p')->value,
            array_column($templates[0]['items'], 'billing_object')
        );
    }

    public function testQueriesFallsBackToCategoryDefaultsWhenProviderTemplateMissing(): void
    {
        $service = new ProviderModelPricingTemplateAppService($this->templatesConfig());

        $templates = $service->queries(Category::VGM, ProviderCode::OpenAI);

        self::assertCount(1, $templates);
        self::assertSame(BillingType::VideoResolutionDuration->value, $templates[0]['code']);
    }

    private function templatesConfig(): array
    {
        return [
            'templates' => [
                [
                    'code' => BillingType::VideoResolutionDuration->value,
                    'label' => '视频按分辨率时长计费',
                    'category' => Category::VGM->value,
                    'billing_type' => BillingType::VideoResolutionDuration->value,
                    'items' => [
                        [
                            'billing_object' => BillingObject::videoDuration('720p')->value,
                            'label' => '720P 视频输出时长',
                        ],
                    ],
                ],
                [
                    'code' => BillingType::KelingVideoResolutionMediaConditionDurationPricing->value,
                    'label' => '可灵视频按规格与输入条件时长计费',
                    'category' => Category::VGM->value,
                    'billing_type' => BillingType::KelingVideoResolutionMediaConditionDurationPricing->value,
                    'items' => [
                        [
                            'billing_object' => BillingObject::videoAudioDuration('720p')->value,
                            'label' => '标准模式（720P）无参考视频带音频输出时长',
                        ],
                    ],
                ],
            ],
            'defaults' => [
                Category::VGM->value => [
                    BillingType::VideoResolutionDuration->value,
                ],
            ],
            'provider_templates' => [
                [
                    'provider_code' => ProviderCode::Keling->value,
                    'category' => Category::VGM->value,
                    'template_codes' => [
                        BillingType::KelingVideoResolutionMediaConditionDurationPricing->value,
                    ],
                ],
            ],
        ];
    }
}
