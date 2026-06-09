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
use App\Interfaces\Provider\Facade\ServiceProviderApi;
use Hyperf\HttpServer\Contract\RequestInterface;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

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

    public function testQueriesDoesNotReturnOfficialPricingByDefault(): void
    {
        $service = new ProviderModelPricingTemplateAppService($this->templatesConfig(), $this->officialPricingConfig());

        $templates = $service->queries(Category::VLM, ProviderCode::OpenAI, 'gpt-image-2');

        self::assertArrayNotHasKey('official_price', $templates[0]['items'][0]);
        self::assertArrayNotHasKey('official_currency', $templates[0]);
    }

    public function testQueriesReturnsOfficialPricingForMatchedModelWhenRequested(): void
    {
        $service = new ProviderModelPricingTemplateAppService($this->templatesConfig(), $this->officialPricingConfig());

        $templates = $service->queries(Category::VLM, ProviderCode::OpenAI, 'gpt-image-2', true);

        self::assertSame(BillingType::ImageTokens->value, $templates[0]['code']);
        self::assertSame('USD', $templates[0]['official_currency']);
        self::assertSame('30.00', $templates[0]['items'][0]['official_price']);
        self::assertSame('USD', $templates[0]['items'][0]['official_currency']);
        self::assertSame('30.00', $templates[0]['items'][1]['official_price']);
        self::assertSame('USD', $templates[0]['items'][1]['official_currency']);
    }

    public function testQueriesDoesNotReturnOfficialPricingWhenModelIdMissing(): void
    {
        $service = new ProviderModelPricingTemplateAppService($this->templatesConfig(), $this->officialPricingConfig());

        $templates = $service->queries(Category::VLM, ProviderCode::OpenAI, '   ', true);

        self::assertArrayNotHasKey('official_price', $templates[0]['items'][0]);
        self::assertArrayNotHasKey('official_currency', $templates[0]);
    }

    public function testQueriesDoesNotReturnOfficialPricingForUnmatchedModel(): void
    {
        $service = new ProviderModelPricingTemplateAppService($this->templatesConfig(), $this->officialPricingConfig());

        $templates = $service->queries(Category::VLM, ProviderCode::OpenAI, 'unknown-model', true);

        self::assertArrayNotHasKey('official_price', $templates[0]['items'][0]);
        self::assertArrayNotHasKey('official_currency', $templates[0]);
    }

    public function testApiFallsBackToModelVersionWhenModelIdIsBlank(): void
    {
        $request = $this->createRequest([
            'category' => Category::VLM->value,
            'provider_code' => ProviderCode::OpenAI->value,
            'model_id' => '   ',
            'model_version' => 'gpt-image-2',
            'include_official_pricing' => '1',
        ]);
        $api = new ServiceProviderApi($request);
        $serviceProperty = new ReflectionProperty(ServiceProviderApi::class, 'providerModelPricingTemplateAppService');
        $serviceProperty->setValue(
            $api,
            new ProviderModelPricingTemplateAppService($this->templatesConfig(), $this->officialPricingConfig())
        );

        $templates = $api->queriesProviderModelPricingTemplates($request);

        self::assertSame('USD', $templates[0]['official_currency']);
        self::assertSame('30.00', $templates[0]['items'][0]['official_price']);
    }

    public function testOpenAiImageInputTokenOfficialPricingExistsInRealConfig(): void
    {
        $service = new ProviderModelPricingTemplateAppService(
            require dirname(__DIR__, 5) . '/config/autoload/provider_model_pricing_templates.php',
            require dirname(__DIR__, 5) . '/config/autoload/provider_model_official_pricing.php'
        );

        $templates = $service->queries(Category::VLM, ProviderCode::OpenAI, 'gpt-image-1.5', true);
        $itemsByBillingObject = array_column($templates[0]['items'], null, 'billing_object');

        self::assertSame('USD', $templates[0]['official_currency']);
        self::assertSame('8.00', $itemsByBillingObject[BillingObject::IMAGE_INPUT_TOKEN]['official_price']);
        self::assertSame('8.00', $itemsByBillingObject[BillingObject::IMAGE_INPUT_TOKEN_COST]['official_price']);

        $templates = $service->queries(Category::VLM, ProviderCode::OpenAI, 'gpt-image-2', true);
        $itemsByBillingObject = array_column($templates[0]['items'], null, 'billing_object');

        self::assertSame('USD', $templates[0]['official_currency']);
        self::assertSame('8.00', $itemsByBillingObject[BillingObject::IMAGE_INPUT_TOKEN]['official_price']);
        self::assertSame('8.00', $itemsByBillingObject[BillingObject::IMAGE_INPUT_TOKEN_COST]['official_price']);
    }

    public function testGoogleThoughtTokenOfficialPricingExistsInRealConfig(): void
    {
        $service = new ProviderModelPricingTemplateAppService(
            require dirname(__DIR__, 5) . '/config/autoload/provider_model_pricing_templates.php',
            require dirname(__DIR__, 5) . '/config/autoload/provider_model_official_pricing.php'
        );

        $templates = $service->queries(Category::VLM, ProviderCode::Google, 'gemini-3.1-flash-image-preview', true);
        $itemsByBillingObject = array_column($templates[0]['items'], null, 'billing_object');

        self::assertSame('USD', $templates[0]['official_currency']);
        self::assertSame('3.00', $itemsByBillingObject[BillingObject::THOUGHT_TOKEN]['official_price']);
        self::assertSame('3.00', $itemsByBillingObject[BillingObject::THOUGHT_TOKEN_COST]['official_price']);

        $templates = $service->queries(Category::VLM, ProviderCode::Google, 'gemini-3-pro-image-preview', true);
        $itemsByBillingObject = array_column($templates[0]['items'], null, 'billing_object');

        self::assertSame('USD', $templates[0]['official_currency']);
        self::assertSame('12.00', $itemsByBillingObject[BillingObject::THOUGHT_TOKEN]['official_price']);
        self::assertSame('12.00', $itemsByBillingObject[BillingObject::THOUGHT_TOKEN_COST]['official_price']);
    }

    public function testQwenDatedAliasesOfficialPricingExistsInRealConfig(): void
    {
        $service = new ProviderModelPricingTemplateAppService(
            require dirname(__DIR__, 5) . '/config/autoload/provider_model_pricing_templates.php',
            require dirname(__DIR__, 5) . '/config/autoload/provider_model_official_pricing.php'
        );

        $modelPriceCases = [
            'qwen-image-plus-2026-01-09' => '0.20',
            'qwen-image-2.0-2026-03-03' => '0.20',
            'qwen-image-edit-plus-2025-10-30' => '0.20',
            'qwen-image-edit-plus-2025-12-15' => '0.20',
            'qwen-image-2.0-pro-2026-03-03' => '0.50',
            'qwen-image-2.0-pro-2026-04-22' => '0.50',
        ];

        foreach ($modelPriceCases as $modelId => $price) {
            $templates = $service->queries(Category::VLM, ProviderCode::Qwen, $modelId, true);

            self::assertSame('CNY', $templates[0]['official_currency']);
            self::assertSame($price, $templates[0]['items'][0]['official_price']);
            self::assertSame($price, $templates[0]['items'][1]['official_price']);
        }
    }

    public function testCloudswayVeoVideoDurationOfficialPricingUsesVideoOnlyPriceInRealConfig(): void
    {
        $service = new ProviderModelPricingTemplateAppService(
            require dirname(__DIR__, 5) . '/config/autoload/provider_model_pricing_templates.php',
            require dirname(__DIR__, 5) . '/config/autoload/provider_model_official_pricing.php'
        );

        $templates = $service->queries(Category::VGM, ProviderCode::Cloudsway, 'veo-3.1-fast-generate-preview', true);
        $itemsByBillingObject = array_column($templates[0]['items'], null, 'billing_object');

        self::assertSame('USD', $templates[0]['official_currency']);
        self::assertSame('0.08', $itemsByBillingObject[BillingObject::videoDuration('720p')->value]['official_price']);
        self::assertSame('0.08', $itemsByBillingObject[BillingObject::videoDurationCost('720p')->value]['official_price']);
        self::assertSame('0.10', $itemsByBillingObject[BillingObject::videoDuration('1080p')->value]['official_price']);
        self::assertSame('0.10', $itemsByBillingObject[BillingObject::videoDurationCost('1080p')->value]['official_price']);
        self::assertSame('0.25', $itemsByBillingObject[BillingObject::videoDuration('4k')->value]['official_price']);
        self::assertSame('0.25', $itemsByBillingObject[BillingObject::videoDurationCost('4k')->value]['official_price']);

        $templates = $service->queries(Category::VGM, ProviderCode::Cloudsway, 'veo-3.1-generate-preview', true);
        $itemsByBillingObject = array_column($templates[0]['items'], null, 'billing_object');

        self::assertSame('USD', $templates[0]['official_currency']);
        self::assertSame('0.20', $itemsByBillingObject[BillingObject::videoDuration('720p')->value]['official_price']);
        self::assertSame('0.20', $itemsByBillingObject[BillingObject::videoDurationCost('720p')->value]['official_price']);
        self::assertSame('0.20', $itemsByBillingObject[BillingObject::videoDuration('1080p')->value]['official_price']);
        self::assertSame('0.20', $itemsByBillingObject[BillingObject::videoDurationCost('1080p')->value]['official_price']);
        self::assertSame('0.40', $itemsByBillingObject[BillingObject::videoDuration('4k')->value]['official_price']);
        self::assertSame('0.40', $itemsByBillingObject[BillingObject::videoDurationCost('4k')->value]['official_price']);
    }

    private function templatesConfig(): array
    {
        return [
            'templates' => [
                [
                    'code' => BillingType::ImageTokens->value,
                    'label' => '图片 Token 计费',
                    'category' => Category::VLM->value,
                    'billing_type' => BillingType::ImageTokens->value,
                    'items' => [
                        [
                            'billing_object' => BillingObject::IMAGE_OUTPUT_TOKEN,
                            'label' => '图片输出 Token',
                        ],
                        [
                            'billing_object' => BillingObject::IMAGE_OUTPUT_TOKEN_COST,
                            'label' => '图片输出 Token 成本',
                        ],
                    ],
                ],
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
                Category::VLM->value => [
                    BillingType::ImageTokens->value,
                ],
                Category::VGM->value => [
                    BillingType::VideoResolutionDuration->value,
                ],
            ],
            'provider_templates' => [
                [
                    'provider_code' => ProviderCode::OpenAI->value,
                    'category' => Category::VLM->value,
                    'template_codes' => [
                        BillingType::ImageTokens->value,
                    ],
                ],
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

    private function officialPricingConfig(): array
    {
        return [
            'source' => 'official_research_2026_05_20',
            'prices' => [
                [
                    'provider_code' => ProviderCode::OpenAI->value,
                    'category' => Category::VLM->value,
                    'model_ids' => [
                        'gpt-image-2',
                    ],
                    'currency' => 'USD',
                    'items' => [
                        BillingObject::IMAGE_OUTPUT_TOKEN => [
                            'price' => '30.00',
                            'price_type' => 'sale',
                        ],
                        BillingObject::IMAGE_OUTPUT_TOKEN_COST => [
                            'price' => '30.00',
                            'price_type' => 'cost',
                        ],
                    ],
                ],
            ],
        ];
    }

    private function createRequest(array $inputs): RequestInterface
    {
        $request = $this->createMock(RequestInterface::class);
        $request
            ->method('input')
            ->willReturnCallback(static fn (string $key, mixed $default = null): mixed => $inputs[$key] ?? $default);

        return $request;
    }
}
