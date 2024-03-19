<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\ErrorCode\SkillErrorCode;

/**
 * Skill 解析工具类.
 * 提供 Skill 文件解析等通用方法.
 */
class SkillUtil
{
    /**
     * 解析 SKILL.md 文件.
     *
     * @param string $skillMdPath SKILL.md 文件路径
     * @return array{0: string, 1: string} 返回 [packageName, packageDescription]
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

        // 读取文件内容
        $content = file_get_contents($skillMdPath);
        if ($content === false) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_MD_READ_FAILED, 'skill.skill_md_read_failed');
        }

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

        // 校验 package_name 不能为空
        if (empty($packageName)) {
            ExceptionBuilder::throw(SkillErrorCode::PACKAGE_NAME_REQUIRED, 'skill.package_name_required');
        }

        // 校验 package_name 格式
        if (! preg_match('/^[a-z0-9\-_]+$/', $packageName) || strlen($packageName) > 128) {
            ExceptionBuilder::throw(SkillErrorCode::INVALID_PACKAGE_NAME_FORMAT, 'skill.invalid_package_name_format');
        }

        return [$packageName, $packageDescription];
    }
}
