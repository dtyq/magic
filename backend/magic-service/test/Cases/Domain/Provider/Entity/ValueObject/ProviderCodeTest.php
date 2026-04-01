<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Provider\Entity\ValueObject;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ProviderCodeTest extends TestCase
{
    public function testDomesticPersonalSaasLlmWhitelistRules(): void
    {
        $this->assertTrue(ProviderCode::DashScope->isDomesticPersonalSaasLlmWhitelist());
        $this->assertTrue(ProviderCode::Volcengine->isDomesticPersonalSaasLlmWhitelist());
        $this->assertTrue(ProviderCode::DeepSeek->isDomesticPersonalSaasLlmWhitelist());
        $this->assertFalse(ProviderCode::OpenAI->isDomesticPersonalSaasLlmWhitelist());
    }

    public function testDefaultUrlsAndTemplateSchema(): void
    {
        $this->assertSame(
            'https://dashscope.aliyuncs.com/compatible-mode/v1',
            ProviderCode::DashScope->getDefaultUrl()
        );
        $this->assertSame(
            'https://ark.cn-beijing.volces.com/api/v3',
            ProviderCode::Volcengine->getDefaultUrl()
        );
        $this->assertSame(
            'https://api.deepseek.com',
            ProviderCode::DeepSeek->getDefaultUrl()
        );
        $this->assertSame('', ProviderCode::OpenAI->getDefaultUrl());

        $this->assertSame(
            [
                'api_key' => [
                    'required' => true,
                    'type' => 'string',
                ],
            ],
            ProviderCode::DashScope->getTemplateConfigSchema(Category::LLM)
        );
        $this->assertSame([], ProviderCode::DashScope->getTemplateConfigSchema(Category::VLM));
        $this->assertSame([], ProviderCode::OpenAI->getTemplateConfigSchema(Category::LLM));
    }
}
