<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\ErrorCode\SkillErrorCode;
use Hyperf\Logger\LoggerFactory;
use RuntimeException;
use Throwable;

/**
 * Skill 解析工具类.
 * 提供 Skill 文件解析等通用方法.
 */
class SkillUtil
{
    /**
     * 解析 SKILL.md 时默认只读取前 N 字节，避免大文件内容爆炸.
     * 支持 YAML frontmatter（--- 包裹），name/description 通常在文件前部.
     */
    private const PARSE_SKILL_MD_MAX_READ_LENGTH = 1024;

    /**
     * 解析 SKILL.md 文件.
     *
     * @param string $skillMdPath SKILL.md 文件路径
     * @return array{0: string, 1: string} 返回 [packageName, packageDescription]
     * @throws RuntimeException 当文件读取失败或解析失败时抛出异常
     */
    public static function parseSkillMd(string $skillMdPath): array
    {
        // 检查文件路径是否为 SKILL.md
        if (basename($skillMdPath) !== 'SKILL.md') {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_MD_NOT_FOUND, 'skill.skill_md_not_found');
        }

        // 检查文件是否存在
        if (! file_exists($skillMdPath)) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_MD_NOT_FOUND, 'skill.skill_md_not_found');
        }

        // 读取文件内容（仅前 N 字节，避免大文件内容爆炸）
        $content = file_get_contents($skillMdPath, false, null, 0, self::PARSE_SKILL_MD_MAX_READ_LENGTH);
        if ($content === false) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_MD_READ_FAILED, 'skill.skill_md_read_failed');
        }

        self::logSkillUtil('开始解析 SKILL.md', ['path' => $skillMdPath]);

        // 简单的 YAML 解析（仅解析 name 和 description）
        // 实际项目中应使用 symfony/yaml 等库
        $packageName = '';
        $packageDescription = '';

        $lines = explode("\n", $content);
        $frontmatterSplit = self::splitYamlFrontmatter($lines);
        if ($frontmatterSplit !== null) {
            [$fmLines] = $frontmatterSplit;
            [$packageName, $packageDescription] = self::parseFrontmatterNameAndDescription($fmLines);
        } else {
            foreach ($lines as $line) {
                $line = trim($line);
                if (str_starts_with($line, 'name:')) {
                    $packageName = trim(substr($line, 5));
                    $packageName = trim($packageName, '"\'');
                } elseif (str_starts_with($line, 'description:')) {
                    $packageDescription = trim(substr($line, 12));
                    $packageDescription = trim($packageDescription, '"\'');
                }
            }
        }

        if ($packageName === '') {
            $markdownParsed = self::tryParseMarkdownSkillDocument($content);
            if ($markdownParsed !== null) {
                [$mdTitle, $mdDescription] = $markdownParsed;
                $packageName = $mdTitle;
                if ($packageDescription === '') {
                    $packageDescription = $mdDescription;
                }
            }
        }

        // 支持 YAML frontmatter（--- 包裹）及普通格式；name 含空格/大小写时 sanitize
        $fallbackDirName = basename(dirname($skillMdPath));
        $fallbackPackageName = self::sanitizePackageName($fallbackDirName);

        if (empty($packageName)) {
            self::logSkillUtil('SKILL.md 缺少 name，使用目录名 fallback', [
                'path' => $skillMdPath,
                'fallbackDirName' => $fallbackDirName,
            ]);
            $packageName = $fallbackPackageName ?: 'skill';
            $packageDescription = $packageDescription ?: $fallbackDirName;
        } elseif (! preg_match('/^[a-z0-9\-_]+$/', $packageName) || strlen($packageName) > 128) {
            // 用户提供了 name 但格式不符（如 "Agent Browser"），sanitize 后使用
            $originalName = $packageName;
            $packageName = self::sanitizePackageName($packageName) ?: $fallbackPackageName ?: 'skill';
            $packageDescription = $packageDescription ?: $originalName;
            self::logSkillUtil('SKILL.md name 格式已 sanitize', [
                'path' => $skillMdPath,
                'originalName' => $originalName,
                'packageName' => $packageName,
            ]);
        } else {
            $packageDescription = $packageDescription ?: $packageName;
        }

        self::logSkillUtil('解析 SKILL.md 完成', [
            'path' => $skillMdPath,
            'packageName' => $packageName,
            'packageDescription' => $packageDescription,
        ]);

        return [$packageName, $packageDescription];
    }

    /**
     * 在指定目录及其子目录中查找包含 SKILL.md 的目录.
     * 优先检查根目录，其次一层子目录，若子目录无 SKILL.md 则递归遍历其子目录.
     *
     * @param string $baseDir 要搜索的根目录路径
     * @return null|string 包含 SKILL.md 的目录路径，未找到时返回 null
     */
    public static function findSkillMdDirectory(string $baseDir): ?string
    {
        self::logSkillUtil('开始查找 SKILL.md', ['baseDir' => $baseDir]);

        if (! is_dir($baseDir)) {
            self::logSkillUtil('baseDir 不是有效目录', ['baseDir' => $baseDir]);
            return null;
        }

        // 优先检查根目录是否包含 SKILL.md
        if (file_exists($baseDir . '/SKILL.md')) {
            self::logSkillUtil('在根目录找到 SKILL.md', ['foundDir' => $baseDir]);
            return $baseDir;
        }

        $items = scandir($baseDir);
        if ($items === false) {
            self::logSkillUtil('scandir 失败', ['baseDir' => $baseDir]);
            return null;
        }

        $filteredItems = array_values(array_filter($items, fn (string $i) => $i !== '.' && $i !== '..' && $i !== '__MACOSX'));
        self::logSkillUtil('扫描目录项', ['baseDir' => $baseDir, 'items' => $filteredItems]);

        foreach ($items as $item) {
            if ($item === '.' || $item === '..' || $item === '__MACOSX') {
                continue;
            }
            $itemPath = $baseDir . '/' . $item;
            if (! is_dir($itemPath)) {
                self::logSkillUtil('跳过非目录项', ['item' => $item, 'path' => $itemPath]);
                continue;
            }
            // 检查该目录下是否包含 SKILL.md
            $skillMdPath = $itemPath . '/SKILL.md';
            self::logSkillUtil('检查子目录', ['subDir' => $item, 'skillMdPath' => $skillMdPath]);
            if (file_exists($skillMdPath)) {
                self::logSkillUtil('在子目录找到 SKILL.md', ['foundDir' => $itemPath]);
                return $itemPath;
            }
            // 子目录无 SKILL.md，递归遍历其子目录
            $found = self::findSkillMdDirectory($itemPath);
            if ($found !== null) {
                return $found;
            }
        }

        self::logSkillUtil('未找到 SKILL.md', ['baseDir' => $baseDir]);
        return null;
    }

    /**
     * 拆分 YAML frontmatter（首行 --- 至下一个 ---）.
     *
     * @param list<string> $lines
     * @return null|array{0: list<string>, 1: int} [frontmatter 行（不含 ---）, 正文起始行下标]
     */
    private static function splitYamlFrontmatter(array $lines): ?array
    {
        if ($lines === [] || trim($lines[0]) !== '---') {
            return null;
        }
        for ($i = 1, $c = count($lines); $i < $c; ++$i) {
            if (trim($lines[$i]) === '---') {
                return [array_slice($lines, 1, $i - 1), $i + 1];
            }
        }
        return null;
    }

    /**
     * 解析 frontmatter 中的 name 与 description（含 description: | / > 多行块，及全角 ｜）.
     *
     * @param list<string> $fmLines
     * @return array{0: string, 1: string}
     */
    private static function parseFrontmatterNameAndDescription(array $fmLines): array
    {
        $name = '';
        $description = '';
        $n = count($fmLines);
        $i = 0;
        while ($i < $n) {
            $raw = $fmLines[$i];
            if (trim($raw) === '') {
                ++$i;
                continue;
            }
            if (! preg_match('/^([a-zA-Z_][a-zA-Z0-9_.-]*):\s*(.*)$/', $raw, $m)) {
                ++$i;
                continue;
            }
            $key = $m[1];
            $rhs = $m[2];
            if ($key === 'name') {
                $name = trim(trim($rhs), '"\'');
                ++$i;
                continue;
            }
            if ($key === 'description') {
                $rhsTrim = trim($rhs);
                if ($rhsTrim === '' || self::isYamlDescriptionBlockIndicator($rhsTrim)) {
                    $folded = self::isYamlFoldedDescriptionBlock($rhsTrim);
                    ++$i;
                    [$block, $i] = self::collectYamlBlockScalarLines($fmLines, $i);
                    $description = trim($folded ? self::collapseYamlFoldedBlock($block) : $block);
                } else {
                    $description = trim($rhsTrim, '"\'');
                    ++$i;
                }
                continue;
            }
            if (trim($rhs) !== '') {
                ++$i;
                continue;
            }
            ++$i;
            while ($i < $n) {
                $next = $fmLines[$i];
                if (trim($next) === '') {
                    ++$i;
                    continue;
                }
                if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_.-]*:\s/', $next)) {
                    break;
                }
                if (preg_match('/^\s+\S/u', $next)) {
                    ++$i;
                    continue;
                }
                break;
            }
        }
        return [$name, $description];
    }

    private static function isYamlDescriptionBlockIndicator(string $s): bool
    {
        if ($s === '') {
            return true;
        }
        return (bool) preg_match('/^[|>\x{FF5C}]/u', $s)
            || (bool) preg_match('/^[|>\x{FF5C}][+-]\s*$/u', $s);
    }

    /**
     * 是否为 YAML 折叠块标量（> / >- / >+），换行按「折行」合并为空格；| 为字面块保持换行.
     */
    private static function isYamlFoldedDescriptionBlock(string $rhsTrim): bool
    {
        return $rhsTrim !== '' && $rhsTrim[0] === '>';
    }

    /**
     * 将折叠块（>）收集到的多行合并为段落：行内折行变空格，空行分段.
     */
    private static function collapseYamlFoldedBlock(string $block): string
    {
        $lines = preg_split('/\R/', $block);
        $paragraphs = [];
        $current = [];
        foreach ($lines as $line) {
            $t = trim($line);
            if ($t === '') {
                if ($current !== []) {
                    $paragraphs[] = implode(' ', $current);
                    $current = [];
                }
                continue;
            }
            $current[] = $t;
        }
        if ($current !== []) {
            $paragraphs[] = implode(' ', $current);
        }
        return implode("\n\n", $paragraphs);
    }

    /**
     * 收集 YAML 块标量（| 或 >）正文，直至遇到顶层的 `key:` 行.
     *
     * @param list<string> $fmLines
     * @return array{0: string, 1: int}
     */
    private static function collectYamlBlockScalarLines(array $fmLines, int $startIdx): array
    {
        $buf = [];
        $i = $startIdx;
        $n = count($fmLines);
        while ($i < $n) {
            $line = $fmLines[$i];
            if (trim($line) === '') {
                $buf[] = '';
                ++$i;
                continue;
            }
            if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_.-]*:\s/', $line)) {
                break;
            }
            $buf[] = preg_match('/^(\s+)(.+)$/u', $line, $mm) ? $mm[2] : $line;
            ++$i;
        }
        return [implode("\n", $buf), $i];
    }

    /**
     * 解析以 Markdown 标题开头的 SKILL.md（无 YAML name 时）.
     * 格式一：中文「## 激活条件」及前置简介段落.
     * 格式二：英文「## Activation」「## When to use」等及前置简介段落.
     * 仅当存在简介文字或上述激活类章节时才采纳，避免单独一行 `# xxx` 抢占目录名 fallback.
     *
     * @return null|array{0: string, 1: string} [title, description] 或 null
     */
    private static function tryParseMarkdownSkillDocument(string $content): ?array
    {
        $lines = explode("\n", $content);
        $lines = self::stripYamlFrontmatterLines($lines);
        $h1Index = null;
        $title = '';
        foreach ($lines as $i => $line) {
            if (preg_match('/^#\s+(.+)$/', $line, $m)) {
                $h1Index = $i;
                $title = trim($m[1]);
                break;
            }
        }
        if ($h1Index === null || $title === '') {
            return null;
        }

        $rest = array_slice($lines, $h1Index + 1);
        [$intro, $fromIdx] = self::extractMarkdownIntroAndScanIndex($rest);
        $activation = self::extractMarkdownActivationSection($rest, $fromIdx);

        $introTrim = trim($intro);
        if ($introTrim === '' && $activation === null) {
            return null;
        }

        $description = $introTrim;
        if ($activation !== null && $activation !== '') {
            $description = $description === ''
                ? trim($activation)
                : $description . "\n\n" . trim($activation);
        }

        return [$title, $description];
    }

    /**
     * @param list<string> $lines
     * @return list<string>
     */
    private static function stripYamlFrontmatterLines(array $lines): array
    {
        $split = self::splitYamlFrontmatter($lines);
        if ($split === null) {
            return $lines;
        }
        return array_slice($lines, $split[1]);
    }

    /**
     * @param list<string> $rest H1 之后的行
     * @return array{0: string, 1: int} [intro 文本, 在 $rest 中扫描激活节的起始下标]
     */
    private static function extractMarkdownIntroAndScanIndex(array $rest): array
    {
        $buf = [];
        $i = 0;
        $c = count($rest);
        while ($i < $c) {
            $line = $rest[$i];
            if (preg_match('/^##\s/', $line)) {
                break;
            }
            $buf[] = $line;
            ++$i;
        }
        $intro = trim(implode("\n", $buf));
        return [$intro, $i];
    }

    /**
     * 从首个二级标题起扫描「激活条件 / Activation / When to use」章节至下一 ## 或文末.
     *
     * @param list<string> $rest H1 之后的行
     */
    private static function extractMarkdownActivationSection(array $rest, int $startIdx): ?string
    {
        $c = count($rest);
        for ($i = $startIdx; $i < $c; ++$i) {
            $line = $rest[$i];
            if (preg_match('/^##\s*(.+)$/', $line, $m)) {
                $heading = trim($m[1]);
                if (self::isMarkdownActivationHeading($heading)) {
                    $chunk = [];
                    for ($j = $i + 1; $j < $c; ++$j) {
                        if (preg_match('/^##\s/', $rest[$j])) {
                            break;
                        }
                        $chunk[] = $rest[$j];
                    }
                    $text = trim(implode("\n", $chunk));
                    return $text === '' ? null : $line . "\n" . $text;
                }
            }
        }
        return null;
    }

    private static function isMarkdownActivationHeading(string $heading): bool
    {
        if ($heading === '激活条件') {
            return true;
        }
        $h = strtolower($heading);
        if (str_starts_with($h, 'activation')) {
            return true;
        }
        if (preg_match('/^when\s+to\s+use\b/', $h)) {
            return true;
        }
        return false;
    }

    /**
     * 将字符串转换为合法的 package_name 格式（小写、仅允许 a-z0-9\-_）.
     */
    private static function sanitizePackageName(string $input): string
    {
        $s = strtolower($input);
        $s = preg_replace('/[^a-z0-9\-_]/', '-', $s);
        $s = preg_replace('/-+/', '-', $s);
        $s = trim($s, '-');
        return substr($s ?: 'skill', 0, 128);
    }

    /**
     * 记录 SkillUtil 相关日志（容器不可用时静默跳过）.
     */
    private static function logSkillUtil(string $message, array $context = []): void
    {
        try {
            if (function_exists('di')) {
                $logger = di(LoggerFactory::class)->get(self::class);
                $logger->info('[findSkillMdDirectory] ' . $message, $context);
            }
        } catch (Throwable) {
            // 单元测试或容器未就绪时静默跳过
        }
    }
}
