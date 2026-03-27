<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use InvalidArgumentException;

final class SkillProjectConfigUtil
{
    public const SKILLS_ROOT_PATH = '.magic/skills';

    public const CONFIG_FILE_NAME = 'skill_config.yaml';

    public const CONFIG_PATH = self::SKILLS_ROOT_PATH . '/' . self::CONFIG_FILE_NAME;

    /**
     * @return array{skill: array{
     *     dir: string,
     *     name: string,
     *     description: string,
     *     name-cn: string,
     *     description-cn: string,
     *     name-en: string,
     *     description-en: string
     * }}
     */
    public static function buildConfig(SkillEntity $skillEntity): array
    {
        $packageName = $skillEntity->getPackageName();
        $nameI18n = $skillEntity->getNameI18n();
        $descriptionI18n = $skillEntity->getDescriptionI18n() ?? [];
        $descriptionEn = self::firstNonEmpty(
            $descriptionI18n['en_US'] ?? null,
            $skillEntity->getPackageDescription(),
        );

        return [
            'skill' => [
                'dir' => $packageName,
                'name' => $packageName,
                'description' => $descriptionEn,
                'name-cn' => (string) ($nameI18n['zh_CN'] ?? ''),
                'description-cn' => (string) ($descriptionI18n['zh_CN'] ?? ''),
                'name-en' => self::firstNonEmpty($nameI18n['en_US'] ?? null, $packageName),
                'description-en' => $descriptionEn,
            ],
        ];
    }

    /**
     * @param array{skill: array<string, string>} $config
     */
    public static function render(array $config): string
    {
        $skill = $config['skill'] ?? [];

        return implode("\n", [
            'skill:',
            sprintf('  dir: "%s"', self::escapeValue($skill['dir'] ?? '')),
            sprintf('  name: "%s"', self::escapeValue($skill['name'] ?? '')),
            sprintf('  description: "%s"', self::escapeValue($skill['description'] ?? '')),
            '',
            sprintf('  name-cn: "%s"', self::escapeValue($skill['name-cn'] ?? '')),
            sprintf('  description-cn: "%s"', self::escapeValue($skill['description-cn'] ?? '')),
            '',
            sprintf('  name-en: "%s"', self::escapeValue($skill['name-en'] ?? '')),
            sprintf('  description-en: "%s"', self::escapeValue($skill['description-en'] ?? '')),
            '',
        ]);
    }

    /**
     * @return array{skill: array<string, string>}
     */
    public static function parse(string $content): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $content) ?: [];
        $inSkillBlock = false;
        $skill = [];

        foreach ($lines as $line) {
            $trimmedLine = trim($line);
            if ($trimmedLine === '') {
                continue;
            }

            if ($trimmedLine === 'skill:') {
                $inSkillBlock = true;
                continue;
            }

            if (! $inSkillBlock) {
                continue;
            }

            if (preg_match('/^\s{2}([A-Za-z0-9-]+):\s*"((?:\\\.|[^"])*)"\s*$/', $line, $matches) === 1) {
                $skill[$matches[1]] = stripcslashes($matches[2]);
                continue;
            }

            throw new InvalidArgumentException('Invalid skill project config format.');
        }

        if (! $inSkillBlock) {
            throw new InvalidArgumentException('Missing skill block in skill project config.');
        }

        return ['skill' => $skill];
    }

    public static function isValidSkillDir(string $dir): bool
    {
        if ($dir === '' || trim($dir) !== $dir) {
            return false;
        }

        if ($dir === '.' || $dir === '..') {
            return false;
        }

        if (str_contains($dir, '/') || str_contains($dir, '\\')) {
            return false;
        }

        return ! str_contains($dir, '..');
    }

    private static function escapeValue(string $value): string
    {
        return addcslashes($value, "\\\"\n\r\t");
    }

    private static function firstNonEmpty(?string ...$values): string
    {
        foreach ($values as $value) {
            if ($value !== null && $value !== '') {
                return $value;
            }
        }

        return '';
    }
}
