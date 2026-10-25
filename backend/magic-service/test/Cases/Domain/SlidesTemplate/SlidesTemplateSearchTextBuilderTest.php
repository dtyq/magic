<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\SlidesTemplate;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateCategoryEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateTagStatus;
use App\Domain\SlidesTemplate\Service\SlidesTemplateSearchTextBuilder;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class SlidesTemplateSearchTextBuilderTest extends TestCase
{
    public function testBuildIncludesTemplateCategoryAndTagNames(): void
    {
        $template = (new SlidesTemplateEntity())
            ->setCode('REPORT-001')
            ->setCategoryCode('business')
            ->setLabel(['zh_CN' => '年度总结'])
            ->setDescription(['zh_CN' => '公司经营复盘']);
        $category = (new SlidesTemplateCategoryEntity())
            ->setCode('business')
            ->setNameI18n(['zh_CN' => '商务汇报']);
        $tag = (new SlidesTemplateTagEntity())
            ->setCode('featured')
            ->setNameI18n(['zh_CN' => '精选模板']);

        $text = SlidesTemplateSearchTextBuilder::build($template, $category, [$tag]);

        self::assertStringContainsString('年度总结', $text);
        self::assertStringContainsString('商务汇报', $text);
        self::assertStringContainsString('精选模板', $text);
        self::assertStringContainsString('featured', $text);
    }

    public function testBuildIgnoresDisabledTags(): void
    {
        $template = (new SlidesTemplateEntity())->setCode('REPORT-001');
        $tag = (new SlidesTemplateTagEntity())
            ->setCode('deprecated')
            ->setNameI18n(['zh_CN' => '已废弃'])
            ->setStatus(SlidesTemplateTagStatus::Disabled);

        $text = SlidesTemplateSearchTextBuilder::build($template, tags: [$tag]);

        self::assertStringNotContainsString('deprecated', $text);
        self::assertStringNotContainsString('已废弃', $text);
    }
}
