<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Parser;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\ZipUtil;
use Dtyq\SuperMagic\Application\Agent\DTO\ParsedAgentData;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\FrontmatterParser;
use Throwable;

/**
 * Parses an agent ZIP package and extracts structured agent data.
 *
 * Expected ZIP structure (single top-level directory):
 * {agent_dir_name}/
 * ├── IDENTITY.md   (required – contains YAML frontmatter with name, role, description, llm)
 * ├── AGENTS.md     (optional – system prompt body)
 * ├── SOUL.md       (optional – additional personality instructions)
 * ├── TOOLS.md      (optional – YAML frontmatter with tools list)
 * ├── SKILLS.md     (optional – YAML frontmatter with skills list)
 * └── skills/       (optional – skill sub-packages)
 */
class AgentZipParser
{
    private const MAX_EXTRACTED_SIZE = 50 * 1024 * 1024; // 50MB guard against zip-bombs

    public function parse(string $zipFilePath): ParsedAgentData
    {
        $extractDir = sys_get_temp_dir() . '/agent_import_' . uniqid('', true);

        try {
            ZipUtil::extract($zipFilePath, $extractDir, self::MAX_EXTRACTED_SIZE);
        } catch (Throwable $e) {
            @rmdir($extractDir);
            ExceptionBuilder::throw(
                SuperAgentErrorCode::IMPORT_EXTRACT_FAILED,
                'super_magic.agent.import.extract_failed'
            );
        }

        $agentDir = $this->resolveAgentDir($extractDir);
        $agentDirName = basename($agentDir);

        $identityPath = $agentDir . '/IDENTITY.md';
        if (! file_exists($identityPath)) {
            ZipUtil::removeDirectory($extractDir);
            ExceptionBuilder::throw(
                SuperAgentErrorCode::IMPORT_INVALID_PACKAGE,
                'super_magic.agent.import.invalid_package'
            );
        }

        $identity = $this->parseFrontmatter((string) file_get_contents($identityPath));
        $tools = $this->parseListFrontmatter($agentDir . '/TOOLS.md', 'tools');
        $skills = $this->parseListFrontmatter($agentDir . '/SKILLS.md', 'skills');

        $name = trim((string) ($identity['name'] ?? ''));
        if ($name === '') {
            ZipUtil::removeDirectory($extractDir);
            ExceptionBuilder::throw(
                SuperAgentErrorCode::IMPORT_INVALID_PACKAGE,
                'super_magic.agent.import.invalid_package'
            );
        }

        $data = new ParsedAgentData();
        $data->extractDir = $extractDir;
        $data->agentDir = $agentDir;
        $data->agentDirName = $agentDirName;
        $data->tools = $tools;
        $data->skills = $skills;

        // Build i18n arrays – 'default' key stores the primary (English) name
        $data->nameI18n = $this->buildI18n($identity, 'name');
        $data->roleI18n = $this->buildI18n($identity, 'role');
        $data->descriptionI18n = $this->buildI18n($identity, 'description');

        return $data;
    }

    /**
     * Determine the actual agent content directory.
     * Supports both a single top-level directory and flat extraction.
     */
    private function resolveAgentDir(string $extractDir): string
    {
        $entries = array_values(array_filter(
            (array) scandir($extractDir),
            fn ($e) => ! in_array($e, ['.', '..'], true)
        ));

        if (count($entries) === 1 && is_dir($extractDir . '/' . $entries[0])) {
            return $extractDir . '/' . $entries[0];
        }

        return $extractDir;
    }

    /**
     * Parse YAML frontmatter between the first pair of --- delimiters.
     * Uses the shared frontmatter parser so standard YAML features such as
     * folded/literal block scalars (>- / |) are preserved.
     *
     * @return array<string, mixed>
     */
    private function parseFrontmatter(string $content): array
    {
        try {
            $parsed = FrontmatterParser::parse($content);
        } catch (Throwable) {
            return [];
        }

        return $parsed['data'];
    }

    /**
     * Parse a specific list key from a Markdown file's YAML frontmatter.
     *
     * @return array<string>
     */
    private function parseListFrontmatter(string $filePath, string $listKey): array
    {
        if (! file_exists($filePath)) {
            return [];
        }

        $parsed = $this->parseFrontmatter((string) file_get_contents($filePath));
        $list = $parsed[$listKey] ?? [];

        return is_array($list) ? array_values(array_filter($list, 'is_string')) : [];
    }

    /**
     * Build a locale-keyed array from IDENTITY.md frontmatter fields.
     * Primary field (e.g. "name") → stored under 'en_US' and 'default' keys.
     * Chinese field (e.g. "name_cn") → stored under 'zh_CN' key.
     *
     * Both 'en_US' (for publishAgent lookup) and 'default' (for search compatibility) are populated.
     *
     * @param array<string, mixed> $identity
     * @return array<string, string>
     */
    private function buildI18n(array $identity, string $field): array
    {
        $i18n = [];

        $primary = trim((string) ($identity[$field] ?? ''));
        if ($primary !== '') {
            $i18n['en_US'] = $primary;
            $i18n['default'] = $primary;
        }

        $cn = trim((string) ($identity[$field . '_cn'] ?? ''));
        if ($cn !== '') {
            $i18n['zh_CN'] = $cn;
        }

        return $i18n;
    }
}
