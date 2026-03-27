<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Infrastructure\Utils;

use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Infrastructure\Utils\SkillProjectConfigUtil;
use PHPUnit\Framework\TestCase;

class SkillProjectConfigUtilTest extends TestCase
{
    public function testBuildAndRenderConfigFromSkillEntity(): void
    {
        $skillEntity = new SkillEntity();
        $skillEntity->setPackageName('my-skill');
        $skillEntity->setPackageDescription('Fallback description');
        $skillEntity->setNameI18n([
            'zh_CN' => '我的技能',
            'en_US' => 'My Skill',
        ]);
        $skillEntity->setDescriptionI18n([
            'zh_CN' => '中文描述',
            'en_US' => "English \"description\"\nline2",
        ]);

        $config = SkillProjectConfigUtil::buildConfig($skillEntity);
        $yaml = SkillProjectConfigUtil::render($config);

        self::assertSame('my-skill', $config['skill']['dir']);
        self::assertStringContainsString('skill:', $yaml);
        self::assertStringContainsString('  dir: "my-skill"', $yaml);
        self::assertStringContainsString('  name-cn: "我的技能"', $yaml);
        self::assertStringContainsString('  description-en: "English \\"description\\"\\nline2"', $yaml);
    }

    public function testParseRenderedConfigRoundTripsEscapedValues(): void
    {
        $content = implode("\n", [
            'skill:',
            '  dir: "renamed-skill"',
            '  name: "my-skill"',
            '  description: "English \\"description\\"\\nline2"',
            '',
            '  name-cn: "中文名"',
            '  description-cn: "中文描述"',
            '',
            '  name-en: "English Name"',
            '  description-en: "English \\\\ path"',
            '',
        ]);

        $config = SkillProjectConfigUtil::parse($content);

        self::assertSame('renamed-skill', $config['skill']['dir']);
        self::assertSame("English \"description\"\nline2", $config['skill']['description']);
        self::assertSame('中文描述', $config['skill']['description-cn']);
        self::assertSame('English \\ path', $config['skill']['description-en']);
    }

    public function testValidateSkillDir(): void
    {
        self::assertTrue(SkillProjectConfigUtil::isValidSkillDir('skill_dir-1'));
        self::assertFalse(SkillProjectConfigUtil::isValidSkillDir(''));
        self::assertFalse(SkillProjectConfigUtil::isValidSkillDir('../escape'));
        self::assertFalse(SkillProjectConfigUtil::isValidSkillDir('nested/path'));
        self::assertFalse(SkillProjectConfigUtil::isValidSkillDir('/absolute'));
        self::assertFalse(SkillProjectConfigUtil::isValidSkillDir(' two-spaces '));
    }
}
