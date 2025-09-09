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
 * Test for SuperMagicAgent.description_generator.
 * @internal
 */
class DescriptionGeneratorAgentTest extends HttpTestCase
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

        $agent = $this->microAgentFactory->getAgent('SuperMagicAgent.description_generator');

        $response = $agent->easyCall(
            organizationCode: 'DT001',
            systemReplace: [
                'agent_name' => 'DataInsight Pro',
                'core_functions' => '数据可视化、统计分析、预测建模、报告生成、多数据源接入',
                'domain' => '企业数据分析',
                'target_users' => '数据分析师、业务分析师、产品经理、运营人员',
                'use_cases' => '业务数据分析、用户行为分析、销售预测、运营决策支持',
                'key_advantages' => '一站式解决方案、智能分析建议、可视化效果优秀、学习成本低',
                'special_abilities' => '自动化数据清洗、智能图表推荐、预测分析、交互式报告',
            ],
            userPrompt: '请优化这个智能体的描述',
            businessParams: [
                'organization_id' => 'DT001',
                'user_id' => 'user_123456',
            ]
        );

        $this->assertNotEmpty($response);
        $this->assertStringContainsString('数据', $response);
        $this->assertStringContainsString('分析', $response);
        // 确保返回的是生成的描述，简洁专业
        $this->assertStringNotContainsString('要求', $response);
        $this->assertStringNotContainsString('基于以下', $response);
    }
}
