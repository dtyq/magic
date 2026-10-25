<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Skill;

use App\Application\SuperMagic\Skill\Import\SkillPackageParser;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ZipArchive;

/**
 * @internal
 */
class SkillPackageParserTest extends TestCase
{
    public function testParseFileReadsPackageNameAndDescription(): void
    {
        $zipPath = sys_get_temp_dir() . '/official_skill_' . uniqid() . '.zip';
        $zip = new ZipArchive();
        $this->assertSame(true, $zip->open($zipPath, ZipArchive::CREATE));
        $zip->addFromString('demo-skill/SKILL.md', "---\nname: demo-skill\ndescription: Official demo\n---\n");
        $zip->close();

        try {
            /** @var SkillPackageParser $parser */
            $parser = (new ReflectionClass(SkillPackageParser::class))->newInstanceWithoutConstructor();
            $result = $parser->parseFile($zipPath, 'official/demo.zip', true);

            $this->assertSame('official/demo.zip', $result->fileKey);
            $this->assertSame('demo-skill', $result->packageName);
            $this->assertSame('Official demo', $result->packageDescription);
            $this->assertSame(hash_file('sha256', $zipPath), $result->sha256);
            $this->assertSame(['SKILL.md' => hash('sha256', "---\nname: demo-skill\ndescription: Official demo\n---\n")], $result->manifest);
        } finally {
            @unlink($zipPath);
        }
    }
}
