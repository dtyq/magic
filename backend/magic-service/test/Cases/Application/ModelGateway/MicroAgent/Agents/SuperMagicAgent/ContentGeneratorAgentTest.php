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
 * Test for SuperMagicAgent.content_generator.
 * @internal
 */
class ContentGeneratorAgentTest extends HttpTestCase
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

        $agent = $this->microAgentFactory->getAgent('SuperMagicAgent.content_generator');

        $response = $agent->easyCall(
            organizationCode: 'DT001',
            systemReplace: [
                'agent_name' => '代码审查助手',
                'agent_description' => '专业的代码审查和质量分析智能助手，能够检查代码规范、发现潜在问题并提供改进建议',
                'target_users' => '软件开发工程师、技术负责人、代码审查员',
                'use_cases' => '代码提交前审查、代码质量评估、开发规范检查、技术债务分析',
            ],
            userPrompt: '请生成这个智能体的完整系统提示词',
            businessParams: [
                'organization_id' => 'DT001',
                'user_id' => 'user_123456',
            ]
        );

        $this->assertNotEmpty($response);
        $this->assertStringContainsString('代码审查', $response);
        $this->assertStringContainsString('你是', $response);
    }
}
