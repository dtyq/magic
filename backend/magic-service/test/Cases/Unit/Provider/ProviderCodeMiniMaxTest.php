<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Provider;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderTemplateId;
use Hyperf\Odin\Model\OpenAIModel;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ProviderCodeMiniMaxTest extends TestCase
{
    public function testMiniMaxEnumExists(): void
    {
        $provider = ProviderCode::MiniMax;
        $this->assertSame('MiniMax', $provider->value);
    }

    public function testMiniMaxCanBeCreatedFromString(): void
    {
        $provider = ProviderCode::from('MiniMax');
        $this->assertSame(ProviderCode::MiniMax, $provider);
    }

    public function testMiniMaxTryFromReturnsInstance(): void
    {
        $provider = ProviderCode::tryFrom('MiniMax');
        $this->assertNotNull($provider);
        $this->assertSame(ProviderCode::MiniMax, $provider);
    }

    public function testMiniMaxUsesOpenAIModelImplementation(): void
    {
        $implementation = ProviderCode::MiniMax->getImplementation();
        $this->assertSame(OpenAIModel::class, $implementation);
    }

    public function testMiniMaxIsNotOfficial(): void
    {
        $this->assertFalse(ProviderCode::MiniMax->isOfficial());
    }

    public function testMiniMaxSortOrder(): void
    {
        $sortOrder = ProviderCode::MiniMax->getSortOrder();
        $this->assertSame(9, $sortOrder);
        // MiniMax should be after DeepSeek (8) and before the default (999)
        $this->assertGreaterThan(ProviderCode::DeepSeek->getSortOrder(), $sortOrder);
        $this->assertLessThan(ProviderCode::None->getSortOrder(), $sortOrder);
    }

    public function testMiniMaxImplementationConfigUsesDefaultCase(): void
    {
        $config = $this->createMock(\App\Domain\Provider\DTO\Item\ProviderConfigItem::class);
        $config->method('getApiKey')->willReturn('test-api-key');
        $config->method('getUrl')->willReturn('https://api.minimax.io/v1');

        $implementationConfig = ProviderCode::MiniMax->getImplementationConfig($config);

        $this->assertArrayHasKey('api_key', $implementationConfig);
        $this->assertArrayHasKey('base_url', $implementationConfig);
        $this->assertArrayHasKey('auto_cache_config', $implementationConfig);
        $this->assertSame('test-api-key', $implementationConfig['api_key']);
        $this->assertSame('https://api.minimax.io/v1', $implementationConfig['base_url']);
    }

    public function testMiniMaxTemplateIdExists(): void
    {
        $templateId = ProviderTemplateId::MiniMaxLlm;
        $this->assertSame('23', $templateId->value);
    }

    public function testMiniMaxTemplateIdFromProviderCodeAndCategory(): void
    {
        $templateId = ProviderTemplateId::fromProviderCodeAndCategory(
            ProviderCode::MiniMax,
            Category::LLM
        );
        $this->assertNotNull($templateId);
        $this->assertSame(ProviderTemplateId::MiniMaxLlm, $templateId);
    }

    public function testMiniMaxTemplateIdToProviderCodeAndCategory(): void
    {
        $result = ProviderTemplateId::MiniMaxLlm->toProviderCodeAndCategory();
        $this->assertSame(ProviderCode::MiniMax, $result['providerCode']);
        $this->assertSame(Category::LLM, $result['category']);
    }

    public function testMiniMaxTemplateIdDescription(): void
    {
        $description = ProviderTemplateId::MiniMaxLlm->getDescription();
        $this->assertStringContainsString('MiniMax', $description);
    }

    public function testMiniMaxVlmTemplateIdReturnsNull(): void
    {
        // MiniMax only supports LLM, not VLM
        $templateId = ProviderTemplateId::fromProviderCodeAndCategory(
            ProviderCode::MiniMax,
            Category::VLM
        );
        $this->assertNull($templateId);
    }
}
