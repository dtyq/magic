<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Service\FileDomainService;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentSkillDomainService;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Service\SkillVersionDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\Utils\FrontmatterParser;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\ZipUtil;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

/**
 * Keeps .magic/SKILLS.md in sync with the directories installed under .magic/skills/.
 *
 * Triggered after:
 *  - skills are added to an agent
 *  - skills are removed from an agent
 *  - an agent is published (before the workspace is exported)
 */
class SkillsMdSyncService
{
    public const OPERATION_ADD = 'add';

    public const OPERATION_REMOVE = 'remove';

    public const OPERATION_SYNC = 'sync';

    private const TEMP_DIR_BASE = BASE_PATH . '/runtime/skills_md_sync/';

    private const SKILLS_KEY = 'skills';

    private const SYSTEM_SKILLS_KEY = 'system_skills';

    private LoggerInterface $logger;

    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileDomainService $fileDomainService,
        LoggerFactory $loggerFactory,
        private readonly SuperMagicAgentSkillDomainService $agentSkillDomainService,
        private readonly SkillVersionDomainService $skillVersionDomainService
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * Sync the skills list inside .magic/SKILLS.md.
     *
     * @param string[] $skillNames skill package names to add or remove (ignored for 'sync')
     * @param string $operation one of 'add', 'remove', 'sync'
     * @param string[] $systemSkillNames system builtin skill package names to add or remove
     */
    public function syncSkillsMd(
        int $projectId,
        ProjectEntity $projectEntity,
        string $organizationCode,
        string $projectOrgCode,
        array $skillNames = [],
        string $operation = self::OPERATION_SYNC,
        array $systemSkillNames = [],
        ?array $marketSkills = null,
        bool $strict = false
    ): ?string {
        try {
            return $this->doSync($projectId, $projectEntity, $organizationCode, $projectOrgCode, $skillNames, $operation, $systemSkillNames, $marketSkills);
        } catch (Throwable $e) {
            $this->logger->error('[SkillsMdSyncService] Failed to sync SKILLS.md', [
                'project_id' => $projectId,
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);
            if ($strict) {
                throw $e;
            }
            return null;
        }
    }

    /**
     * Read the current skill list from the SKILLS.md content string.
     *
     * @return string[]
     */
    public function getSkills(string $content): array
    {
        $parsed = FrontmatterParser::parse($content);
        $skills = $parsed['data'][self::SKILLS_KEY] ?? [];

        if (! is_array($skills)) {
            return [];
        }

        return array_values(array_filter($skills, 'is_string'));
    }

    /**
     * Add skill names to the SKILLS.md content. Duplicates are ignored.
     *
     * @param string[] $skillNames regular skill package names
     * @param string[] $systemSkillNames system builtin skill package names
     */
    public function addSkills(string $content, array $skillNames, array $systemSkillNames = [], array $marketSkills = []): string
    {
        if (empty($skillNames) && empty($systemSkillNames) && empty($marketSkills)) {
            return $content;
        }

        $parsed = FrontmatterParser::parse($content);

        if (! empty($skillNames)) {
            $existing = $this->extractSkillsList($parsed['data']);
            $merged = array_unique(array_merge($existing, $skillNames));
            sort($merged);
            $parsed['data'][self::SKILLS_KEY] = $merged;
        }

        if (! empty($systemSkillNames)) {
            $existingSystem = $this->extractSystemSkillsList($parsed['data']);
            $mergedSystem = array_unique(array_merge($existingSystem, $systemSkillNames));
            sort($mergedSystem);
            $parsed['data'][self::SYSTEM_SKILLS_KEY] = $mergedSystem;
        }

        if ($marketSkills !== []) {
            $parsed['data']['market_skills'] = $this->mergeMarketSkills($this->getMarketSkillEntries($content), $marketSkills);
        }

        return FrontmatterParser::dump($parsed['data'], $parsed['body']);
    }

    /**
     * Remove skill names from the SKILLS.md content.
     *
     * @param string[] $skillNames regular skill package names
     * @param string[] $systemSkillNames system builtin skill package names
     */
    public function removeSkills(string $content, array $skillNames, array $systemSkillNames = []): string
    {
        if (empty($skillNames) && empty($systemSkillNames)) {
            return $content;
        }

        $parsed = FrontmatterParser::parse($content);
        $parsed['data']['market_skills'] = array_values(array_filter(
            $this->getMarketSkillEntries($content),
            static fn (array $entry): bool => ! in_array($entry['name'], $skillNames, true) && ! in_array($entry['code'], $skillNames, true)
        ));

        if (! empty($skillNames)) {
            $existing = $this->extractSkillsList($parsed['data']);
            $remaining = array_values(array_diff($existing, $skillNames));
            sort($remaining);
            if (empty($remaining)) {
                unset($parsed['data'][self::SKILLS_KEY]);
            } else {
                $parsed['data'][self::SKILLS_KEY] = $remaining;
            }
        }

        if (! empty($systemSkillNames)) {
            $existingSystem = $this->extractSystemSkillsList($parsed['data']);
            $remainingSystem = array_values(array_diff($existingSystem, $systemSkillNames));
            sort($remainingSystem);
            if (empty($remainingSystem)) {
                unset($parsed['data'][self::SYSTEM_SKILLS_KEY]);
            } else {
                $parsed['data'][self::SYSTEM_SKILLS_KEY] = $remainingSystem;
            }
        }

        return FrontmatterParser::dump($parsed['data'], $parsed['body']);
    }

    /** @return array<int, array{name: string, code: string, description: string}> */
    public function getMarketSkillEntries(string $content): array
    {
        $data = FrontmatterParser::parse($content)['data'];
        return $this->mergeMarketSkills([], is_array($data['market_skills'] ?? null) ? $data['market_skills'] : []);
    }

    /** @return array{market_skills: array, system_skills: array} */
    public function getBoundSkills(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode, bool $strict = true): array
    {
        $bindings = $this->agentSkillDomainService->getByAgentCodeForCurrentVersion($dataIsolation, $agentCode);
        $codes = array_map(static fn ($binding): string => $binding->getSkillCode(), $bindings);
        $skillIsolation = SkillDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
        $skillIsolation->disabled();
        $versions = $this->skillVersionDomainService->findCurrentPublishedVersionsByCodes($skillIsolation, $codes);
        return $this->buildBoundSkillEntries($codes, $versions, $agentCode, $strict);
    }

    private function buildBoundSkillEntries(array $codes, array $versions, string $agentCode, bool $strict): array
    {
        $boundByPackage = [];
        foreach ($codes as $code) {
            try {
                $version = $versions[$code] ?? null;
                if ($version === null) {
                    throw new RuntimeException('Bound skill has no downloadable published version: ' . $code);
                }
                $name = $version->getPackageName();
                if (! is_string($name) || $name === '' || in_array($name, ['.', '..'], true) || str_contains($name, '/') || str_contains($name, '\\')) {
                    throw new RuntimeException('Invalid bound skill package name: ' . $code);
                }

                $isSystem = $version->getSourceType()->isSystem();
                $description = '';
                if (! $isSystem) {
                    if (empty($version->getFileKey())) {
                        throw new RuntimeException('Bound skill has no downloadable package: ' . $code);
                    }
                    $description = $version->getPackageDescription() ?? '';
                }

                if (isset($boundByPackage[$name])) {
                    $previous = $boundByPackage[$name];
                    $this->logger->warning('[SkillsMdSyncService] Duplicate bound skill package overridden', [
                        'agent_code' => $agentCode,
                        'package_name' => $name,
                        'previous_skill_code' => $previous['code'],
                        'skill_code' => $code,
                    ]);
                    unset($boundByPackage[$name]);
                }

                $boundByPackage[$name] = [
                    'code' => $code,
                    'is_system' => $isSystem,
                    'description' => $description,
                ];
            } catch (RuntimeException $e) {
                if ($strict) {
                    throw $e;
                }
                $this->logger->warning('[SkillsMdSyncService] Skipping invalid bound skill', [
                    'agent_code' => $agentCode,
                    'skill_code' => $code,
                    'reason' => $e->getMessage(),
                ]);
            }
        }

        $market = [];
        $system = [];
        foreach ($boundByPackage as $name => $entry) {
            if ($entry['is_system']) {
                $system[] = $name;
            } else {
                $market[] = ['name' => $name, 'code' => $entry['code'], 'description' => $entry['description']];
            }
        }

        return ['market_skills' => $this->mergeMarketSkills([], $market), 'system_skills' => $system];
    }

    private function mergeMarketSkills(array $existing, array $incoming): array
    {
        foreach ($incoming as $entry) {
            if (! is_array($entry) || ! is_string($entry['name'] ?? null) || ! is_string($entry['code'] ?? null)
                || trim($entry['name']) === '' || trim($entry['code']) === '') {
                continue;
            }
            $existing = array_values(array_filter($existing, static fn (array $old): bool => $old['name'] !== $entry['name'] && $old['code'] !== $entry['code']));
            $existing[] = ['name' => $entry['name'], 'code' => $entry['code'], 'description' => is_string($entry['description'] ?? null) ? $entry['description'] : ''];
        }
        return $existing;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * @param string[] $skillNames
     * @param string[] $systemSkillNames
     */
    private function doSync(
        int $projectId,
        ProjectEntity $projectEntity,
        string $organizationCode,
        string $projectOrgCode,
        array $skillNames,
        string $operation,
        array $systemSkillNames = [],
        ?array $marketSkills = null
    ): string {
        // Locate .magic directory via tree navigation.
        $magicDir = $this->taskFileDomainService->findDirectoryByPath($projectId, '.magic');
        if ($magicDir === null) {
            throw new RuntimeException('Cannot sync skills: .magic directory is missing.');
        }

        // Locate SKILLS.md via tree navigation: find file named SKILLS.md under .magic.
        $entity = $this->taskFileDomainService->getByProjectParentAndName(
            $projectId,
            $magicDir->getFileId(),
            'SKILLS.md'
        );

        $verifiedFileKey = $entity?->getFileKey();
        $currentContent = $verifiedFileKey === null ? FrontmatterParser::dump(['inherit_defaults' => true]) : $this->downloadFileContent($projectOrgCode, $verifiedFileKey);
        if ($currentContent === null) {
            throw new RuntimeException('Cannot read SKILLS.md before synchronization.');
        }

        $newContent = match ($operation) {
            self::OPERATION_ADD => $this->addSkills($currentContent, $skillNames, $systemSkillNames, $marketSkills ?? []),
            self::OPERATION_REMOVE => $this->removeSkills($currentContent, $skillNames, $systemSkillNames),
            default => $this->rebuildFromInstalledSkills($currentContent, $projectId, $marketSkills, $systemSkillNames),
        };

        if ($entity === null) {
            $dataIsolation = DataIsolation::simpleMake($organizationCode, $projectEntity->getUserId());
            $this->taskFileDomainService->createProjectFileWithContent($dataIsolation, $projectEntity, $magicDir->getFileId(), 'SKILLS.md', $newContent, TaskFileSource::SKILL);
            return hash('sha256', $newContent);
        }

        if ($newContent === $currentContent) {
            $this->logger->info('[SkillsMdSyncService] SKILLS.md already up-to-date', [
                'project_id' => $projectId,
                'operation' => $operation,
            ]);
            return hash('sha256', $newContent);
        }

        $this->taskFileDomainService->overwriteProjectFileContent($projectEntity, $verifiedFileKey, $newContent);

        $this->logger->info('[SkillsMdSyncService] SKILLS.md synced', [
            'project_id' => $projectId,
            'operation' => $operation,
            'skill_count' => count($skillNames),
        ]);
        return hash('sha256', $newContent);
    }

    /**
     * Full rebuild: replace the skills list with the directories found under .magic/skills/.
     */
    private function rebuildFromInstalledSkills(string $content, int $projectId, ?array $marketSkills = null, array $systemSkillNames = []): string
    {
        $installedNames = $this->listInstalledSkillNames($projectId);

        $parsed = FrontmatterParser::parse($content);
        $parsed['data'][self::SKILLS_KEY] = $installedNames;
        if ($marketSkills !== null) {
            $parsed['data']['market_skills'] = $this->mergeMarketSkills([], $marketSkills);
            $parsed['data'][self::SYSTEM_SKILLS_KEY] = array_values(array_unique(array_merge($this->extractSystemSkillsList($parsed['data']), $systemSkillNames)));
        }

        return FrontmatterParser::dump($parsed['data'], $parsed['body']);
    }

    /**
     * Download a file from the SandBox bucket to a temp path and return its contents as a string.
     */
    private function downloadFileContent(string $organizationCode, string $fileKey): ?string
    {
        $tempDir = self::TEMP_DIR_BASE . IdGenerator::getUniqueId32();
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }
        $tempFile = $tempDir . '/SKILLS.md';

        try {
            $this->fileDomainService->downloadByChunks(
                $organizationCode,
                $fileKey,
                $tempFile,
                StorageBucketType::SandBox
            );

            if (! file_exists($tempFile)) {
                return null;
            }

            $content = file_get_contents($tempFile);
            return $content === false ? null : $content;
        } finally {
            ZipUtil::removeDirectory($tempDir);
        }
    }

    /**
     * Return the directory names (= skill package names) directly under .magic/skills/.
     *
     * @return string[]
     */
    private function listInstalledSkillNames(int $projectId): array
    {
        $skillsDir = $this->taskFileDomainService->findDirectoryByPath($projectId, '.magic/skills');
        if ($skillsDir === null) {
            return [];
        }

        $children = $this->taskFileDomainService->getChildrenByParentAndProject(
            $projectId,
            $skillsDir->getFileId()
        );

        $names = [];
        foreach ($children as $child) {
            if ($child->getIsDirectory()) {
                $names[] = $child->getFileName();
            }
        }

        sort($names);
        return $names;
    }

    /**
     * @param array<string, mixed> $data
     * @return string[]
     */
    private function extractSkillsList(array $data): array
    {
        $skills = $data[self::SKILLS_KEY] ?? [];

        if (! is_array($skills)) {
            return [];
        }

        return array_values(array_filter($skills, 'is_string'));
    }

    /**
     * @param array<string, mixed> $data
     * @return string[]
     */
    private function extractSystemSkillsList(array $data): array
    {
        $skills = $data[self::SYSTEM_SKILLS_KEY] ?? [];

        if (! is_array($skills)) {
            return [];
        }

        return array_values(array_filter($skills, 'is_string'));
    }
}
