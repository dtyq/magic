<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util;

use App\Infrastructure\Util\SkillUtil;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Throwable;

/**
 * SkillUtil 单元测试（findSkillMdDirectory、parseSkillMd）.
 *
 * @internal
 */
#[CoversClass(SkillUtil::class)]
class SkillUtilTest extends TestCase
{
    private string $tempBaseDir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tempBaseDir = sys_get_temp_dir() . '/skill_util_test_' . uniqid();
        mkdir($this->tempBaseDir, 0755, true);
    }

    protected function tearDown(): void
    {
        try {
            if (isset($this->tempBaseDir) && is_dir($this->tempBaseDir)) {
                $this->removeDirectory($this->tempBaseDir);
            }
        } finally {
            parent::tearDown();
        }
    }

    /**
     * 根目录包含 SKILL.md 时应返回根目录.
     */
    public function testFindSkillMdInRootDirectory(): void
    {
        file_put_contents($this->tempBaseDir . '/SKILL.md', 'name: test-skill');

        $result = SkillUtil::findSkillMdDirectory($this->tempBaseDir);

        $this->assertSame($this->tempBaseDir, $result);
    }

    /**
     * 一层子目录包含 SKILL.md 时应返回该子目录路径.
     */
    public function testFindSkillMdInFirstLevelSubdirectory(): void
    {
        $subDir = $this->tempBaseDir . '/my-skill';
        mkdir($subDir, 0755, true);
        file_put_contents($subDir . '/SKILL.md', 'name: my-skill');

        $result = SkillUtil::findSkillMdDirectory($this->tempBaseDir);

        $this->assertSame($subDir, $result);
    }

    /**
     * 深层子目录包含 SKILL.md 时应递归查找并返回该目录路径.
     */
    public function testFindSkillMdInNestedSubdirectory(): void
    {
        $nestedDir = $this->tempBaseDir . '/level1/level2/skill-dir';
        mkdir($nestedDir, 0755, true);
        file_put_contents($nestedDir . '/SKILL.md', 'name: nested-skill');

        $result = SkillUtil::findSkillMdDirectory($this->tempBaseDir);

        $this->assertSame($nestedDir, $result);
    }

    /**
     * 应跳过 __MACOSX 目录.
     */
    public function testSkipMacOSXDirectory(): void
    {
        $macosxDir = $this->tempBaseDir . '/__MACOSX';
        $skillDir = $this->tempBaseDir . '/actual-skill';
        mkdir($macosxDir, 0755, true);
        mkdir($skillDir, 0755, true);
        file_put_contents($skillDir . '/SKILL.md', 'name: actual-skill');

        $result = SkillUtil::findSkillMdDirectory($this->tempBaseDir);

        $this->assertSame($skillDir, $result);
    }

    /**
     * 未找到 SKILL.md 时应返回 null.
     */
    public function testReturnNullWhenSkillMdNotFound(): void
    {
        mkdir($this->tempBaseDir . '/empty-dir', 0755, true);
        file_put_contents($this->tempBaseDir . '/readme.md', '# Readme');

        $result = SkillUtil::findSkillMdDirectory($this->tempBaseDir);

        $this->assertNull($result);
    }

    /**
     * 传入非目录路径时应返回 null.
     */
    public function testReturnNullWhenBaseDirIsNotDirectory(): void
    {
        $filePath = $this->tempBaseDir . '/not-a-dir';
        file_put_contents($filePath, 'content');

        $result = SkillUtil::findSkillMdDirectory($filePath);

        $this->assertNull($result);
    }

    /**
     * 传入不存在的路径时应返回 null.
     */
    public function testReturnNullWhenBaseDirDoesNotExist(): void
    {
        $nonExistent = $this->tempBaseDir . '/nonexistent_' . uniqid();

        $result = SkillUtil::findSkillMdDirectory($nonExistent);

        $this->assertNull($result);
    }

    /**
     * 多个子目录时优先返回第一个包含 SKILL.md 的目录.
     */
    public function testReturnsFirstFoundSkillDirectory(): void
    {
        $firstDir = $this->tempBaseDir . '/first';
        $secondDir = $this->tempBaseDir . '/second';
        mkdir($firstDir, 0755, true);
        mkdir($secondDir, 0755, true);
        file_put_contents($firstDir . '/SKILL.md', 'name: first');
        file_put_contents($secondDir . '/SKILL.md', 'name: second');

        $result = SkillUtil::findSkillMdDirectory($this->tempBaseDir);

        $this->assertSame($firstDir, $result);
    }

    // ========== parseSkillMd 测试 ==========

    /**
     * 标准格式 SKILL.md 应正确解析 name 和 description.
     */
    public function testParseSkillMdStandardFormat(): void
    {
        $skillDir = $this->tempBaseDir . '/my-skill';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        file_put_contents($skillMdPath, "name: my-skill\ndescription: A test skill");

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertSame('my-skill', $name);
        $this->assertSame('A test skill', $desc);
    }

    /**
     * name 为空时使用目录名作为 fallback.
     */
    public function testParseSkillMdEmptyNameUsesDirectoryFallback(): void
    {
        $skillDir = $this->tempBaseDir . '/data-table-expert';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        file_put_contents($skillMdPath, "description: Some desc\n# no name field");

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertSame('data-table-expert', $name);
        $this->assertSame('Some desc', $desc);
    }

    /**
     * name 含空格/特殊字符时 sanitize 后使用，description 保留原文.
     */
    public function testParseSkillMdInvalidNameFormatSanitizes(): void
    {
        $skillDir = $this->tempBaseDir . '/valid-skill-name';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        file_put_contents($skillMdPath, 'name: Invalid Name!@#');

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertSame('invalid-name', $name);
        $this->assertSame('Invalid Name!@#', $desc);
    }

    /**
     * 支持 YAML frontmatter 格式（--- 包裹）.
     */
    public function testParseSkillMdYamlFrontmatterFormat(): void
    {
        $skillDir = $this->tempBaseDir . '/agent-browser';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        $content = <<<'MD'
---
name: Agent Browser
description: A fast Rust-based headless browser automation CLI with Node.js fallback.
read_when:
  - Automating web interactions
metadata: {}
---
MD;
        file_put_contents($skillMdPath, $content);

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertSame('agent-browser', $name);
        $this->assertSame('A fast Rust-based headless browser automation CLI with Node.js fallback.', $desc);
    }

    /**
     * frontmatter 中 description: | 多行块 + 正文 # 标题（无 YAML name 冲突）.
     */
    public function testParseSkillMdFrontmatterDescriptionBlockScalar(): void
    {
        $skillDir = $this->tempBaseDir . '/travel-planner-pkg';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        $content = <<<'MD'
---
name: travel-planner
description: |
Comprehensive travel planning assistance including itinerary creation and budget planning.
---

# Travel Planner

MD;
        file_put_contents($skillMdPath, $content);

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertSame('travel-planner', $name);
        $this->assertStringContainsString('Comprehensive travel planning assistance', $desc);
        $this->assertStringNotContainsString('# Travel Planner', $desc);
    }

    /**
     * frontmatter 中 description: 全角 ｜ 作为块标量起始（与 ASCII | 等价语义）.
     */
    public function testParseSkillMdFrontmatterDescriptionFullwidthPipe(): void
    {
        $skillDir = $this->tempBaseDir . '/fullwidth-pipe-skill';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        $content = "---\nname: demo-skill\ndescription: \u{FF5C}\nFirst line of block.\nSecond line.\n---\n";
        file_put_contents($skillMdPath, $content);

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertSame('demo-skill', $name);
        $this->assertSame("First line of block.\nSecond line.", $desc);
    }

    /**
     * frontmatter 中 description: >- 折叠块 + 缩进续行（YAML folded scalar）.
     */
    public function testParseSkillMdFrontmatterDescriptionFoldedBlock(): void
    {
        $skillDir = $this->tempBaseDir . '/stock-market-pro-pkg';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        $content = <<<'MD'
---
name: stock-market-pro
description: >-
  Yahoo Finance (yfinance) powered stock analysis skill: quotes, fundamentals,
  ASCII trends, high-resolution charts (RSI/MACD/BB/VWAP/ATR), plus optional
  web add-ons (news + browser-first options/flow).
---

MD;
        file_put_contents($skillMdPath, $content);

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertSame('stock-market-pro', $name);
        $this->assertStringContainsString('Yahoo Finance (yfinance) powered stock analysis skill:', $desc);
        $this->assertStringContainsString('web add-ons (news + browser-first options/flow).', $desc);
        $this->assertStringNotContainsString("\n  ", $desc);
    }

    /**
     * 无 YAML name 时从 Markdown 解析：简介 + ## 激活条件.
     */
    public function testParseSkillMdMarkdownChineseActivationSection(): void
    {
        $skillDir = $this->tempBaseDir . '/baidu-search-skill';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        $content = <<<'MD'
# Baidu Search Skill

百度搜索命令行工具，通过 Node.js 脚本爬取结果。

## 激活条件

当用户提到：
- 百度搜索
- baidu search

MD;
        file_put_contents($skillMdPath, $content);

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertSame('baidu-search-skill', $name);
        $this->assertStringContainsString('百度搜索命令行工具', $desc);
        $this->assertStringContainsString('## 激活条件', $desc);
        $this->assertStringContainsString('百度搜索', $desc);
    }

    /**
     * 无 YAML name 时从 Markdown 解析：英文 ## When to use 激活节.
     */
    public function testParseSkillMdMarkdownEnglishWhenToUseSection(): void
    {
        $skillDir = $this->tempBaseDir . '/when-to-use-skill';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        $content = <<<'MD'
# Email Helper

Formats and sends transactional email.

## When to use

- User asks to draft an email
- User needs a subject line

MD;
        file_put_contents($skillMdPath, $content);

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertSame('email-helper', $name);
        $this->assertStringContainsString('Formats and sends transactional email.', $desc);
        $this->assertStringContainsString('## When to use', $desc);
        $this->assertStringContainsString('draft an email', $desc);
    }

    /**
     * 支持 clawhub/clawdbot 格式：description: | 多行块 + compatibility + metadata 嵌套.
     */
    public function testParseSkillMdClawdbotYoutubeFormat(): void
    {
        $skillDir = $this->tempBaseDir . '/youtube';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        $content = <<<'MD'
---
name: youtube
description: |
  YouTube Data API integration with managed OAuth. Search videos, manage playlists, access channel data, and interact with comments. Use this skill when users want to interact with YouTube. For other third party apps, use the api-gateway skill (https://clawhub.ai/byungkyu/api-gateway).
compatibility: Requires network access and valid Maton API key
metadata:
  author: maton
  version: "1.0"
  clawdbot:
    emoji: 🧠
    requires:
      env:
        - MATON_API_KEY
---
MD;
        file_put_contents($skillMdPath, $content);

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertSame('youtube', $name);
        $this->assertStringContainsString('YouTube Data API integration with managed OAuth', $desc);
        $this->assertStringContainsString('Search videos, manage playlists, access channel data', $desc);
        $this->assertStringContainsString('clawhub.ai/byungkyu/api-gateway', $desc);
    }

    /**
     * 完全空的 SKILL.md 使用目录名作为 name 和 description.
     */
    public function testParseSkillMdEmptyContentUsesDirectoryFallback(): void
    {
        $skillDir = $this->tempBaseDir . '/empty-skill';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        file_put_contents($skillMdPath, '');

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertSame('empty-skill', $name);
        $this->assertSame('empty-skill', $desc);
    }

    /**
     * 目录名含非法字符时 sanitize 后作为 packageName.
     */
    public function testParseSkillMdSanitizesFallbackPackageName(): void
    {
        $skillDir = $this->tempBaseDir . '/My Skill (v1.0)';
        mkdir($skillDir, 0755, true);
        $skillMdPath = $skillDir . '/SKILL.md';
        file_put_contents($skillMdPath, '# No metadata');

        [$name, $desc] = SkillUtil::parseSkillMd($skillMdPath);

        $this->assertMatchesRegularExpression('/^[a-z0-9\-_]+$/', $name);
        $this->assertSame('My Skill (v1.0)', $desc);
    }

    /**
     * 文件不存在时应抛出异常.
     */
    public function testParseSkillMdThrowsWhenFileNotFound(): void
    {
        $this->expectException(Throwable::class);
        SkillUtil::parseSkillMd($this->tempBaseDir . '/nonexistent/SKILL.md');
    }

    /**
     * 路径不是 SKILL.md 时应抛出异常.
     */
    public function testParseSkillMdThrowsWhenNotSkillMd(): void
    {
        $filePath = $this->tempBaseDir . '/readme.md';
        file_put_contents($filePath, 'name: test');

        $this->expectException(Throwable::class);
        SkillUtil::parseSkillMd($filePath);
    }

    /**
     * 递归删除目录.
     */
    private function removeDirectory(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }
        $items = scandir($dir);
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = $dir . '/' . $item;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }
}
