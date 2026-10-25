<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Agent;

use App\Domain\SuperMagic\Agent\Entity\AgentCategoryEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Service\AgentMarketSearchTextBuilder;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class AgentMarketSearchTextBuilderTest extends TestCase
{
    public function testBuildSemanticTextIncludesBilingualMarketAndCategoryContent(): void
    {
        $market = new AgentMarketEntity([
            'agent_code' => 'market-analyst',
            'name_i18n' => ['zh_CN' => '市场分析师', 'en_US' => 'Marketing Analyst'],
            'role_i18n' => ['zh_CN' => ['竞品分析'], 'en_US' => ['Market Research']],
            'description_i18n' => ['zh_CN' => '分析市场趋势', 'en_US' => 'Analyze market trends'],
        ]);
        $categories = [
            new AgentCategoryEntity([
                'name_i18n' => ['zh_CN' => '市场分析', 'en_US' => 'Market Analysis'],
            ]),
        ];

        $semanticText = AgentMarketSearchTextBuilder::buildSemanticText($market, $categories);

        self::assertStringContainsString('market analyst', $semanticText);
        self::assertStringContainsString('市场分析师', $semanticText);
        self::assertStringContainsString('market research', $semanticText);
        self::assertStringContainsString('分析市场趋势', $semanticText);
        self::assertStringContainsString('market analysis', $semanticText);
        self::assertStringContainsString('名称：', $semanticText);
        self::assertStringContainsString('角色定位：', $semanticText);
        self::assertStringContainsString('能力描述：', $semanticText);
        self::assertStringContainsString('分类：', $semanticText);
        self::assertStringNotContainsString('market-analyst', $semanticText);
    }
}
