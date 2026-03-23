<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Domain\Skill\Service;

use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillMarketSearchTextBuilder;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class SkillMarketSearchTextBuilderTest extends TestCase
{
    public function testBuildFromSkillVersionDeduplicatesAndLowercasesTexts(): void
    {
        $skillVersion = new SkillVersionEntity([
            'id' => 1,
            'code' => 'skill_code',
            'organization_code' => 'org',
            'creator_id' => 'user_1',
            'package_name' => 'Magic.Web.Search',
            'package_description' => 'Search PACKAGE',
            'version' => 'V1.0.0',
            'name_i18n' => [
                'en_US' => 'Web Search',
                'default' => 'WEB SEARCH',
                'zh_CN' => '网页搜索',
            ],
            'description_i18n' => [
                'en_US' => 'Find Useful Info',
                'zh_CN' => '检索有用信息',
            ],
            'version_description_i18n' => [
                'en_US' => 'Release Notes',
                'zh_CN' => '版本说明',
            ],
            'source_type' => 'LOCAL_UPLOAD',
        ]);

        $searchText = SkillMarketSearchTextBuilder::buildFromSkillVersion($skillVersion);

        $this->assertSame($searchText, mb_strtolower($searchText, 'UTF-8'));
        $this->assertStringContainsString('magic.web.search', $searchText);
        $this->assertStringContainsString('search package', $searchText);
        $this->assertStringContainsString('v1.0.0', $searchText);
        $this->assertStringContainsString('web search', $searchText);
        $this->assertStringContainsString('网页搜索', $searchText);
        $this->assertStringContainsString('find useful info', $searchText);
        $this->assertStringContainsString('release notes', $searchText);
        $this->assertSame(1, substr_count($searchText, 'web search'));
    }
}
