<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Infrastructure\Utils;

use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Infrastructure\Utils\SkillProjectConfigUtil;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class SkillProjectConfigUtilTest extends TestCase
{
    public function testBuildAndRenderConfigFromSkillEntity(): void
    {
        $skillEntity = new SkillEntity();
        $skillEntity->setPackageName('my-skill');

        $config = SkillProjectConfigUtil::buildConfig($skillEntity);
        $yaml = SkillProjectConfigUtil::render($config);

        self::assertSame('my-skill', $config['skill']['dir']);
        self::assertSame("skill:\n  dir: my-skill\n", $yaml);
    }

    public function testParseSupportsMinimalConfig(): void
    {
        $content = implode("\n", [
            'skill:',
            '  dir: "renamed-skill"',
            '',
        ]);

        $config = SkillProjectConfigUtil::parse($content);

        self::assertSame('renamed-skill', $config['skill']['dir']);
        self::assertSame(['skill' => ['dir' => 'renamed-skill']], $config);
    }

    public function testParseRemainsCompatibleWithLegacyRichConfig(): void
    {
        $content = implode("\n", [
            'skill:',
            '  dir: "legacy-skill"',
            '  name: "my-skill"',
            '  description: "English \"description\"\nline2"',
            '',
            '  name-cn: "中文名"',
            '  description-cn: "中文描述"',
            '',
            '  name-en: "English Name"',
            '  description-en: "English \\\ path"',
            '',
        ]);

        $config = SkillProjectConfigUtil::parse($content);

        self::assertSame('legacy-skill', $config['skill']['dir']);
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
