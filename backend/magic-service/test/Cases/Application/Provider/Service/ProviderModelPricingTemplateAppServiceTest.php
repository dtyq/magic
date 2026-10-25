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

    public function testVolcengineArkVideoTemplateIncludes4kTokenObjects(): void
    {
        $config = require dirname(__DIR__, 5) . '/config/autoload/provider_model_pricing_templates.php';
        $template = null;
        foreach ($config['templates'] as $item) {
            if ($item['code'] === BillingType::VolcengineArkVideoResolutionReferenceVideoTokenMatrix->value) {
                $template = $item;
                break;
            }
        }

        self::assertIsArray($template);
        $billingObjects = array_column($template['items'], 'billing_object');
        self::assertContains(BillingObject::videoToken('4k')->value, $billingObjects);
        self::assertContains(BillingObject::videoTokenCost('4k')->value, $billingObjects);
        self::assertContains(BillingObject::videoReferenceVideoToken('4k')->value, $billingObjects);
        self::assertContains(BillingObject::videoReferenceVideoTokenCost('4k')->value, $billingObjects);
    }

    public function testDashScopeWanUsesAliyunWanDurationTemplate(): void
    {
        $config = require dirname(__DIR__, 5) . '/config/autoload/provider_model_pricing_templates.php';
        $service = new ProviderModelPricingTemplateAppService($config);

        $templates = $service->queries(Category::VGM, ProviderCode::DashScope, 'wan3.0-video');

        self::assertSame([
            BillingType::AliyunWanVideoDurationPricing->value,
        ], array_column($templates, 'code'));
        self::assertContains([
            'provider_code' => ProviderCode::DashScope->value,
            'category' => Category::VGM->value,
            'template_codes' => [BillingType::AliyunWanVideoDurationPricing->value],
        ], $config['provider_templates']);

        $billingObjects = array_column($templates[0]['items'], 'billing_object');
        self::assertCount(12, $billingObjects);
        self::assertContains(BillingObject::videoDuration('480p')->value, $billingObjects);
        self::assertContains(BillingObject::videoDurationCost('480p')->value, $billingObjects);
        self::assertContains(BillingObject::videoReferenceVideoDuration('480p')->value, $billingObjects);
        self::assertContains(BillingObject::videoReferenceVideoDurationCost('480p')->value, $billingObjects);
        self::assertContains(BillingObject::videoDuration('720p')->value, $billingObjects);
        self::assertContains(BillingObject::videoDurationCost('720p')->value, $billingObjects);
        self::assertContains(BillingObject::videoReferenceVideoDuration('720p')->value, $billingObjects);
        self::assertContains(BillingObject::videoReferenceVideoDurationCost('720p')->value, $billingObjects);
        self::assertContains(BillingObject::videoDuration('1080p')->value, $billingObjects);
        self::assertContains(BillingObject::videoDurationCost('1080p')->value, $billingObjects);
        self::assertContains(BillingObject::videoReferenceVideoDuration('1080p')->value, $billingObjects);
        self::assertContains(BillingObject::videoReferenceVideoDurationCost('1080p')->value, $billingObjects);

        self::assertSame(
            [BillingType::AliyunWanVideoDurationPricing->value],
            array_column($service->queries(Category::VGM, ProviderCode::DashScope, 'wan3.0-video-prime'), 'code')
        );
    }

    public function testGeminiOmniUsesDedicatedTokenTemplate(): void
    {
        $config = require dirname(__DIR__, 5) . '/config/autoload/provider_model_pricing_templates.php';
        $service = new ProviderModelPricingTemplateAppService($config);

        $templates = $service->queries(Category::VGM, ProviderCode::Gemini, 'gemini-omni-1.1-flash');

        self::assertSame([BillingType::GeminiOmniVideoTokensPricing->value], array_column($templates, 'code'));
        $billingObjects = array_column($templates[0]['items'], 'billing_object');
        self::assertSame([
            BillingObject::INPUT_TOKEN,
            BillingObject::INPUT_COST,
            BillingObject::OUTPUT_TOKEN,
            BillingObject::OUTPUT_COST,
            BillingObject::THOUGHT_TOKEN,
            BillingObject::THOUGHT_TOKEN_COST,
            BillingObject::videoToken('default')->value,
            BillingObject::videoTokenCost('default')->value,
        ], $billingObjects);
        self::assertSame(
            [BillingType::GeminiOmniVideoTokensPricing->value],
            array_column($service->queries(Category::VGM, ProviderCode::Gemini), 'code')
        );
    }

    public function testQueriesFallsBackToCategoryDefaultsWhenProviderTemplateMissing(): void
    {
        $service = new ProviderModelPricingTemplateAppService($this->templatesConfig());

        $templates = $service->queries(Category::VGM, ProviderCode::OpenAI);

        self::assertCount(1, $templates);
        self::assertSame(BillingType::VideoResolutionDuration->value, $templates[0]['code']);
    }

    public function testQueriesReturnsModelSpecificTemplateWhenModelIdMatches(): void
    {
        $service = new ProviderModelPricingTemplateAppService($this->templatesConfig());

        $templates = $service->queries(Category::VLM, ProviderCode::VolcengineArk, 'seedream-5-pro');

        self::assertCount(1, $templates);
        self::assertSame(BillingType::Seedream5ProImage->value, $templates[0]['code']);
    }

    public function testGeminiImageTokenTemplateLabelsDescribeTextUsage(): void
    {
        $config = require dirname(__DIR__, 5) . '/config/autoload/provider_model_pricing_templates.php';
        $template = null;
        foreach ($config['templates'] as $item) {
            if ($item['code'] === BillingType::ImageTokensWithThought->value) {
                $template = $item;
                break;
            }
        }

        self::assertIsArray($template);
        $labels = array_column($template['items'], 'label', 'billing_object');
        self::assertSame('文本输入 Token', $labels[BillingObject::IMAGE_INPUT_TOKEN]);
        self::assertSame('文本输入 Token 成本', $labels[BillingObject::IMAGE_INPUT_TOKEN_COST]);
        self::assertSame('文本｜思考输出 Token', $labels[BillingObject::THOUGHT_TOKEN]);
        self::assertSame('文本｜思考输出 Token 成本', $labels[BillingObject::THOUGHT_TOKEN_COST]);
    }

    public function testQueriesSkipsModelSpecificTemplateWhenModelIdMissing(): void
    {
        $service = new ProviderModelPricingTemplateAppService($this->templatesConfig());

        $templates = $service->queries(Category::VLM, ProviderCode::VolcengineArk);

        self::assertCount(1, $templates);
        self::assertSame(BillingType::ImageTokens->value, $templates[0]['code']);
    }

    public function testQueriesDeduplicatesMergedTemplateCodes(): void
    {
        $config = $this->templatesConfig();
        $config['defaults'][Category::VLM->value][] = BillingType::ImageTokens->value;

        $service = new ProviderModelPricingTemplateAppService($config);

        $templates = $service->queries(Category::VLM, ProviderCode::VolcengineArk);

        self::assertCount(1, $templates);
        self::assertSame([BillingType::ImageTokens->value], array_column($templates, 'code'));
    }

    public function testApiFallsBackToModelVersionWhenModelIdIsBlank(): void
    {
        $request = $this->createRequest([
            'category' => Category::VLM->value,
            'provider_code' => ProviderCode::VolcengineArk->value,
            'model_id' => '   ',
            'model_version' => 'seedream-5-pro',
        ]);
        $api = new ServiceProviderApi($request);
        $serviceProperty = new ReflectionProperty(ServiceProviderApi::class, 'providerModelPricingTemplateAppService');
        $serviceProperty->setValue(
            $api,
            new ProviderModelPricingTemplateAppService($this->templatesConfig())
        );

        $templates = $api->queriesProviderModelPricingTemplates($request);

        self::assertCount(1, $templates);
        self::assertSame(BillingType::Seedream5ProImage->value, $templates[0]['code']);
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
                    'code' => BillingType::Seedream5ProImage->value,
                    'label' => 'Seedream 5 Pro 图片计费',
                    'category' => Category::VLM->value,
                    'billing_type' => BillingType::Seedream5ProImage->value,
                    'items' => [
                        [
                            'billing_object' => BillingObject::IMAGE_REFERENCE_INPUT_COUNT,
                            'label' => '额外参考输入图片单价',
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
            'model_templates' => [
                [
                    'provider_code' => ProviderCode::VolcengineArk->value,
                    'category' => Category::VLM->value,
                    'model_ids' => [
                        'seedream-5-pro',
                    ],
                    'template_codes' => [
                        BillingType::Seedream5ProImage->value,
                    ],
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

    private function createRequest(array $inputs): RequestInterface
    {
        $request = $this->createMock(RequestInterface::class);
        $request
            ->method('input')
            ->willReturnCallback(static fn (string $key, mixed $default = null): mixed => $inputs[$key] ?? $default);

        return $request;
    }
}
