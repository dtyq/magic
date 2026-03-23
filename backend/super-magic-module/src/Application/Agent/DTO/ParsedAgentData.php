<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\DTO;

/**
 * Internal value object holding structured data extracted from an imported agent ZIP.
 */
class ParsedAgentData
{
    /**
     * Root directory created during ZIP extraction (should be cleaned up after import).
     */
    public string $extractDir = '';

    /**
     * Agent content directory inside extractDir (the top-level sub-directory).
     */
    public string $agentDir = '';

    /**
     * Name in multiple languages. The 'default' key stores the mandatory English name.
     * Example: ['default' => 'Research Assistant', 'zh_CN' => '研究助手'].
     *
     * @var array<string, string>
     */
    public array $nameI18n = [];

    /**
     * Role/title in multiple languages.
     *
     * @var array<string, string>
     */
    public array $roleI18n = [];

    /**
     * Description in multiple languages.
     *
     * @var array<string, string>
     */
    public array $descriptionI18n = [];

    /**
     * Tool names extracted from TOOLS.md frontmatter.
     *
     * @var array<string>
     */
    public array $tools = [];

    /**
     * Skill names extracted from SKILLS.md frontmatter.
     *
     * @var array<string>
     */
    public array $skills = [];

    /**
     * Directory name of the agent package (last segment of agentDir path).
     */
    public string $agentDirName = '';
}
