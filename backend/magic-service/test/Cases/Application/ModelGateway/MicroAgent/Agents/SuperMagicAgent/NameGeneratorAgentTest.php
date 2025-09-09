<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\MicroAgent\Agents\SuperMagicAgent;

use App\Application\ModelGateway\MicroAgent\AgentParser\AgentParserFactory;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use HyperfTest\HttpTestCase;

/**
 * Test for SuperMagicAgent.name_generator.
 * @internal
 */
class NameGeneratorAgentTest extends HttpTestCase
{
    private MicroAgentFactory $microAgentFactory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->microAgentFactory = new MicroAgentFactory(new AgentParserFactory());
    }

    public function testEasyCall(): void
    {
        $this->markTestSkipped('Requires actual API calls and valid configuration.');

        $agent = $this->microAgentFactory->getAgent('SuperMagicAgent.name_generator');

        $response = $agent->easyCall(
            organizationCode: 'DT001',
            systemReplace: [
                'functionality' => '文档自动生成和格式化，支持多种文档格式输出',
                'domain' => '企业办公自动化',
                'target_audience' => '产品经理、技术文档编写者、项目管理人员',
                'key_features' => '智能模板选择、内容自动填充、格式美化、多格式导出',
                'style_preference' => '专业、简洁、易理解',
            ],
            userPrompt: '请为这个智能体生成一个最合适的名称',
            businessParams: [
                'organization_id' => 'DT001',
                'user_id' => 'user_123456',
            ]
        );

        $this->assertNotEmpty($response);
        $this->assertStringContainsString('文档', $response);
        // 确保只返回一个名称，不包含编号或多个选项
        $this->assertStringNotContainsString('1.', $response);
        $this->assertStringNotContainsString('2.', $response);
    }
}
