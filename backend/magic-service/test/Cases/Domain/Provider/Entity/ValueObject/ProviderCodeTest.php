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
    public function testNonOfficialOrganizationWhitelistRules(): void
    {
        $this->assertTrue(ProviderCode::DashScope->isNonOfficialOrganizationLlmWhitelist());
        $this->assertTrue(ProviderCode::Volcengine->isNonOfficialOrganizationLlmWhitelist());
        $this->assertTrue(ProviderCode::DeepSeek->isNonOfficialOrganizationLlmWhitelist());
        $this->assertTrue(ProviderCode::Tencent->isNonOfficialOrganizationLlmWhitelist());
        $this->assertTrue(ProviderCode::Baidu->isNonOfficialOrganizationLlmWhitelist());
        $this->assertTrue(ProviderCode::SCNet->isNonOfficialOrganizationLlmWhitelist());
        $this->assertTrue(ProviderCode::Moonshot->isNonOfficialOrganizationLlmWhitelist());
        $this->assertTrue(ProviderCode::BigModel->isNonOfficialOrganizationLlmWhitelist());
        $this->assertTrue(ProviderCode::MiniMax->isNonOfficialOrganizationLlmWhitelist());
        $this->assertTrue(ProviderCode::SiliconFlow->isNonOfficialOrganizationLlmWhitelist());
        $this->assertFalse(ProviderCode::OpenAI->isNonOfficialOrganizationLlmWhitelist());

        $this->assertTrue(ProviderCode::Qwen->isNonOfficialOrganizationTemplateWhitelist(Category::VLM));
        $this->assertTrue(ProviderCode::VolcengineArk->isNonOfficialOrganizationTemplateWhitelist(Category::VLM));
        $this->assertTrue(ProviderCode::VolcengineArk->isNonOfficialOrganizationTemplateWhitelist(Category::VGM));
        $this->assertFalse(ProviderCode::OpenRouter->isNonOfficialOrganizationTemplateWhitelist(Category::VLM));
    }

    public function testDefaultUrlsAndAllowedPrimaryDomains(): void
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
            'https://ark.cn-beijing.volces.com/api/v3',
            ProviderCode::VolcengineArk->getDefaultUrl()
        );
        $this->assertSame(
            'https://api.deepseek.com',
            ProviderCode::DeepSeek->getDefaultUrl()
        );
        $this->assertSame(
            'https://api.hunyuan.cloud.tencent.com/v1',
            ProviderCode::Tencent->getDefaultUrl()
        );
        $this->assertSame(
            'https://qianfan.baidubce.com/v2',
            ProviderCode::Baidu->getDefaultUrl()
        );
        $this->assertSame(
            'https://api.scnet.cn/api/llm/v1',
            ProviderCode::SCNet->getDefaultUrl()
        );
        $this->assertSame(
            'https://api.moonshot.cn/v1',
            ProviderCode::Moonshot->getDefaultUrl()
        );
        $this->assertSame(
            'https://open.bigmodel.cn/api/paas/v4',
            ProviderCode::BigModel->getDefaultUrl()
        );
        $this->assertSame(
            'https://api.minimaxi.com/v1',
            ProviderCode::MiniMax->getDefaultUrl()
        );
        $this->assertSame(
            'https://api.siliconflow.cn/v1',
            ProviderCode::SiliconFlow->getDefaultUrl()
        );
        $this->assertSame('', ProviderCode::OpenAI->getDefaultUrl());

        $this->assertSame(['aliyuncs.com'], ProviderCode::DashScope->getAllowedPrimaryDomains());
        $this->assertSame(['volces.com'], ProviderCode::Volcengine->getAllowedPrimaryDomains());
        $this->assertSame(['volces.com'], ProviderCode::VolcengineArk->getAllowedPrimaryDomains());
        $this->assertSame(['deepseek.com'], ProviderCode::DeepSeek->getAllowedPrimaryDomains());
        $this->assertSame(['tencent.com'], ProviderCode::Tencent->getAllowedPrimaryDomains());
        $this->assertSame(['baidubce.com'], ProviderCode::Baidu->getAllowedPrimaryDomains());
        $this->assertSame(['scnet.cn'], ProviderCode::SCNet->getAllowedPrimaryDomains());
        $this->assertSame(['moonshot.cn'], ProviderCode::Moonshot->getAllowedPrimaryDomains());
        $this->assertSame(['bigmodel.cn'], ProviderCode::BigModel->getAllowedPrimaryDomains());
        $this->assertSame(['minimaxi.com'], ProviderCode::MiniMax->getAllowedPrimaryDomains());
        $this->assertSame(['siliconflow.cn'], ProviderCode::SiliconFlow->getAllowedPrimaryDomains());
        $this->assertSame([], ProviderCode::OpenAI->getAllowedPrimaryDomains());
    }

    public function testAllowedPrimaryDomainUrlValidation(): void
    {
        $this->assertTrue(
            ProviderCode::DashScope->isAllowedPrimaryDomainUrl('https://dashscope.aliyuncs.com/compatible-mode/v1')
        );
        $this->assertTrue(
            ProviderCode::Tencent->isAllowedPrimaryDomainUrl('https://api.hunyuan.cloud.tencent.com/v1')
        );
        $this->assertTrue(
            ProviderCode::Baidu->isAllowedPrimaryDomainUrl('https://qianfan.baidubce.com/v2')
        );
        $this->assertTrue(
            ProviderCode::BigModel->isAllowedPrimaryDomainUrl('https://open.bigmodel.cn/api/paas/v4')
        );
        $this->assertTrue(
            ProviderCode::SiliconFlow->isAllowedPrimaryDomainUrl('https://api.siliconflow.cn/v1/chat/completions')
        );
        $this->assertTrue(
            ProviderCode::VolcengineArk->isAllowedPrimaryDomainUrl('https://ark.cn-beijing.volces.com/api/v3')
        );
        $this->assertTrue(
            ProviderCode::VolcengineArk->isAllowedPrimaryDomainUrl('https://sub.ark.cn-beijing.volces.com/api/v3')
        );

        $this->assertFalse(
            ProviderCode::DeepSeek->isAllowedPrimaryDomainUrl('https://api.openai.com/v1')
        );
        $this->assertFalse(
            ProviderCode::Volcengine->isAllowedPrimaryDomainUrl('not-a-valid-url')
        );
        $this->assertFalse(
            ProviderCode::SCNet->isAllowedPrimaryDomainUrl('https://api.scnet.com/v1')
        );
        $this->assertFalse(
            ProviderCode::VolcengineArk->isAllowedPrimaryDomainUrl('https://ark.cn-beijing.volces.example.com/api/v3')
        );
    }
}
