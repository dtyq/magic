<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Domain\Market\Service;

use Dtyq\SuperMagic\Domain\Market\Service\MarketSearchTextBuilder;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class MarketSearchTextBuilderTest extends TestCase
{
    public function testBuildDeduplicatesAndLowercasesTexts(): void
    {
        $searchText = MarketSearchTextBuilder::build(
            [
                'Magic.Web.Search',
                'Search PACKAGE',
                'V1.0.0',
            ],
            [
                [
                    'en_US' => 'Web Search',
                    'default' => 'WEB SEARCH',
                    'zh_CN' => '网页搜索',
                ],
                [
                    'en_US' => 'Find Useful Info',
                    'zh_CN' => '检索有用信息',
                ],
                [
                    'en_US' => ['Marketing Analyst', 'Content Creator'],
                    'zh_CN' => ['市场分析师', '内容创作者'],
                ],
                [
                    'en_US' => 'Release Notes',
                    'zh_CN' => '版本说明',
                ],
            ]
        );

        $this->assertSame($searchText, mb_strtolower($searchText, 'UTF-8'));
        $this->assertStringContainsString('magic.web.search', $searchText);
        $this->assertStringContainsString('search package', $searchText);
        $this->assertStringContainsString('v1.0.0', $searchText);
        $this->assertStringContainsString('web search', $searchText);
        $this->assertStringContainsString('网页搜索', $searchText);
        $this->assertStringContainsString('find useful info', $searchText);
        $this->assertStringContainsString('marketing analyst', $searchText);
        $this->assertStringContainsString('content creator', $searchText);
        $this->assertStringContainsString('release notes', $searchText);
        $this->assertSame(1, substr_count($searchText, 'web search'));
    }
}
