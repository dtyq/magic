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
