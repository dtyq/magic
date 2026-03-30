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
     * @return array{skill: array{dir: string}}
     */
    public static function buildConfig(SkillEntity $skillEntity): array
    {
        return [
            'skill' => [
                'dir' => $skillEntity->getPackageName(),
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

            // Quoted value: dir: "value"
            if (preg_match('/^\s{2}([A-Za-z0-9-]+):\s*"((?:\\\.|[^"])*)"\s*$/', $line, $matches) === 1) {
                $skill[$matches[1]] = stripcslashes($matches[2]);
                continue;
            }

            // Unquoted value (standard YAML): dir: value
            if (preg_match('/^\s{2}([A-Za-z0-9-]+):\s*([^"\'#\s][^\s#]*)\s*$/', $line, $matches) === 1) {
                $skill[$matches[1]] = $matches[2];
                continue;
            }

            // Empty value: dir:
            if (preg_match('/^\s{2}([A-Za-z0-9-]+):\s*$/', $line, $matches) === 1) {
                $skill[$matches[1]] = '';
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
}
