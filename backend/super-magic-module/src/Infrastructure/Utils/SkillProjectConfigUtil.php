<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use InvalidArgumentException;
use Symfony\Component\Yaml\Exception\ParseException;
use Symfony\Component\Yaml\Yaml;

final class SkillProjectConfigUtil
{
    public const SKILLS_ROOT_PATH = '.magic/skills';

    public const CONFIG_FILE_NAME = 'skill_config.yaml';

    public const CONFIG_PATH = self::SKILLS_ROOT_PATH . '/' . self::CONFIG_FILE_NAME;

    /** Maximum allowed YAML content size in bytes (64 KB). */
    private const MAX_CONTENT_SIZE = 65536;

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
        return Yaml::dump($config, 2, 2);
    }

    /**
     * @return array{skill: array<string, mixed>}
     */
    public static function parse(string $content): array
    {
        if (strlen($content) > self::MAX_CONTENT_SIZE) {
            throw new InvalidArgumentException(
                sprintf('Skill project config exceeds maximum allowed size (%d bytes).', self::MAX_CONTENT_SIZE)
            );
        }

        try {
            $parsed = Yaml::parse($content, Yaml::PARSE_EXCEPTION_ON_INVALID_TYPE);
        } catch (ParseException $e) {
            throw new InvalidArgumentException('Invalid skill project config format: ' . $e->getMessage(), 0, $e);
        }

        if (! is_array($parsed) || ! isset($parsed['skill']) || ! is_array($parsed['skill'])) {
            throw new InvalidArgumentException('Missing skill block in skill project config.');
        }

        return ['skill' => $parsed['skill']];
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
}
