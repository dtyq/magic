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
 * Test for SuperMagicAgent.tool_recommender.
 * @internal
 */
class ToolRecommenderAgentTest extends HttpTestCase
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

        $agent = $this->microAgentFactory->getAgent('SuperMagicAgent.tool_recommender');

        $response = $agent->easyCall(
            organizationCode: 'DT001',
            systemReplace: [
                'agent_name' => '智能客服助手',
                'core_functions' => '自然语言理解、智能问答、情感识别、工单创建、知识库查询',
                'domain' => '客户服务',
                'target_users' => '客服人员、客户成功团队、运营人员',
                'use_cases' => '在线客户咨询、工单处理、问题解答、客户情感分析',
                'workflow' => '接收客户问题 → 理解意图 → 查询知识库 → 生成回复 → 创建工单',
                'special_requirements' => '支持多渠道接入、实时响应、情感识别',
            ],
            userPrompt: '请为这个智能体推荐合适的工具列表',
            businessParams: [
                'organization_id' => 'DT001',
                'user_id' => 'user_123456',
            ]
        );

        $this->assertNotEmpty($response);
        // 确保返回的是JSON格式的工具代码列表
        $this->assertStringContainsString('[', $response);
        $this->assertStringContainsString(']', $response);
        $this->assertStringContainsString('"', $response);
        // 验证包含客服相关工具
        $decoded = json_decode(trim($response), true);
        $this->assertIsArray($decoded);
    }
}
