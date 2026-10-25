<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Parser;

use App\Application\SuperMagic\Agent\DTO\ParsedAgentData;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\Utils\FrontmatterParser;
use App\Infrastructure\Util\ZipUtil;
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
        $identity = file_exists($identityPath)
            ? $this->parseFrontmatter((string) file_get_contents($identityPath))
            : [];

        $tools = $this->parseListFrontmatter($agentDir . '/TOOLS.md', 'tools');
        $skills = $this->parseListFrontmatter($agentDir . '/SKILLS.md', 'skills');

        // Fall back to the directory name (agent code) when name field is absent or empty,
        // so that ZIPs with minimal/empty IDENTITY.md can still be imported.
        $name = trim((string) ($identity['name'] ?? ''));
        if ($name === '') {
            $identity['name'] = $agentDirName;
        }

        $data = new ParsedAgentData();
        $data->extractDir = $extractDir;
        $data->agentDir = $agentDir;
        $data->agentDirName = $agentDirName;
        $data->tools = $tools;
        $data->skills = $skills;
        $skillsFile = $agentDir . '/SKILLS.md';
        $frontmatter = file_exists($skillsFile) ? $this->parseFrontmatter((string) file_get_contents($skillsFile)) : [];
        $entries = $frontmatter['market_skills'] ?? [];
        if (is_array($entries)) {
            foreach ($entries as $entry) {
                if (is_array($entry) && is_string($entry['name'] ?? null) && is_string($entry['code'] ?? null)
                    && $entry['name'] !== '' && $entry['code'] !== '') {
                    $data->marketSkills[] = ['name' => $entry['name'], 'code' => $entry['code'], 'description' => is_string($entry['description'] ?? null) ? $entry['description'] : ''];
                }
            }
        }

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

        return isset($parsed['data']) && is_array($parsed['data']) ? $parsed['data'] : [];
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
