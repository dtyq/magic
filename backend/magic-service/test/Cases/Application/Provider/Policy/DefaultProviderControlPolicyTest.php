<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Policy;

use App\Application\Provider\Policy\DefaultProviderControlPolicy;
use App\Domain\Provider\DTO\ProviderConfigModelsDTO;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class DefaultProviderControlPolicyTest extends TestCase
{
    public function testFilterSelectableProvidersReturnsOriginalProviders(): void
    {
        $policy = new DefaultProviderControlPolicy();
        $providers = [new ProviderConfigModelsDTO(), new ProviderConfigModelsDTO()];

        $this->assertSame($providers, $policy->filterSelectableProviders('ORG_1', Category::LLM, $providers));
    }

    public function testPrepareProviderConfigForSaveReturnsOriginalConfig(): void
    {
        $policy = new DefaultProviderControlPolicy();
        $config = ['api_key' => 'test-key', 'url' => 'https://example.com/v1'];

        $this->assertSame(
            $config,
            $policy->prepareProviderConfigForSave(
                'ORG_1',
                ProviderCode::OpenAI,
                Category::LLM,
                $config,
            )
        );
    }
}
