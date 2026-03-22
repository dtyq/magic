<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\Provider;

use App\Application\Provider\Official\ServiceProviderInitializer;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * @internal
 */
class ServiceProviderInitializerMiniMaxTest extends TestCase
{
    public function testMiniMaxProviderDataExists(): void
    {
        $method = new ReflectionMethod(ServiceProviderInitializer::class, 'getProviderData');
        $method->setAccessible(true);

        $providers = $method->invoke(null, 'test-org-code');

        // Find MiniMax provider in the data
        $miniMaxProviders = array_filter($providers, function ($provider) {
            return $provider['provider_code'] === ProviderCode::MiniMax->value;
        });

        $this->assertNotEmpty($miniMaxProviders, 'MiniMax provider should exist in provider data');
    }

    public function testMiniMaxProviderDataHasCorrectFields(): void
    {
        $method = new ReflectionMethod(ServiceProviderInitializer::class, 'getProviderData');
        $method->setAccessible(true);

        $providers = $method->invoke(null, 'test-org-code');

        $miniMaxProvider = null;
        foreach ($providers as $provider) {
            if ($provider['provider_code'] === ProviderCode::MiniMax->value) {
                $miniMaxProvider = $provider;
                break;
            }
        }

        $this->assertNotNull($miniMaxProvider, 'MiniMax provider should exist');
        $this->assertSame('MiniMax', $miniMaxProvider['name']);
        $this->assertSame('MiniMax', $miniMaxProvider['provider_code']);
        $this->assertSame('llm', $miniMaxProvider['category']);
        $this->assertSame(0, $miniMaxProvider['provider_type']); // Non-official
        $this->assertSame(1, $miniMaxProvider['status']); // Enabled
    }

    public function testMiniMaxProviderDataHasTranslations(): void
    {
        $method = new ReflectionMethod(ServiceProviderInitializer::class, 'getProviderData');
        $method->setAccessible(true);

        $providers = $method->invoke(null, 'test-org-code');

        $miniMaxProvider = null;
        foreach ($providers as $provider) {
            if ($provider['provider_code'] === ProviderCode::MiniMax->value) {
                $miniMaxProvider = $provider;
                break;
            }
        }

        $this->assertNotNull($miniMaxProvider);

        $translate = json_decode($miniMaxProvider['translate'], true);
        $this->assertArrayHasKey('name', $translate);
        $this->assertArrayHasKey('description', $translate);

        // Check English translations
        $this->assertSame('MiniMax', $translate['name']['en_US']);
        $this->assertSame('MiniMax', $translate['name']['zh_CN']);

        // Check description contains MiniMax model info
        $this->assertStringContainsString('MiniMax', $translate['description']['en_US']);
        $this->assertStringContainsString('M2.7', $translate['description']['en_US']);
        $this->assertStringContainsString('OpenAI-compatible', $translate['description']['en_US']);
    }

    public function testMiniMaxProviderSortOrderIsValid(): void
    {
        $method = new ReflectionMethod(ServiceProviderInitializer::class, 'getProviderData');
        $method->setAccessible(true);

        $providers = $method->invoke(null, 'test-org-code');

        $sortOrders = [];
        foreach ($providers as $provider) {
            if ($provider['category'] === 'llm') {
                $sortOrders[$provider['provider_code']] = $provider['sort_order'];
            }
        }

        // MiniMax should have a valid sort order that is unique among LLM providers
        $this->assertArrayHasKey('MiniMax', $sortOrders);
        $this->assertGreaterThan(0, $sortOrders['MiniMax']);

        // Each sort_order should be unique within LLM category
        $llmSortOrders = array_values($sortOrders);
        $this->assertSame(count($llmSortOrders), count(array_unique($llmSortOrders)), 'Sort orders should be unique');
    }
}
